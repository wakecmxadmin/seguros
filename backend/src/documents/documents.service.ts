import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EndorsementType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';
import type { RequestContext } from '../auth/auth.service';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { listPlaceholders, mergeDocx } from './docx-merge';
import { formatDocument, proposalValues, type ProposalQuote } from './proposal-values';

const MODAL = { AIR: 'Aéreo', SEA: 'Marítimo', ROAD: 'Rodoviário', RAIL: 'Ferroviário' } as const;

const placeInclude = {
  originCountry: { select: { name: true } },
  originPort: { select: { name: true } },
  destinationCountry: { select: { name: true } },
  destinationPort: { select: { name: true } },
} satisfies Prisma.QuoteInclude;

const quoteInclude = {
  ...placeInclude,
  client: { select: { legalName: true, tradeName: true, document: true } },
  insurer: { select: { legalName: true, tradeName: true } },
  policy: { select: { number: true } },
  coverage: { select: { id: true, name: true } },
  commodityType: { select: { name: true } },
  packaging: { select: { name: true } },
  currency: { select: { code: true } },
  rateLines: true,
} satisfies Prisma.QuoteInclude;

type QuoteWithRelations = Prisma.QuoteGetPayload<{ include: typeof quoteInclude }>;

/** "Cidade, Porto, País" sem partes vazias. */
function place(...parts: (string | null | undefined)[]) {
  return parts.filter((p) => p && p.trim()).join(' — ') || null;
}

