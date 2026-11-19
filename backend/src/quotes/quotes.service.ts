import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, QuoteKind, QuotePosition, QuoteStatus, RateLineItem } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FxService } from '../fx/fx.service';
import { SigraProcessService } from '../sigra/sigra-process.service';
import type { RequestContext } from '../auth/auth.service';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { calculateQuote, type CalculationInput } from './quote-calculator';
import {
  extractSigraId, mapSigraAgencyToQuoteDraft, mapSigraToQuoteDraft, type QuoteSigraDraft,
} from './sigra-draft-mapper';
import { resolveClientRate } from '../policies/rate-resolver';
import { SettingsService } from '../settings/settings.service';
import { CalculateQuoteDto, ListQuotesDto, PreviewQuoteDto, SaveQuoteDto } from './dto/quotes.dto';

const listSelect = {
  id: true,
  number: true,
  reference: true,
  kind: true,
  status: true,
  position: true,
  issueDate: true,
  pendingLimitDate: true,
  insuredAmount: true,
  premiumClient: true,
  premiumInsurer: true,
  modal: true,
  client: { select: { id: true, legalName: true, tradeName: true } },
  partner: { select: { id: true, legalName: true, tradeName: true } },
  insurer: { select: { id: true, legalName: true, tradeName: true } },
  salesperson: { select: { id: true, name: true } },
  currency: { select: { id: true, code: true } },
  policy: { select: { id: true, number: true } },
} satisfies Prisma.QuoteSelect;

const detailInclude = {
  client: { select: { id: true, legalName: true, tradeName: true, document: true } },
  partner: { select: { id: true, legalName: true, tradeName: true } },
  insurer: { select: { id: true, legalName: true, tradeName: true } },
  policy: true,
  currency: true,
  coverage: true,
  packaging: true,
  commodityType: true,
  salesperson: { select: { id: true, name: true } },
  originCountry: { select: { id: true, name: true } },
  destinationCountry: { select: { id: true, name: true } },
  originPort: { select: { id: true, name: true, code: true } },
  destinationPort: { select: { id: true, name: true, code: true } },
  rateLines: true,
  externalReferences: { orderBy: { source: 'asc' } },
} satisfies Prisma.QuoteInclude;

