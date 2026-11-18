import { Injectable } from '@nestjs/common';
import {
  CashRequestStatus,
  CommissionBeneficiary,
  CommissionStatus,
  EndorsementType,
  Prisma,
} from '@prisma/client';
import ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { FxService } from '../fx/fx.service';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { buildRanking, productionFigures, round2, type ProductionFigures } from './production-math';
import type { ReportFiltersDto, RankingDimension } from './dto/reports.dto';

const endorsementInclude = {
  currency: { select: { code: true } },
  quote: {
    select: {
      id: true,
      number: true,
      kind: true,
      reference: true,
      clientId: true,
      partnerPercent: true,
      payableDiscountPercent: true,
      irbValue: true,
      irbCurrencyId: true,
      client: { select: { id: true, legalName: true, tradeName: true, stateName: true } },
      partner: { select: { id: true, legalName: true, tradeName: true } },
      insurer: { select: { id: true, legalName: true, tradeName: true } },
      policy: { select: { id: true, number: true, description: true } },
    },
  },
  cashRequests: {
    where: { status: { not: CashRequestStatus.CANCELED } },
    orderBy: { version: 'desc' },
    take: 1,
    select: { exchangeRate: true },
  },
  commissions: {
    where: {
      beneficiary: CommissionBeneficiary.PARTNER,
      status: { not: CommissionStatus.CANCELED },
    },
    select: { amount: true },
  },
} satisfies Prisma.EndorsementInclude;

type EndorsementRow = Prisma.EndorsementGetPayload<{ include: typeof endorsementInclude }>;

const extensionInclude = {
  endorsement: {
    select: { id: true, number: true, currency: { select: { code: true } }, quote: endorsementInclude.quote },
  },
} satisfies Prisma.EndorsementExtensionInclude;

type QuoteData = EndorsementRow['quote'];

/** Definitiva ou prorrogação, já no formato que a linha da planilha precisa. */
interface RowSource {
  endorsementId: string;
  number: string;
  extensionSequence: number | null;
  issuedAt: Date;
  currencyCode: string;
  exchangeRate: number;
  receiptRate: number | null;
  insuredAmount: number;
  premiumClient: number;
  premiumInsurer: number;
  /** Comissão de parceiro gerada; null quando não houve geração. */
  partnerCommission: number | null;
  includeIrb: boolean;
  quote: QuoteData;
}

function fromEndorsement(e: EndorsementRow): RowSource {
  return {
    endorsementId: e.id,
    number: e.number,
    extensionSequence: null,
    issuedAt: e.issuedAt,
    currencyCode: e.currency.code,
    exchangeRate: Number(e.exchangeRate),
    receiptRate: e.cashRequests[0] ? Number(e.cashRequests[0].exchangeRate) : null,
    insuredAmount: Number(e.insuredAmount),
    premiumClient: Number(e.premiumClient),
    premiumInsurer: Number(e.premiumInsurer),
    partnerCommission: e.commissions.length
      ? e.commissions.reduce((acc, c) => acc + Number(c.amount), 0)
      : null,
    includeIrb: true,
    quote: e.quote,
  };
}

/**
 * Prorrogação: só o prêmio adicional. A I.S. fica zerada para não somar duas
 * vezes a importância da definitiva nos rankings, e o IRB já foi contado nela.
 */
function fromExtension(x: Prisma.EndorsementExtensionGetPayload<{ include: typeof extensionInclude }>): RowSource {
  return {
    endorsementId: x.endorsement.id,
    number: `${x.endorsement.number} PRG-${x.sequence}`,
    extensionSequence: x.sequence,
    issuedAt: x.issuedAt,
    currencyCode: x.endorsement.currency.code,
    exchangeRate: Number(x.exchangeRate),
    receiptRate: null,
    insuredAmount: 0,
    premiumClient: Number(x.premiumClient),
    premiumInsurer: Number(x.premiumInsurer),
    partnerCommission: null,
    includeIrb: false,
    quote: x.endorsement.quote,
  };
}