const slug = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private audit: AuditService,
  ) {}

  private scopeFor(user: AuthenticatedUser): Prisma.QuoteWhereInput {
    if (user.clientId) return { clientId: user.clientId };
    if (user.partnerId) return { partnerId: user.partnerId };
    return {};
  }

  private async loadQuote(id: string, user: AuthenticatedUser) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, ...this.scopeFor(user) },
      include: quoteInclude,
    });
    if (!quote) throw new NotFoundException('Processo não encontrado.');
    return quote;
  }

  // =========================================================================
  // Proposta (.docx)
  // =========================================================================

  /**
   * Modelo vigente para Tipo × Cobertura: a versão mais recente já em vigor.
   * O legado proibia excluir versões vigentes justamente porque escolhia assim.
   */
  private async templateFor(quote: QuoteWithRelations) {
    if (!quote.coverageId) {
      throw new BadRequestException(
        'Informe a cobertura (garantia) do processo para gerar a proposta.',
      );
    }
    const template = await this.prisma.proposalTemplate.findFirst({
      where: {
        kind: quote.kind,
        coverageId: quote.coverageId,
        active: true,
        storageKey: { not: null },
        version: { lte: new Date() },
      },
      orderBy: { version: 'desc' },
    });
    if (!template) {
      const kind = quote.kind === 'IMPORT' ? 'importação' : 'exportação';
      throw new BadRequestException(
        `Não há modelo de proposta vigente para ${kind} com a cobertura "${quote.coverage?.name}". Cadastre um em Cadastros → Modelos de proposta.`,
      );
    }
    return template;
  }

  private toProposalQuote(q: QuoteWithRelations): ProposalQuote {
    return {
      number: q.number,
      kind: q.kind,
      modal: q.modal,
      incoterm: q.incoterm,
      clientName: q.client.legalName,
      clientDocument: q.client.document,
      contactName: q.contactName,
      policyNumber: q.policy?.number ?? null,
      insurerName: q.insurer ? q.insurer.legalName : null,
      commodity: q.commodityDescription || q.commodityType?.name || null,
      invoiceNumber: q.invoiceNumber,
      origin: place(q.originCityName, q.originPort?.name, q.originCountry?.name),
      destination: place(q.destinationCityName, q.destinationPort?.name, q.destinationCountry?.name),
      packaging: q.packaging?.name ?? null,
      currencyCode: q.currency.code,
      notes: q.notes,
      weightKg: Number(q.weightKg),
      insuredAmount: Number(q.insuredAmount),
      premiumClient: Number(q.premiumClient),
      minimumPremiumApplied: q.minimumPremiumApplied,
      warStrike: q.warStrike,
      expensePercent: Number(q.expensePercent),
      profitPercent: Number(q.profitPercent),
      lines: q.rateLines.map((l) => ({
        item: l.item,
        amount: Number(l.amount),
        baseRateClient: Number(l.baseRateClient),
        extraRateClient: Number(l.extraRateClient),
        warRateClient: Number(l.warRateClient),
        premiumClient: Number(l.premiumClient),
      })),
    };
  }

  async proposal(quoteId: string, user: AuthenticatedUser, ctx: RequestContext) {
    const quote = await this.loadQuote(quoteId, user);
    if (!quote.calculatedAt) {
      throw new BadRequestException('Calcule a cotação antes de gerar a proposta.');
    }

    const template = await this.templateFor(quote);
    const source = await this.storage.readBuffer(template.storageKey!);
    const { buffer, unresolved } = await mergeDocx(source, proposalValues(this.toProposalQuote(quote)));

    await this.audit.record({
      userId: user.id,
      action: 'proposal_generated',
      entity: 'Quote',
      entityId: quote.id,
      after: { templateId: template.id, template: template.fileName, unresolved },
      ...ctx,
    });

    return {
      filename: `proposta-${quote.number}-${slug(quote.client.tradeName || quote.client.legalName)}.docx`,
      buffer,
      unresolved,
    };
  }

  /**
   * Marcadores de um modelo e quais o sistema sabe preencher — o "Palavras
   * Chaves" do legado, mas apontando o que ficaria sem valor no documento.
   */
  async templatePlaceholders(templateId: string) {
    const template = await this.prisma.proposalTemplate.findUnique({ where: { id: templateId } });
    if (!template?.storageKey) throw new NotFoundException('Modelo sem arquivo.');

    const used = await listPlaceholders(await this.storage.readBuffer(template.storageKey));
    const known = new Set(Object.keys(proposalValues(SAMPLE_QUOTE)));
    return {
      used,
      unknown: used.filter((key) => !known.has(key)),
      available: [...known].sort(),
    };
  }

  // =========================================================================
  // Certificado (importação) e solicitação de cobertura (exportação)
  // =========================================================================

  /**
   * Dados da definitiva para os documentos impressos. Os valores vêm do
   * domínio, não de strings pré-formatadas como no legado (`dePremio`).
   */
  async endorsementDocument(endorsementId: string, user: AuthenticatedUser, extensionId?: string) {
    const endorsement = await this.prisma.endorsement.findFirst({
      where: { id: endorsementId, quote: this.scopeFor(user) },
      include: {
        extensions: extensionId ? { where: { id: extensionId } } : false,
        currency: { select: { code: true } },
        vessel: { select: { name: true } },
        parent: { select: { number: true, issuedAt: true } },
        quote: { include: quoteInclude },
      },
    });
    if (!endorsement) throw new NotFoundException('Averbação não encontrada.');
    if (endorsement.type !== EndorsementType.FINAL) {
      throw new BadRequestException('Certificado e cobertura só existem para a averbação definitiva.');
    }
    if (endorsement.position === 'CANCELED') {
      throw new BadRequestException('Averbação cancelada não gera documento.');
    }

    // Certificado de prorrogação (docs/16 § 5): "PRG-", prêmio e data da
    // prorrogação e o selo "PRORROGAÇÃO DE SEGURO".
    const extension = extensionId ? endorsement.extensions?.[0] : undefined;
    if (extensionId && !extension) throw new NotFoundException('Prorrogação não encontrada.');
    if (extension?.canceledAt) {
      throw new BadRequestException('Prorrogação cancelada não gera documento.');
    }

    const q = endorsement.quote;
    const lineAmount = (item: string) =>
      Number(q.rateLines.find((l) => l.item === item)?.amount ?? 0);

    // Composição da I.S. conforme o processo — o legado imprimia "FOB+Frete"
    // fixo, mesmo sem frete.
    const composition = [
      lineAmount('COST') > 0 && 'Custo',
      lineAmount('FREIGHT') > 0 && 'Frete',
      q.expensesCovered && 'Despesas',
      q.expectedProfitCovered && 'Lucros esperados',
      lineAmount('CIF_VALUE') > 0 && 'Valor CIF',
    ].filter(Boolean) as string[];

    const taxes = [
      q.taxImportDuty && 'II',
      q.taxIpi && 'IPI',
      q.taxIcms && 'ICMS',
      q.taxPis && 'PIS',
      q.taxCofins && 'COFINS',
    ].filter(Boolean) as string[];
    if (taxes.length) composition.push(`Impostos (${taxes.join(', ')})`);

    const guarantee = [
      q.coverage?.name,
      q.warStrike && (q.modal === 'ROAD' ? 'Greve' : 'Guerra e greve'),
      q.machineryStoppage && 'Paralisação de máquinas frigoríficas',
    ]
      .filter(Boolean)
      .join(' + ');

    return {
      document: q.kind === 'IMPORT' ? 'certificate' : 'coverage',
      quoteNumber: q.number,
      kind: q.kind,
      reference: q.reference,
      client: { name: q.client.legalName, document: formatDocument(q.client.document) },
      insurer: q.insurer?.legalName ?? null,
      policyNumber: q.policy?.number ?? null,
      endorsement: {
        number: endorsement.number,
        issuedAt: endorsement.issuedAt,
        berthingDate: endorsement.berthingDate,
        blNumber: endorsement.blNumber,
        containerNumber: endorsement.containerNumber,
        vessel: endorsement.vessel?.name ?? null,
      },
      // Ano da provisória pela data dela — o legado usava a da definitiva.
      provisional: endorsement.parent
        ? { number: endorsement.parent.number, issuedAt: endorsement.parent.issuedAt }
        : null,
      commodity: q.commodityDescription || q.commodityType?.name || null,
      invoiceNumber: q.invoiceNumber,
      origin: place(q.originCityName, q.originPort?.name, q.originCountry?.name),
      destination: place(q.destinationCityName, q.destinationPort?.name, q.destinationCountry?.name),
      modal: q.modal,
      modalLabel: MODAL[q.modal],
      departureForecast: q.departureForecast,
      incoterm: q.incoterm,
      currencyCode: endorsement.currency.code,
      extension: extension
        ? {
            sequence: extension.sequence,
            issuedAt: extension.issuedAt,
            coverageUntil: extension.coverageUntil,
            percent: Number(extension.percent),
          }
        : null,
      insuredAmount: Number(endorsement.insuredAmount),
      premiumClient: Number(extension?.premiumClient ?? endorsement.premiumClient),
      premiumClientBrl: Number(extension?.premiumClientBrl ?? endorsement.premiumClientBrl),
      exchangeRate: Number(extension?.exchangeRate ?? endorsement.exchangeRate),
      clientRate: (() => {
        const ref = q.rateLines.find((l) => l.item === 'COST') ?? q.rateLines[0];
        if (!ref) return null;
        return (
          Number(ref.baseRateClient) +
          Number(ref.extraRateClient) +
          (q.warStrike ? Number(ref.warRateClient) : 0)
        );
      })(),
      composition,
      guarantee: guarantee || null,
    };
  }
}

/** Cotação fictícia só para enumerar as chaves que o merge sabe preencher. */
const SAMPLE_QUOTE: ProposalQuote = {
  number: 0,
  kind: 'IMPORT',
  modal: 'SEA',
  incoterm: 'CFR',
  clientName: '',
  clientDocument: null,
  contactName: null,
  policyNumber: null,
  insurerName: null,
  commodity: null,
  invoiceNumber: null,
  origin: null,
  destination: null,
  packaging: null,
  currencyCode: 'USD',
  notes: null,
  weightKg: 0,
  insuredAmount: 0,
  premiumClient: 0,
  minimumPremiumApplied: false,
  warStrike: false,
  expensePercent: 10,
  profitPercent: 10,
  lines: [],
};