@Injectable()
export class QuotesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private fx: FxService,
    private sigra: SigraProcessService,
    private settings: SettingsService,
  ) {}

  // -------------------------------------------------------------------------
  // Listagem
  // -------------------------------------------------------------------------

  async list(filters: ListQuotesDto, user: AuthenticatedUser) {
    const page = filters.page ?? 1;
    const perPage = Math.min(filters.perPage ?? 25, 200);

    const where: Prisma.QuoteWhereInput = {
      ...this.scopeFor(user),
      ...(filters.kind ? { kind: filters.kind } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.position ? { position: filters.position } : {}),
      ...(filters.clientId ? { clientId: filters.clientId } : {}),
      ...(filters.partnerId ? { partnerId: filters.partnerId } : {}),
      ...(filters.insurerId ? { insurerId: filters.insurerId } : {}),
      ...(filters.from || filters.to
        ? {
            issueDate: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59`) } : {}),
            },
          }
        : {}),
      ...(filters.search
        ? {
            OR: [
              ...(Number.isFinite(Number(filters.search))
                ? [{ number: Number(filters.search) }]
                : []),
              { reference: { contains: filters.search, mode: 'insensitive' as const } },
              { commodityDescription: { contains: filters.search, mode: 'insensitive' as const } },
              { invoiceNumber: { contains: filters.search, mode: 'insensitive' as const } },
              { client: { legalName: { contains: filters.search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.quote.findMany({
        where,
        select: listSelect,
        orderBy: { number: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.quote.count({ where }),
    ]);

    return { items, total, page, perPage, pages: Math.ceil(total / perPage) };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, ...this.scopeFor(user) },
      include: detailInclude,
    });
    if (!quote) throw new NotFoundException('Cotação não encontrada.');
    return quote;
  }

  /**
   * Usuários externos só enxergam os próprios processos — controle que não
   * existia no legado, onde qualquer login via tudo.
   */
  private scopeFor(user: AuthenticatedUser): Prisma.QuoteWhereInput {
    if (user.clientId) return { clientId: user.clientId };
    if (user.partnerId) return { partnerId: user.partnerId };
    return {};
  }

  // -------------------------------------------------------------------------
  // Cálculo
  // -------------------------------------------------------------------------

  /** Prévia do cálculo, sem persistir. Alimenta o recálculo reativo da tela. */
  async preview(dto: PreviewQuoteDto) {
    const input = await this.buildCalculationInput(dto);
    return { input, result: calculateQuote(input) };
  }

  /**
   * Monta a entrada do motor a partir do que veio da tela, completando taxas
   * pela apólice/cobertura e a cotação do câmbio pelo cadastro.
   */
  private async buildCalculationInput(
    dto: CalculateQuoteDto & { clientId?: string },
  ): Promise<CalculationInput> {
    const policy = dto.policyId
      ? await this.prisma.policy.findUnique({ where: { id: dto.policyId } })
      : null;

    const coverage = dto.coverageId
      ? await this.prisma.coverage.findUnique({ where: { id: dto.coverageId } })
      : null;

    const commodity = dto.commodityTypeId
      ? await this.prisma.commodityType.findUnique({ where: { id: dto.commodityTypeId } })
      : null;

    const isAir = dto.modal === 'AIR';

    /**
     * Taxa negociada com o cliente — "cada cliente tem uma taxa"
     * (docs/12-reuniao-cliente.md). Vence a cobertura e a apólice, e só perde
     * para o valor digitado na tela.
     */
    const clientRate = dto.clientId
      ? resolveClientRate(
          await this.prisma.clientRate.findMany({ where: { clientId: dto.clientId, active: true } }),
          {
            policyId: dto.policyId ?? null,
            coverageId: dto.coverageId ?? null,
            commodityTypeId: dto.commodityTypeId ?? null,
            modal: dto.modal,
            kind: dto.kind,
            date: dto.issueDate ? new Date(dto.issueDate) : new Date(),
          },
        )
      : null;

    // Precedência: taxa digitada > taxa do cliente > taxa da cobertura > taxa da apólice.
    const coverageClient = coverage
      ? Number(isAir ? coverage.airRateClient : coverage.seaRateClient)
      : 0;
    const coverageInsurer = coverage
      ? Number(isAir ? coverage.airRateInsurer : coverage.seaRateInsurer)
      : 0;

    const baseClient =
      dto.clientBaseRate ??
      (Number(clientRate?.rateClient ?? 0) ||
        coverageClient ||
        Number(policy?.baseRateClient ?? 0));

    const baseInsurer =
      dto.insurerBaseRate ??
      (Number(clientRate?.rateInsurer ?? 0) ||
        coverageInsurer ||
        Number(policy?.baseRateInsurer ?? 0));

    // Adicional sugerido pelo tipo de mercadoria, se o operador não informou.
    const commodityRate = commodity
      ? Number(isAir ? commodity.airRate : commodity.seaRoadRate)
      : 0;

    // Câmbio: usa a taxa cadastrada para a data, com fallback ao último dia útil.
    let exchangeRate = dto.exchangeRate ?? 0;
    if (!exchangeRate && dto.currencyId) {
      try {
        const found = await this.fx.rateFor(
          dto.currencyId,
          dto.issueDate ? new Date(dto.issueDate) : new Date(),
        );
        exchangeRate = found.rate;
      } catch {
        // Sem cotação cadastrada o cálculo segue; só os valores em R$ ficam zerados.
        exchangeRate = 0;
      }
    }

    return {
      kind: dto.kind,
      incoterm: dto.incoterm ?? null,
      irb: await this.irbInProcessCurrency(dto, exchangeRate),
      taxRates: { client: dto.taxRateClient ?? null, insurer: dto.taxRateInsurer ?? null },
      cost: dto.cost ?? 0,
      freight: dto.freight ?? 0,
      taxes: dto.taxes ?? 0,
      expensePercent: dto.expensePercent ?? 0,
      profitPercent: dto.profitPercent ?? 0,
      expensesCovered: dto.expensesCovered,
      expectedProfitCovered: dto.expectedProfitCovered,
      warStrike: dto.warStrike,
      minimumPremiumApplied: dto.minimumPremiumApplied,
      minimumPremium:
        dto.minimumPremium ??
        (clientRate?.minimumPremium != null
          ? Number(clientRate.minimumPremium)
          : Number(policy?.minimumPremium ?? 0)),
      clientRates: {
        base: baseClient,
        extra: dto.clientExtraRate ?? commodityRate,
        war: dto.clientWarRate ?? 0,
      },
      insurerRates: {
        base: baseInsurer,
        extra: dto.insurerExtraRate ?? 0,
        war: dto.insurerWarRate ?? 0,
      },
      vesselAdditionalPercent: dto.vesselAdditionalPercent ?? 0,
      exchangeRate,
      partnerPercent: dto.partnerPercent ?? 0,
      brokerPercent: dto.brokerPercent ?? 0,
      salespersonPercent: dto.salespersonPercent ?? 0,
      payableDiscountPercent:
        dto.payableDiscountPercent ?? (await this.resolvePayableDiscount(dto.kind, dto.clientId)),
    };
  }

  /**
   * IRB na moeda do processo. No legado ele é digitado em US$ na maioria dos
   * casos, com moeda própria; quando difere da moeda do processo, converte
   * pelas cotações do dia. Sem cotação, usa o valor como veio — melhor um IRB
   * na moeda errada visível na tela do que um IRB sumido do resultado.
   */
  private async irbInProcessCurrency(
    dto: CalculateQuoteDto,
    processRate: number,
  ): Promise<number> {
    const value = dto.irbValue ?? 0;
    if (!value || !dto.irbCurrencyId || dto.irbCurrencyId === dto.currencyId) return value;
    try {
      const date = dto.issueDate ? new Date(dto.issueDate) : new Date();
      const irbRate = (await this.fx.rateFor(dto.irbCurrencyId, date)).rate;
      return processRate > 0 ? (value * irbRate) / processRate : value;
    } catch {
      return value;
    }
  }

  /**
   * Agravo efetivo do processo: o negociado com o cliente, quando houver, e na
   * falta dele o parâmetro do ramo.
   *
   * O legado tinha um slot fixo "Importação Fresno" porque não sabia
   * representar exceção por cliente — era o agravo da FRESNOMAQ. Aqui a
   * exceção mora no cadastro do cliente e vale para qualquer um.
   */
  async resolvePayableDiscount(kind: QuoteKind, clientId?: string | null): Promise<number> {
    const client = clientId
      ? await this.prisma.company.findUnique({
          where: { id: clientId },
          select: { payableDiscountPercent: true },
        })
      : null;

    return this.settings.payableDiscountFor(kind, client?.payableDiscountPercent ?? null);
  }

  // -------------------------------------------------------------------------
  // Persistência
  // -------------------------------------------------------------------------

  async create(dto: SaveQuoteDto, user: AuthenticatedUser, ctx: RequestContext) {
    await this.assertClient(dto.clientId);
    const input = await this.buildCalculationInput(dto);
    const result = calculateQuote(input);

    const quote = await this.prisma.quote.create({
      data: {
        ...this.payload(dto),
        status: QuoteStatus.QUOTE,
        position: QuotePosition.OPEN_PROPOSAL,
        insuredAmount: result.insuredAmount,
        premiumClient: result.premiumClient,
        premiumInsurer: result.premiumInsurer,
        premiumCharged: result.premiumCharged,
        payableDiscountPercent: input.payableDiscountPercent ?? 0,
        payableDiscount: result.payableDiscount,
        insurerPayable: result.insurerPayable,
        exchangeRate: result.exchangeRate,
        insuredAmountBrl: result.insuredAmountBrl,
        premiumClientBrl: result.premiumClientBrl,
        premiumInsurerBrl: result.premiumInsurerBrl,
        calculatedAt: new Date(),
        createdById: user.id,
        updatedById: user.id,
        rateLines: { create: this.rateLinesData(result) },
      },
      include: detailInclude,
    });

    await this.audit.record({
      userId: user.id,
      action: 'quote_created',
      entity: 'Quote',
      entityId: quote.id,
      after: { number: quote.number, insuredAmount: result.insuredAmount },
      ...ctx,
    });

    return quote;
  }

  async update(id: string, dto: SaveQuoteDto, user: AuthenticatedUser, ctx: RequestContext) {
    const before = await this.findOne(id, user);

    // Uma cotação já convertida em averbação não volta a ser editada.
    if (before.status !== QuoteStatus.QUOTE) {
      throw new BadRequestException(
        'Esta cotação já virou averbação e não pode mais ser alterada.',
      );
    }
    if (before.position === QuotePosition.CANCELED) {
      throw new BadRequestException('Cotação cancelada não pode ser alterada.');
    }

    const input = await this.buildCalculationInput(dto);
    const result = calculateQuote(input);

    const after = await this.prisma.quote.update({
      where: { id },
      data: {
        ...this.payload(dto),
        insuredAmount: result.insuredAmount,
        premiumClient: result.premiumClient,
        premiumInsurer: result.premiumInsurer,
        premiumCharged: result.premiumCharged,
        payableDiscountPercent: input.payableDiscountPercent ?? 0,
        payableDiscount: result.payableDiscount,
        insurerPayable: result.insurerPayable,
        exchangeRate: result.exchangeRate,
        insuredAmountBrl: result.insuredAmountBrl,
        premiumClientBrl: result.premiumClientBrl,
        premiumInsurerBrl: result.premiumInsurerBrl,
        calculatedAt: new Date(),
        updatedById: user.id,
        rateLines: { deleteMany: {}, create: this.rateLinesData(result) },
      },
      include: detailInclude,
    });

    await this.audit.record({
      userId: user.id,
      action: 'quote_updated',
      entity: 'Quote',
      entityId: id,
      before: {
        insuredAmount: before.insuredAmount,
        premiumClient: before.premiumClient,
        premiumInsurer: before.premiumInsurer,
      },
      after: {
        insuredAmount: result.insuredAmount,
        premiumClient: result.premiumClient,
        premiumInsurer: result.premiumInsurer,
      },
      ...ctx,
    });

    return after;
  }

  /** Aprova ou reprova a cotação — o legado tinha `aprovaTransacao`/`reprovarTransacao`. */
  async decide(
    id: string,
    approved: boolean,
    reason: string | undefined,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ) {
    const quote = await this.findOne(id, user);

    if (quote.status !== QuoteStatus.QUOTE) {
      throw new BadRequestException('Só cotações em aberto podem ser aprovadas ou reprovadas.');
    }
    if (quote.position !== QuotePosition.OPEN_PROPOSAL) {
      throw new BadRequestException(
        `Esta cotação já está como "${quote.position}" e não aguarda decisão.`,
      );
    }
    if (approved && Number(quote.insuredAmount) <= 0) {
      throw new BadRequestException(
        'Não é possível aprovar uma cotação sem importância segurada. Informe os valores e recalcule.',
      );
    }

    const updated = await this.prisma.quote.update({
      where: { id },
      data: {
        position: approved ? QuotePosition.APPROVED : QuotePosition.REJECTED,
        internalNotes: reason
          ? `${quote.internalNotes ? `${quote.internalNotes}\n` : ''}${
              approved ? 'Aprovada' : 'Reprovada'
            }: ${reason}`
          : quote.internalNotes,
        updatedById: user.id,
      },
      include: detailInclude,
    });

    await this.audit.record({
      userId: user.id,
      action: approved ? 'quote_approved' : 'quote_rejected',
      entity: 'Quote',
      entityId: id,
      before: { position: quote.position },
      after: { position: updated.position, reason },
      ...ctx,
    });

    return updated;
  }

  async cancel(id: string, reason: string, user: AuthenticatedUser, ctx: RequestContext) {
    const quote = await this.findOne(id, user);

    if (quote.status !== QuoteStatus.QUOTE) {
      throw new BadRequestException(
        'Cotações que já viraram averbação não podem ser canceladas por aqui.',
      );
    }

    const updated = await this.prisma.quote.update({
      where: { id },
      data: { position: QuotePosition.CANCELED, updatedById: user.id },
      include: detailInclude,
    });

    await this.audit.record({
      userId: user.id,
      action: 'quote_canceled',
      entity: 'Quote',
      entityId: id,
      after: { reason },
      ...ctx,
    });

    return updated;
  }

  // -------------------------------------------------------------------------

  private rateLinesData(result: ReturnType<typeof calculateQuote>) {
    return result.lines.map((line) => ({
      item: line.item as RateLineItem,
      amount: line.amount,
      baseRateClient: line.client.base,
      extraRateClient: line.client.extra,
      warRateClient: line.client.war,
      premiumClient: line.client.premium,
      baseRateInsurer: line.insurer.base,
      extraRateInsurer: line.insurer.extra,
      warRateInsurer: line.insurer.war,
      premiumInsurer: line.insurer.premium,
    }));
  }

  private payload(dto: SaveQuoteDto): any {
    return {
      kind: dto.kind,
      issueDate: dto.issueDate ? new Date(dto.issueDate) : undefined,
      pendingLimitDate: dto.pendingLimitDate ? new Date(dto.pendingLimitDate) : null,
      policyId: dto.policyId ?? null,
      insurerId: dto.insurerId ?? null,
      clientId: dto.clientId,
      partnerId: dto.partnerId ?? null,
      singleProvisional: dto.singleProvisional ?? false,
      contactName: dto.contactName ?? null,
      contactPhone: dto.contactPhone ?? null,
      contactEmail: dto.contactEmail ?? null,

      modal: dto.modal,
      originCountryId: dto.originCountryId ?? null,
      originStateName: dto.originStateName ?? null,
      originCityName: dto.originCityName ?? null,
      originPortId: dto.originPortId ?? null,
      departureForecast: dto.departureForecast ? new Date(dto.departureForecast) : null,

      destinationCountryId: dto.destinationCountryId ?? null,
      destinationStateName: dto.destinationStateName ?? null,
      destinationCityName: dto.destinationCityName ?? null,
      destinationPortId: dto.destinationPortId ?? null,

      commodityDescription: dto.commodityDescription ?? null,
      notes: dto.notes ?? null,
      internalNotes: dto.internalNotes ?? null,
      cargoCondition: dto.cargoCondition ?? 'NEW',
      ncm: dto.ncm ?? null,
      brand: dto.brand ?? null,
      weightKg: dto.weightKg ?? 0,
      invoiceNumber: dto.invoiceNumber ?? null,
      commodityTypeId: dto.commodityTypeId ?? null,
      coverageId: dto.coverageId ?? null,
      packagingId: dto.packagingId ?? null,

      incoterm: dto.incoterm ?? 'CFR',
      currencyId: dto.currencyId,
      overPercent: dto.overPercent ?? 0,
      reference: dto.reference ?? null,
      billingVia: dto.billingVia ?? 'BROKER',
      budgetMode: dto.budgetMode ?? 'RATES',
      declaredValue: dto.declaredValue ?? 'DECLARED',

      clientDiscount: dto.clientDiscount ?? 0,
      insurerDiscount: dto.insurerDiscount ?? 0,
      expensePercent: dto.expensePercent ?? 0,
      profitPercent: dto.profitPercent ?? 0,

      standardDiscount: dto.standardDiscount ?? 0,
      letterAdditionalPercent: dto.letterAdditionalPercent ?? 0,
      vesselAdditionalPercent: dto.vesselAdditionalPercent ?? 0,
      irbValue: dto.irbValue ?? 0,
      irbCurrencyId: dto.irbCurrencyId ?? null,
      taxRateClient: dto.taxRateClient ?? null,
      taxRateInsurer: dto.taxRateInsurer ?? null,

      salespersonId: dto.salespersonId ?? null,
      partnerPercent: dto.partnerPercent ?? 0,
      brokerPercent: dto.brokerPercent ?? 0,
      salespersonPercent: dto.salespersonPercent ?? 0,

      warStrike: dto.warStrike ?? false,
      machineryStoppage: dto.machineryStoppage ?? false,
      expensesCovered: dto.expensesCovered ?? false,
      expectedProfitCovered: dto.expectedProfitCovered ?? false,
      minimumPremiumApplied: dto.minimumPremiumApplied ?? false,
      transshipment: dto.transshipment ?? false,
      creditLetter: dto.creditLetter ?? false,

      taxImportDuty: dto.taxImportDuty ?? false,
      taxIpi: dto.taxIpi ?? false,
      taxIcms: dto.taxIcms ?? false,
      taxPis: dto.taxPis ?? false,
      taxCofins: dto.taxCofins ?? false,
    };
  }

  private async assertClient(clientId: string) {
    const client = await this.prisma.company.findUnique({
      where: { id: clientId },
      include: { roles: true },
    });
    if (!client) throw new BadRequestException('Cliente não encontrado.');
    if (!client.roles.some((r) => r.role === 'CLIENT')) {
      throw new BadRequestException(
        `"${client.legalName}" não tem o papel de cliente. Ajuste o cadastro da empresa.`,
      );
    }
    if (!client.active) {
      throw new BadRequestException(`"${client.legalName}" está inativa.`);
    }
  }

  // -------------------------------------------------------------------------
  // Referências externas
  // -------------------------------------------------------------------------

  /**
   * "Todos usam referências diferentes, às vezes pro mesmo processo."
   * Cada sistema (Pinho, SIGRA, cliente, parceiro) tem a sua.
   */
  async addReference(
    quoteId: string,
    dto: { source: string; label?: string; value: string },
    user: AuthenticatedUser,
    ctx: RequestContext,
  ) {
    await this.findOne(quoteId, user);

    const existing = await this.prisma.externalReference.findFirst({
      where: { quoteId, source: dto.source, value: dto.value },
    });
    if (existing) {
      throw new BadRequestException('Esta referência já está cadastrada no processo.');
    }

    const created = await this.prisma.externalReference.create({
      data: { quoteId, source: dto.source, label: dto.label ?? null, value: dto.value },
    });

    await this.audit.record({
      userId: user.id,
      action: 'quote_reference_added',
      entity: 'Quote',
      entityId: quoteId,
      after: { source: dto.source, value: dto.value },
      ...ctx,
    });

    return created;
  }

  async removeReference(
    quoteId: string,
    referenceId: string,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ) {
    await this.findOne(quoteId, user);

    const reference = await this.prisma.externalReference.findFirst({
      where: { id: referenceId, quoteId },
    });
    if (!reference) throw new NotFoundException('Referência não encontrada.');

    await this.prisma.externalReference.delete({ where: { id: referenceId } });
    await this.audit.record({
      userId: user.id,
      action: 'quote_reference_removed',
      entity: 'Quote',
      entityId: quoteId,
      before: { source: reference.source, value: reference.value },
      ...ctx,
    });

    return { ok: true };
  }

  /**
   * Busca um processo do SIGRA e traduz em sugestões de preenchimento do
   * formulário de nova cotação — botão "Puxar do SIGRA". Importação vem de
   * `imp_processo`; exportação, do agenciamento (`age_processo`). Não cria nem
   * altera nada; a referência só é gravada quando a cotação é salva.
   */
  async getSigraDraft(sigraId: number): Promise<QuoteSigraDraft> {
    this.assertSigraConfigured();
    const kind = await this.sigra.getKind(sigraId);
    if (!kind) throw new NotFoundException(`Processo ${sigraId} não encontrado no SIGRA.`);

    let draft: QuoteSigraDraft;
    if (kind === 'IMPORT') {
      const data = await this.sigra.getFullProcess(sigraId);
      if (!data.summary) throw new NotFoundException(`Processo ${sigraId} não encontrado no SIGRA.`);
      draft = mapSigraToQuoteDraft(data);
    } else if (kind === 'EXPORT_AGENCY') {
      const agency = await this.sigra.getAgencyProcess(sigraId);
      if (!agency) throw new NotFoundException(`Processo ${sigraId} não encontrado no SIGRA.`);
      draft = mapSigraAgencyToQuoteDraft(agency);
    } else {
      throw new BadRequestException(
        kind === 'EXPORT_CUSTOMS'
          ? `O processo ${sigraId} é de despacho de exportação no SIGRA. Os processos com seguro ficam no agenciamento — confira o número.`
          : `O processo ${sigraId} não é de importação nem de agenciamento no SIGRA.`,
      );
    }

    const [clientId, currencyId, origin, destinationCountryId] = await Promise.all([
      this.resolveSigraClient(draft.keys.clientDocument),
      this.resolveCurrencyByCode(draft.keys.currencyCode),
      this.resolveOriginFromLocode(draft.keys.originLocode),
      this.resolveCountryByName(draft.keys.destinationCountryName),
    ]);

    if (draft.keys.clientDocument && !clientId) {
      draft.missing = [
        `Cliente (${draft.info.clientName ?? draft.keys.clientDocument} não está no cadastro)`,
        ...draft.missing.filter((m) => m !== 'Cliente'),
      ];
    }

    return {
      ...draft,
      suggestion: { ...draft.suggestion, clientId, currencyId, ...origin, destinationCountryId },
    };
  }

  private assertSigraConfigured() {
    if (!this.sigra.isConfigured()) {
      throw new ServiceUnavailableException('A integração com o SIGRA não está configurada neste ambiente.');
    }
  }

  /**
   * Cliente do SIGRA (`processo.id_parceiro`) → nosso cadastro, pelo CNPJ.
   * Tenta o CNPJ completo; na falta, a raiz (8 dígitos) quando só um cliente a
   * tiver — matriz e filial costumam estar cadastradas separadas.
   */
  private async resolveSigraClient(document: string | null): Promise<string | null> {
    if (!document) return null;
    const isClient = { roles: { some: { role: 'CLIENT' as const } } };

    const exact = await this.prisma.company.findFirst({
      where: { document, active: true, ...isClient },
      select: { id: true },
    });
    if (exact) return exact.id;
    if (document.length !== 14) return null;

    const sameRoot = await this.prisma.company.findMany({
      where: { document: { startsWith: document.slice(0, 8) }, active: true, ...isClient },
      select: { id: true },
      take: 2,
    });
    return sameRoot.length === 1 ? sameRoot[0].id : null;
  }

  private async resolveCurrencyByCode(code: string | null): Promise<string | null> {
    if (!code) return null;
    const currency = await this.prisma.currency.findUnique({ where: { code }, select: { id: true } });
    return currency?.id ?? null;
  }

  private async resolveCountryByName(name: string | null): Promise<string | null> {
    if (!name) return null;
    const country = await this.prisma.country.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, active: true },
      select: { id: true },
    });
    return country?.id ?? null;
  }

  /**
   * `local_embarque` do SIGRA vem como `"<UN/LOCODE> - <nome>"` (ex.:
   * `"CNTAO - TSINGTAO"`). O prefixo é o próprio código UN/LOCODE — casa com o
   * nosso catálogo de portos/países quando existir; senão fica `null` (o
   * operador escolhe manualmente, o catálogo tem só os portos mais usados).
   */
  private async resolveOriginFromLocode(locode: string | null) {
    if (!locode) return { originCountryId: null, originPortId: null };

    const [country, port] = await Promise.all([
      this.prisma.country.findFirst({ where: { iso2: locode.slice(0, 2) } }),
      this.prisma.port.findFirst({ where: { code: locode } }),
    ]);

    return { originCountryId: country?.id ?? null, originPortId: port?.id ?? null };
  }

  /**
   * Id do processo SIGRA da cotação: a referência externa `SIGRA` quando
   * existir; senão o número de 7 dígitos dentro da referência livre, que é como
   * o legado sempre registrou (docs/21, rodada 8).
   */
  private async sigraIdFor(quote: { id: string; reference: string | null }) {
    const link = await this.prisma.externalReference.findFirst({
      where: { quoteId: quote.id, source: 'SIGRA' },
    });
    const fromLink = link ? extractSigraId(link.value) ?? (Number(link.value) || null) : null;
    if (fromLink) return { sigraId: fromLink, linkedBy: 'link' as const };

    const fromReference = extractSigraId(quote.reference);
    return fromReference ? { sigraId: fromReference, linkedBy: 'reference' as const } : null;
  }

  /** Dados brutos do processo de importação no SIGRA vinculado à cotação (`null` sem vínculo). */
  async getSigraData(quoteId: string, user: AuthenticatedUser) {
    const quote = await this.findOne(quoteId, user);
    const found = await this.sigraIdFor(quote);
    if (!found) return null;
    this.assertSigraConfigured();
    return this.sigra.getFullProcess(found.sigraId);
  }

  /**
   * Resumo do processo SIGRA vinculado à cotação, para o cartão "Processo no
   * SIGRA" e para a sugestão de data de chegada na definitiva. Nunca lança por
   * ausência de vínculo ou de integração — devolve o estado para a tela.
   */
  async getSigraOverview(quoteId: string, user: AuthenticatedUser) {
    const quote = await this.findOne(quoteId, user);
    const found = await this.sigraIdFor(quote);
    if (!found) return { status: 'unlinked' as const };
    if (!this.sigra.isConfigured()) return { status: 'unavailable' as const, sigraId: found.sigraId };

    const kind = await this.sigra.getKind(found.sigraId);
    if (!kind) return { status: 'not_found' as const, sigraId: found.sigraId, linkedBy: found.linkedBy };

    const documents = await this.sigra.getDocuments(found.sigraId);
    const base = { status: 'ok' as const, sigraId: found.sigraId, linkedBy: found.linkedBy, kind, documents };

    if (kind === 'IMPORT') {
      const summary = await this.sigra.getSummary(found.sigraId);
      return {
        ...base,
        code: summary?.codigo ?? null,
        clientName: summary?.clientName ?? null,
        arrivalDate: summary?.arrivalDate ?? null,
        arrivalSource: 'Chegada ao Brasil (CCT)',
        departureDate: summary?.dtEmbarque ? new Date(summary.dtEmbarque).toISOString().slice(0, 10) : null,
        documentNumber: summary?.docCarga ?? null,
        vessel: null,
      };
    }
    if (kind === 'EXPORT_AGENCY') {
      const agency = await this.sigra.getAgencyProcess(found.sigraId);
      const draft = agency ? mapSigraAgencyToQuoteDraft(agency) : null;
      return {
        ...base,
        code: agency?.codigo ?? null,
        clientName: agency?.clientName ?? null,
        arrivalDate: agency?.arrivalDate ?? null,
        arrivalSource: 'Chegada ao destino (agenciamento)',
        departureDate: agency?.departureDate ?? null,
        documentNumber: agency?.documentNumber ?? null,
        vessel: draft?.info.vessel ?? null,
      };
    }
    return { ...base, code: null, clientName: null, arrivalDate: null, arrivalSource: null, departureDate: null, documentNumber: null, vessel: null };
  }

  /** Busca um processo por qualquer uma das referências cadastradas. */
  async findByReference(value: string, user: AuthenticatedUser) {
    const references = await this.prisma.externalReference.findMany({
      where: { value: { contains: value, mode: 'insensitive' }, quote: this.scopeFor(user) },
      include: {
        quote: {
          select: {
            id: true,
            number: true,
            kind: true,
            status: true,
            client: { select: { legalName: true, tradeName: true } },
          },
        },
      },
      take: 20,
    });

    return references;
  }

  /** Totais para o painel de acompanhamento. */
  async summary(user: AuthenticatedUser) {
    const where = this.scopeFor(user);

    const [open, approved, pendingLimit] = await Promise.all([
      this.prisma.quote.count({
        where: { ...where, status: QuoteStatus.QUOTE, position: QuotePosition.OPEN_PROPOSAL },
      }),
      this.prisma.quote.count({
        where: { ...where, status: QuoteStatus.QUOTE, position: QuotePosition.APPROVED },
      }),
      this.prisma.quote.count({
        where: {
          ...where,
          status: QuoteStatus.QUOTE,
          position: { in: [QuotePosition.OPEN_PROPOSAL, QuotePosition.APPROVED] },
          pendingLimitDate: { lt: new Date() },
        },
      }),
    ]);

    return { open, approved, overduePendingLimit: pendingLimit };
  }
}
