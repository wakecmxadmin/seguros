import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BatchStatus, EndorsementType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import type { RequestContext } from '../auth/auth.service';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

const batchInclude = {
  insurer: { select: { id: true, legalName: true, tradeName: true } },
  _count: { select: { items: true } },
} satisfies Prisma.EndorsementBatchInclude;

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Primeiro e último instante de uma competência AAAA-MM. */
function periodRange(period: string) {
  const [year, month] = period.split('-').map(Number);
  if (!year || !month || month < 1 || month > 12) {
    throw new BadRequestException('Competência inválida. Use o formato AAAA-MM.');
  }
  return {
    from: new Date(Date.UTC(year, month - 1, 1)),
    to: new Date(Date.UTC(year, month, 0, 23, 59, 59)),
  };
}

@Injectable()
export class BatchesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private settings: SettingsService,
  ) {}

  async list(filters: { period?: string; insurerId?: string; status?: BatchStatus }) {
    return this.prisma.endorsementBatch.findMany({
      where: {
        ...(filters.period ? { period: filters.period } : {}),
        ...(filters.insurerId ? { insurerId: filters.insurerId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      include: batchInclude,
      orderBy: [{ period: 'desc' }, { sequence: 'desc' }],
    });
  }

  /**
   * Averbações do período que ainda não entraram em nenhum lote.
   * É o que a tela mostra antes de fechar o mês.
   */
  async preview(period: string, insurerId: string) {
    const { from, to } = periodRange(period);

    const items = await this.prisma.endorsement.findMany({
      where: {
        issuedAt: { gte: from, lte: to },
        position: { not: 'CANCELED' },
        quote: { insurerId },
        batchItems: { none: {} },
      },
      include: {
        currency: { select: { code: true } },
        vessel: { select: { name: true } },
        quote: {
          select: {
            number: true,
            kind: true,
            client: { select: { legalName: true, tradeName: true, document: true } },
          },
        },
      },
      orderBy: { sequence: 'asc' },
    });

    return {
      period,
      items,
      totals: {
        count: items.length,
        insuredAmount: round(items.reduce((acc, i) => acc + Number(i.insuredAmount), 0)),
        premiumClient: round(items.reduce((acc, i) => acc + Number(i.premiumClient), 0)),
        premiumInsurer: round(items.reduce((acc, i) => acc + Number(i.premiumInsurer), 0)),
      },
    };
  }

  /** Fecha a competência: congela os itens e os totais. */
  async close(
    period: string,
    insurerId: string,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ) {
    const existing = await this.prisma.endorsementBatch.findUnique({
      where: { period_insurerId: { period, insurerId } },
    });
    if (existing) {
      throw new BadRequestException(
        `A competência ${period} já foi fechada para esta seguradora.`,
      );
    }

    const { items, totals } = await this.preview(period, insurerId);
    if (!items.length) {
      throw new BadRequestException('Não há averbações nesta competência para esta seguradora.');
    }

    const batch = await this.prisma.endorsementBatch.create({
      data: {
        period,
        insurerId,
        status: BatchStatus.CLOSED,
        itemCount: totals.count,
        totalInsuredAmount: totals.insuredAmount,
        totalPremiumClient: totals.premiumClient,
        totalPremiumInsurer: totals.premiumInsurer,
        closedAt: new Date(),
        createdById: user.id,
        items: { create: items.map((i) => ({ endorsementId: i.id })) },
      },
      include: batchInclude,
    });

    await this.audit.record({
      userId: user.id,
      action: 'batch_closed',
      entity: 'EndorsementBatch',
      entityId: batch.id,
      after: { period, itemCount: totals.count, totalPremiumInsurer: totals.premiumInsurer },
      ...ctx,
    });

    return batch;
  }

  async markSent(id: string, user: AuthenticatedUser, ctx: RequestContext) {
    const batch = await this.prisma.endorsementBatch.findUnique({ where: { id } });
    if (!batch) throw new NotFoundException('Lote não encontrado.');
    if (batch.status === BatchStatus.SENT) {
      throw new BadRequestException('Este lote já foi enviado.');
    }

    const updated = await this.prisma.endorsementBatch.update({
      where: { id },
      data: { status: BatchStatus.SENT, sentAt: new Date() },
      include: batchInclude,
    });

    await this.audit.record({
      userId: user.id,
      action: 'batch_sent',
      entity: 'EndorsementBatch',
      entityId: id,
      ...ctx,
    });

    return updated;
  }

  /**
   * Arquivo do lote em CSV.
   *
   * As colunas seguem o que foi citado na reunião — nº do documento, navio,
   * data — mais os campos que o legado usava no arquivo de remessa.
   * **O layout definitivo ainda precisa ser confirmado com cada seguradora**
   * (ver novas_tarefas.md, item 28).
   */
  async exportCsv(id: string) {
    const batch = await this.prisma.endorsementBatch.findUnique({
      where: { id },
      include: {
        insurer: true,
        items: {
          include: {
            endorsement: {
              include: {
                currency: { select: { code: true } },
                vessel: { select: { name: true } },
                quote: {
                  select: {
                    number: true,
                    kind: true,
                    modal: true,
                    client: { select: { legalName: true, document: true } },
                    originCountry: { select: { name: true } },
                    destinationCountry: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!batch) throw new NotFoundException('Lote não encontrado.');

    const header = [
      'Averbacao',
      'Tipo',
      'Data',
      'Processo',
      'Cliente',
      'CNPJ',
      'Conhecimento',
      'Container',
      'Navio',
      'Origem',
      'Destino',
      'Modal',
      'Moeda',
      'ImportanciaSegurada',
      'PremioSeguradora',
      'DataAtracacao',
    ];

    const rows = batch.items.map(({ endorsement: e }) => [
      e.number,
      e.type === EndorsementType.PROVISIONAL ? 'Provisoria' : 'Definitiva',
      e.issuedAt.toISOString().slice(0, 10),
      String(e.quote.number),
      e.quote.client.legalName,
      e.quote.client.document ?? '',
      e.blNumber ?? '',
      e.containerNumber ?? '',
      e.vessel?.name ?? '',
      e.quote.originCountry?.name ?? '',
      e.quote.destinationCountry?.name ?? '',
      e.quote.modal,
      e.currency.code,
      Number(e.insuredAmount).toFixed(2),
      Number(e.premiumInsurer).toFixed(2),
      e.berthingDate ? e.berthingDate.toISOString().slice(0, 10) : '',
    ]);

    // Ponto e vírgula + BOM: o Excel em pt-BR abre direto, sem assistente.
    const escape = (value: string) =>
      /[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => escape(String(cell))).join(';'))
      .join('\r\n');

    const insurerSlug = (batch.insurer.tradeName ?? batch.insurer.legalName)
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .toLowerCase();

    return {
      filename: `averbacoes-${batch.period}-${insurerSlug}.csv`,
      content: `﻿${csv}`,
    };
  }

  /**
   * Extrato mensal por cliente, com o acréscimo aplicado.
   *
   * A dor relatada na reunião é enviar o valor original sem o acréscimo, então
   * o extrato mostra as duas colunas lado a lado e o total já acrescido.
   */
  async monthlyStatement(period: string, clientId?: string) {
    const { from, to } = periodRange(period);
    const surchargePercent = await this.settings.number('finance.surcharge_percent');

    const endorsements = await this.prisma.endorsement.findMany({
      where: {
        issuedAt: { gte: from, lte: to },
        position: { not: 'CANCELED' },
        ...(clientId ? { quote: { clientId } } : {}),
      },
      include: {
        currency: { select: { code: true } },
        quote: {
          select: {
            number: true,
            client: { select: { id: true, legalName: true, tradeName: true, document: true } },
          },
        },
      },
      orderBy: { issuedAt: 'asc' },
    });

    // Agrupa por cliente, com o detalhe para conferência.
    const groups = new Map<string, any>();

    for (const endorsement of endorsements) {
      const client = endorsement.quote.client;
      if (!groups.has(client.id)) {
        groups.set(client.id, {
          clientId: client.id,
          clientName: client.tradeName ?? client.legalName,
          document: client.document,
          count: 0,
          insuredAmount: 0,
          premiumOriginal: 0,
          surcharge: 0,
          premiumWithSurcharge: 0,
          items: [] as any[],
        });
      }

      const group = groups.get(client.id);
      const premium = Number(endorsement.premiumClient);
      const surcharge = round((premium * surchargePercent) / 100);

      group.count += 1;
      group.insuredAmount = round(group.insuredAmount + Number(endorsement.insuredAmount));
      group.premiumOriginal = round(group.premiumOriginal + premium);
      group.surcharge = round(group.surcharge + surcharge);
      group.premiumWithSurcharge = round(group.premiumWithSurcharge + premium + surcharge);
      group.items.push({
        number: endorsement.number,
        issuedAt: endorsement.issuedAt,
        quoteNumber: endorsement.quote.number,
        currency: endorsement.currency.code,
        insuredAmount: Number(endorsement.insuredAmount),
        premiumOriginal: premium,
        surcharge,
        premiumWithSurcharge: round(premium + surcharge),
      });
    }

    const rows = [...groups.values()].sort(
      (a, b) => b.premiumWithSurcharge - a.premiumWithSurcharge,
    );

    return {
      period,
      surchargePercent,
      rows,
      totals: {
        count: endorsements.length,
        insuredAmount: round(rows.reduce((acc, r) => acc + r.insuredAmount, 0)),
        premiumOriginal: round(rows.reduce((acc, r) => acc + r.premiumOriginal, 0)),
        surcharge: round(rows.reduce((acc, r) => acc + r.surcharge, 0)),
        premiumWithSurcharge: round(rows.reduce((acc, r) => acc + r.premiumWithSurcharge, 0)),
      },
    };
  }
}