export interface ProductionRow extends ProductionFigures {
  endorsementId: string;
  endorsementNumber: string;
  /** Preenchido nas linhas de prorrogação (tipo "Prorrogada"). */
  extensionSequence: number | null;
  issuedAt: Date;
  quoteId: string;
  quoteNumber: number;
  kind: string;
  reference: string | null;
  clientId: string;
  clientName: string;
  partnerId: string | null;
  partnerName: string | null;
  insurerName: string | null;
  policyId: string | null;
  policyLabel: string | null;
  state: string | null;
  currencyCode: string;
}

const name = (c?: { legalName: string; tradeName: string | null } | null) =>
  c ? c.tradeName || c.legalName : null;

const day = (d: Date) => d.toISOString().slice(0, 10);

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private fx: FxService,
  ) {}

  private scopeFor(user: AuthenticatedUser): Prisma.QuoteWhereInput {
    if (user.clientId) return { clientId: user.clientId };
    if (user.partnerId) return { partnerId: user.partnerId };
    return {};
  }

  /** Período padrão: mês corrente até hoje. */
  private period(filters: ReportFiltersDto) {
    const now = new Date();
    const from = filters.from ?? `${day(now).slice(0, 8)}01`;
    const to = filters.to ?? day(now);
    return { from, to };
  }

  // =========================================================================
  // Planilha de Produção
  // =========================================================================

  async production(filters: ReportFiltersDto, user: AuthenticatedUser) {
    const { from, to } = this.period(filters);

    const extended = filters.kind === 'EXTENDED';
    const quote: Prisma.QuoteWhereInput = {
      ...this.scopeFor(user),
      ...(filters.kind && filters.kind !== 'EXTENDED' ? { kind: filters.kind } : {}),
      ...(filters.clientId ? { clientId: filters.clientId } : {}),
      ...(filters.partnerId ? { partnerId: filters.partnerId } : {}),
      ...(filters.insurerId ? { insurerId: filters.insurerId } : {}),
      ...(filters.policyId ? { policyId: filters.policyId } : {}),
      ...(filters.state
        ? { client: { stateName: { equals: filters.state, mode: 'insensitive' } } }
        : {}),
    };
    const issuedAt = { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T23:59:59Z`) };

    // Como no legado, "Todos" traz só definitivas; as prorrogações têm tipo próprio.
    const sources: RowSource[] = extended
      ? (
          await this.prisma.endorsementExtension.findMany({
            where: {
              canceledAt: null,
              issuedAt,
              endorsement: { position: { not: 'CANCELED' }, quote },
            },
            include: extensionInclude,
            orderBy: [{ issuedAt: 'asc' }, { sequence: 'asc' }],
          })
        ).map(fromExtension)
      : (
          await this.prisma.endorsement.findMany({
            where: { type: EndorsementType.FINAL, position: { not: 'CANCELED' }, issuedAt, quote },
            include: endorsementInclude,
            orderBy: [{ issuedAt: 'asc' }, { sequence: 'asc' }],
          })
        ).map(fromEndorsement);

    const rates = await this.usdRates(sources.map((e) => e.issuedAt));
    const irbRates = await this.irbRates(sources);
    const rows = sources.map((e) => this.toRow(e, rates, irbRates));

    const sum = (field: keyof ProductionFigures) =>
      round2(rows.reduce((acc, r) => acc + (Number(r[field]) || 0), 0));

    const premiumClientBrl = sum('premiumClientBrl');
    const diffBrl = sum('diffBrl');

    return {
      from,
      to,
      rows,
      totals: {
        count: rows.length,
        insuredUsd: sum('insuredUsd'),
        premiumClientUsd: sum('premiumClientUsd'),
        premiumClientBrl,
        premiumInsurerUsd: sum('premiumInsurerUsd'),
        payableUsd: sum('payableUsd'),
        payableBrl: sum('payableBrl'),
        diffUsd: sum('diffUsd'),
        diffBrl,
        profitability: premiumClientBrl ? round2((diffBrl / premiumClientBrl) * 100) : null,
        partnerCommissionUsd: sum('partnerCommissionUsd'),
        irbUsd: sum('irbUsd'),
        resultUsd: sum('resultUsd'),
      },
      missingRates: rows.filter((r) => r.missingRate).length,
    };
  }

  private toRow(
    e: RowSource,
    usdRates: Map<string, number>,
    irbRates: Map<string, number>,
  ): ProductionRow {
    const q = e.quote;
    const premiumClient = e.premiumClient;

    // Comissão gerada na emissão; sem ela (processo sem parceiro, anterior
    // à geração automática ou prorrogação), cai para o percentual da cotação.
    const partnerCommission =
      e.partnerCommission ??
      (q.partner ? round2((premiumClient * Number(q.partnerPercent)) / 100) : 0);

    const usdRate = usdRates.get(day(e.issuedAt)) ?? 0;
    const irbValue = e.includeIrb ? Number(q.irbValue) : 0;
    const irbUsd =
      !irbValue || !q.irbCurrencyId
        ? irbValue
        : irbRates.has(`${q.irbCurrencyId}:${day(e.issuedAt)}`) && usdRate
          ? (irbValue * irbRates.get(`${q.irbCurrencyId}:${day(e.issuedAt)}`)!) / usdRate
          : irbValue;

    const figures = productionFigures({
      kind: q.kind,
      currencyCode: e.currencyCode,
      exchangeRate: e.exchangeRate,
      usdRate,
      receiptRate: e.receiptRate,
      insuredAmount: e.insuredAmount,
      premiumClient,
      premiumInsurer: e.premiumInsurer,
      payableDiscountPercent: Number(q.payableDiscountPercent),
      partnerCommission,
      irbUsd,
    });

    return {
      ...figures,
      endorsementId: e.endorsementId,
      endorsementNumber: e.number,
      extensionSequence: e.extensionSequence,
      issuedAt: e.issuedAt,
      quoteId: q.id,
      quoteNumber: q.number,
      kind: q.kind,
      reference: q.reference,
      clientId: q.clientId,
      clientName: name(q.client) ?? '—',
      partnerId: q.partner?.id ?? null,
      partnerName: name(q.partner),
      insurerName: name(q.insurer),
      policyId: q.policy?.id ?? null,
      policyLabel: q.policy ? q.policy.number || q.policy.description : null,
      state: q.client.stateName?.trim().toUpperCase() || null,
      currencyCode: e.currencyCode,
    };
  }

  /** Câmbio USD → BRL por dia, buscado uma vez por data distinta. */
  private async usdRates(dates: Date[]) {
    const result = new Map<string, number>();
    const usd = await this.prisma.currency.findFirst({ where: { code: 'USD' } });
    if (!usd) return result;

    for (const key of new Set(dates.map(day))) {
      try {
        const found = await this.fx.rateFor(usd.id, new Date(`${key}T12:00:00Z`));
        result.set(key, found.rate);
      } catch {
        // Sem cotação: a linha sai marcada como "sem câmbio".
      }
    }
    return result;
  }

  /** Câmbio da moeda do IRB, quando a cotação informou uma moeda própria. */
  private async irbRates(sources: RowSource[]) {
    const result = new Map<string, number>();
    const keys = new Set(
      sources
        .filter((e) => e.includeIrb && Number(e.quote.irbValue) && e.quote.irbCurrencyId)
        .map((e) => `${e.quote.irbCurrencyId}:${day(e.issuedAt)}`),
    );
    for (const key of keys) {
      const [currencyId, date] = key.split(':');
      try {
        const found = await this.fx.rateFor(currencyId, new Date(`${date}T12:00:00Z`));
        result.set(key, found.rate);
      } catch {
        // Mantém o valor como veio.
      }
    }
    return result;
  }

  // =========================================================================
  // Rankings
  // =========================================================================

  async ranking(dimension: RankingDimension, filters: ReportFiltersDto, user: AuthenticatedUser) {
    const production = await this.production(filters, user);

    const keyOf: Record<RankingDimension, (r: ProductionRow) => { key: string; label: string }> = {
      client: (r) => ({ key: r.clientId, label: r.clientName }),
      partner: (r) => ({
        key: r.partnerId ?? 'none',
        label: r.partnerName ?? 'Sem parceiro',
      }),
      policy: (r) => ({
        key: r.policyId ?? 'none',
        label: r.policyLabel ?? 'Sem apólice',
      }),
      state: (r) => ({ key: r.state ?? 'none', label: r.state ?? 'Não informado' }),
    };

    return {
      dimension,
      from: production.from,
      to: production.to,
      ...buildRanking(production.rows, keyOf[dimension]),
      missingRates: production.missingRates,
    };
  }

  // =========================================================================
  // Excel
  // =========================================================================

  async productionWorkbook(filters: ReportFiltersDto, user: AuthenticatedUser) {
    const data = await this.production(filters, user);

    const columns: Column<ProductionRow>[] = [
      { header: 'Processo', value: (r) => r.quoteNumber, width: 10 },
      { header: 'Definitiva', value: (r) => r.endorsementNumber, width: 16 },
      { header: 'Data', value: (r) => r.issuedAt, format: 'date', width: 11 },
      {
        header: 'Tipo',
        value: (r) =>
          r.extensionSequence ? 'Prorrogada' : r.kind === 'EXPORT' ? 'Exportação' : 'Importação',
        width: 12,
      },
      { header: 'Referência', value: (r) => r.reference ?? '', width: 16 },
      { header: 'Cliente', value: (r) => r.clientName, width: 32 },
      { header: 'Parceiro', value: (r) => r.partnerName ?? '', width: 24 },
      { header: 'Seguradora', value: (r) => r.insurerName ?? '', width: 22 },
      { header: 'Taxa US$ → R$', value: (r) => r.brlRate, format: 'rate', width: 13 },
      { header: 'I.S. US$', value: (r) => r.insuredUsd, format: 'money', total: 'insuredUsd' },
      { header: 'Prêmio cliente US$', value: (r) => r.premiumClientUsd, format: 'money', total: 'premiumClientUsd' },
      { header: 'Prêmio cliente R$', value: (r) => r.premiumClientBrl, format: 'money', total: 'premiumClientBrl' },
      { header: 'Prêmio seguradora US$', value: (r) => r.premiumInsurerUsd, format: 'money', total: 'premiumInsurerUsd' },
      { header: 'A pagar c/ agravo US$', value: (r) => r.payableUsd, format: 'money', total: 'payableUsd' },
      { header: 'A pagar R$', value: (r) => r.payableBrl, format: 'money', total: 'payableBrl' },
      { header: 'Diferença US$', value: (r) => r.diffUsd, format: 'money', total: 'diffUsd' },
      { header: 'Diferença R$', value: (r) => r.diffBrl, format: 'money', total: 'diffBrl' },
      { header: '% Rentabilidade', value: (r) => r.profitability, format: 'percent', total: 'profitability' },
      { header: 'Comissão parceiro US$', value: (r) => r.partnerCommissionUsd, format: 'money', total: 'partnerCommissionUsd' },
      { header: 'IRB US$', value: (r) => r.irbUsd, format: 'money', total: 'irbUsd' },
      { header: 'Resultado US$', value: (r) => r.resultUsd, format: 'money', total: 'resultUsd' },
    ];

    return {
      filename: `producao-${data.from}-a-${data.to}.xlsx`,
      buffer: await workbook('Produção', `Planilha de Produção — ${br(data.from)} a ${br(data.to)}`, columns, data.rows, data.totals),
    };
  }

  async rankingWorkbook(dimension: RankingDimension, filters: ReportFiltersDto, user: AuthenticatedUser) {
    const data = await this.ranking(dimension, filters, user);
    type Row = (typeof data.rows)[number];

    const title = { client: 'Cliente', partner: 'Parceiro', policy: 'Apólice', state: 'Estado' }[dimension];
    const columns: Column<Row>[] = [
      { header: 'Posição', value: (r) => r.position, width: 8 },
      { header: title, value: (r) => r.label, width: 34 },
      { header: '% do prêmio', value: (r) => r.percent, format: 'percent', total: 'percent' },
      { header: 'I.S. US$', value: (r) => r.insuredUsd, format: 'money', total: 'insuredUsd' },
      { header: 'Prêmio US$', value: (r) => r.premiumClientUsd, format: 'money', total: 'premiumClientUsd' },
      { header: 'Prêmio R$', value: (r) => r.premiumClientBrl, format: 'money', total: 'premiumClientBrl' },
      { header: 'Prêmio seguradora US$', value: (r) => r.premiumInsurerUsd, format: 'money', total: 'premiumInsurerUsd' },
      { header: 'Comissão parceiro US$', value: (r) => r.partnerCommissionUsd, format: 'money', total: 'partnerCommissionUsd' },
      { header: 'IRB US$', value: (r) => r.irbUsd, format: 'money', total: 'irbUsd' },
      { header: 'Resultado US$', value: (r) => r.resultUsd, format: 'money', total: 'resultUsd' },
      { header: 'Processos', value: (r) => r.processes, total: 'processes' },
      { header: 'Clientes', value: (r) => r.clients, total: 'clients' },
    ];

    return {
      filename: `ranking-${dimension}-${data.from}-a-${data.to}.xlsx`,
      buffer: await workbook(
        `Ranking ${title}`,
        `Ranking por ${title.toLowerCase()} — ${br(data.from)} a ${br(data.to)}`,
        columns,
        data.rows,
        data.totals,
      ),
    };
  }
}

// ---------------------------------------------------------------------------

interface Column<T> {
  header: string;
  value: (row: T) => string | number | Date | null;
  format?: 'money' | 'rate' | 'percent' | 'date';
  width?: number;
  total?: string;
}

const FORMATS = {
  money: '#,##0.00',
  rate: '0.0000',
  percent: '0.00"%"',
  date: 'dd/mm/yyyy',
};

const br = (iso: string) => iso.split('-').reverse().join('/');

/**
 * Planilha com números de verdade — o Excel do legado levava os valores como
 * texto já formatado ("1.234,56"), o que impedia somar no próprio Excel.
 */
async function workbook<T>(
  sheetName: string,
  title: string,
  columns: Column<T>[],
  rows: T[],
  totals: Record<string, unknown>,
) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 3 }] });

  sheet.getCell('A1').value = title;
  sheet.getCell('A1').font = { bold: true, size: 13 };

  const header = sheet.getRow(3);
  columns.forEach((col, i) => {
    const cell = header.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3A5F' } };
    cell.alignment = { vertical: 'middle', wrapText: true };
    sheet.getColumn(i + 1).width = col.width ?? 16;
    if (col.format) sheet.getColumn(i + 1).numFmt = FORMATS[col.format];
  });
  header.height = 30;

  for (const row of rows) {
    sheet.addRow(columns.map((col) => col.value(row) ?? null));
  }

  const totalRow = sheet.addRow(
    columns.map((col, i) => (i === 0 ? 'Total' : col.total ? (totals[col.total] as number) ?? null : null)),
  );
  totalRow.font = { bold: true };
  totalRow.eachCell((cell) => {
    cell.border = { top: { style: 'thin' } };
  });

  return Buffer.from(await book.xlsx.writeBuffer());
}
