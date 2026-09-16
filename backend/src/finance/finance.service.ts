import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CashRequestStatus,
  CommissionStatus,
  EndorsementType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FxService } from '../fx/fx.service';
import type { RequestContext } from '../auth/auth.service';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import {
  CreateCashRequestDto,
  ListCashRequestsDto,
  ListCommissionsDto,
  PayCommissionsDto,
  RequestInvoiceDto,
  SettleCashRequestDto,
} from './dto/finance.dto';

const cashInclude = {
  currency: { select: { id: true, code: true } },
  endorsement: {
    select: {
      id: true,
      number: true,
      type: true,
      insuredAmount: true,
      quote: {
        select: {
          id: true,
          number: true,
          kind: true,
          client: { select: { id: true, legalName: true, tradeName: true } },
          partner: { select: { id: true, legalName: true, tradeName: true } },
          insurer: { select: { id: true, legalName: true, tradeName: true } },
        },
      },
    },
  },
} satisfies Prisma.CashRequestInclude;

const commissionInclude = {
  currency: { select: { id: true, code: true } },
  company: { select: { id: true, legalName: true, tradeName: true } },
  employee: { select: { id: true, name: true } },
  endorsement: {
    select: {
      id: true,
      number: true,
      quote: {
        select: {
          id: true,
          number: true,
          client: { select: { id: true, legalName: true, tradeName: true } },
        },
      },
    },
  },
} satisfies Prisma.CommissionInclude;

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

@Injectable()
export class FinanceService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private fx: FxService,
  ) {}

  private scopeFor(user: AuthenticatedUser): Prisma.QuoteWhereInput {
    if (user.clientId) return { clientId: user.clientId };
    if (user.partnerId) return { partnerId: user.partnerId };
    return {};
  }

  // =========================================================================
  // Numerário
  // =========================================================================

  async listCashRequests(filters: ListCashRequestsDto, user: AuthenticatedUser) {
    const page = filters.page ?? 1;
    const perPage = Math.min(filters.perPage ?? 35, 200);

    const where: Prisma.CashRequestWhereInput = {
      endorsement: { quote: this.scopeFor(user) },
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59`) } : {}),
            },
          }
        : {}),
      ...(filters.search
        ? {
            OR: [
              {
                endorsement: {
                  number: { contains: filters.search, mode: 'insensitive' as const },
                },
              },
              {
                endorsement: {
                  quote: {
                    client: {
                      legalName: { contains: filters.search, mode: 'insensitive' as const },
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [items, total, totals] = await Promise.all([
      this.prisma.cashRequest.findMany({
        where,
        include: cashInclude,
        orderBy: { sequence: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.cashRequest.count({ where }),
      this.prisma.cashRequest.aggregate({
        where,
        _sum: { amount: true, amountBrl: true },
      }),
    ]);

    return {
      items,
      total,
      page,
      perPage,
      pages: Math.ceil(total / perPage),
      totals: {
        amount: Number(totals._sum.amount ?? 0),
        amountBrl: Number(totals._sum.amountBrl ?? 0),
      },
    };
  }

  /** Definitivas que ainda não têm numerário — a fila de trabalho da tela. */
  async pendingEndorsements(user: AuthenticatedUser) {
    const items = await this.prisma.endorsement.findMany({
      where: {
        quote: this.scopeFor(user),
        type: EndorsementType.FINAL,
        position: { not: 'CANCELED' },
        cashRequests: { none: { status: { not: CashRequestStatus.CANCELED } } },
      },
      include: {
        currency: { select: { id: true, code: true } },
        quote: {
          select: {
            id: true,
            number: true,
            kind: true,
            client: { select: { id: true, legalName: true, tradeName: true } },
            insurer: { select: { id: true, legalName: true, tradeName: true } },
          },
        },
      },
      orderBy: { sequence: 'desc' },
      take: 200,
    });

    return items;
  }

  /**
   * Cria o numerário de uma definitiva. O agravo entra aqui — é o acréscimo
   * sobre o valor devido à seguradora (ver docs/12-reuniao-cliente.md, item 6).
   */
  async createCashRequest(
    dto: CreateCashRequestDto,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ) {
    const endorsement = await this.prisma.endorsement.findFirst({
      where: { id: dto.endorsementId, quote: this.scopeFor(user) },
      include: { cashRequests: true },
    });
    if (!endorsement) throw new NotFoundException('Averbação não encontrada.');

    if (endorsement.type !== EndorsementType.FINAL) {
      throw new BadRequestException('O numerário é solicitado sobre a averbação definitiva.');
    }
    if (endorsement.position === 'CANCELED') {
      throw new BadRequestException('Averbação cancelada não gera numerário.');
    }

    const active = endorsement.cashRequests.filter(
      (c) => c.status !== CashRequestStatus.CANCELED,
    );
    if (active.length > 0) {
      throw new BadRequestException(
        `Esta averbação já tem numerário (${active.length} versão(ões)). Cancele o anterior para refazer.`,
      );
    }

    const premiumInsurer = Number(endorsement.premiumInsurer);
    const surchargePercent = dto.surchargePercent ?? 0;
    const surchargeAmount = round((premiumInsurer * surchargePercent) / 100);
    const amount = round(premiumInsurer + surchargeAmount);

    let exchangeRate = Number(endorsement.exchangeRate);
    try {
      const found = await this.fx.rateFor(endorsement.currencyId, new Date());
      exchangeRate = found.rate;
    } catch {
      // Sem cotação nova, mantém a da averbação.
    }

    const created = await this.prisma.cashRequest.create({
      data: {
        endorsementId: endorsement.id,
        version: endorsement.cashRequests.length + 1,
        currencyId: endorsement.currencyId,
        premiumInsurer,
        surchargePercent,
        surchargeAmount,
        amount,
        exchangeRate,
        amountBrl: round(amount * exchangeRate),
        chargeDate: dto.chargeDate ? new Date(dto.chargeDate) : null,
        notes: dto.notes ?? null,
        createdById: user.id,
      },
      include: cashInclude,
    });

    await this.audit.record({
      userId: user.id,
      action: 'cash_request_created',
      entity: 'CashRequest',
      entityId: created.id,
      after: { endorsement: endorsement.number, premiumInsurer, surchargePercent, amount },
      ...ctx,
    });

    return created;
  }

  /** Marca como enviado à seguradora, em lote. */
  async sendCashRequests(ids: string[], user: AuthenticatedUser, ctx: RequestContext) {
    if (!ids.length) throw new BadRequestException('Selecione ao menos um numerário.');

    const requests = await this.prisma.cashRequest.findMany({
      where: {
        id: { in: ids },
        endorsement: { quote: this.scopeFor(user) },
        status: CashRequestStatus.PENDING_SEND,
      },
    });
    if (!requests.length) {
      throw new BadRequestException('Nenhum numerário pendente de envio foi encontrado.');
    }

    const { count } = await this.prisma.cashRequest.updateMany({
      where: { id: { in: requests.map((r) => r.id) } },
      data: { status: CashRequestStatus.SENT, sentAt: new Date() },
    });

    await this.audit.record({
      userId: user.id,
      action: 'cash_request_sent',
      entity: 'CashRequest',
      after: { count, ids: requests.map((r) => r.id) },
      ...ctx,
    });

    return { ok: true, count };
  }

  /** Baixa: registra o pagamento recebido. */
  async settleCashRequest(
    id: string,
    dto: SettleCashRequestDto,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ) {
    const request = await this.prisma.cashRequest.findFirst({
      where: { id, endorsement: { quote: this.scopeFor(user) } },
    });
    if (!request) throw new NotFoundException('Numerário não encontrado.');

    if (request.status === CashRequestStatus.RECEIVED) {
      throw new BadRequestException('Este numerário já foi baixado.');
    }
    if (request.status === CashRequestStatus.CANCELED) {
      throw new BadRequestException('Numerário cancelado não pode ser baixado.');
    }

    const updated = await this.prisma.cashRequest.update({
      where: { id },
      data: {
        status: CashRequestStatus.RECEIVED,
        paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
        receivedAmountBrl: dto.receivedAmountBrl ?? request.amountBrl,
      },
      include: cashInclude,
    });

    await this.audit.record({
      userId: user.id,
      action: 'cash_request_settled',
      entity: 'CashRequest',
      entityId: id,
      before: { status: request.status },
      after: { status: 'RECEIVED', receivedAmountBrl: dto.receivedAmountBrl },
      ...ctx,
    });

    return updated;
  }

  async cancelCashRequest(id: string, user: AuthenticatedUser, ctx: RequestContext) {
    const request = await this.prisma.cashRequest.findFirst({
      where: { id, endorsement: { quote: this.scopeFor(user) } },
    });
    if (!request) throw new NotFoundException('Numerário não encontrado.');
    if (request.status === CashRequestStatus.RECEIVED) {
      throw new BadRequestException('Numerário já recebido não pode ser cancelado.');
    }

    const updated = await this.prisma.cashRequest.update({
      where: { id },
      data: { status: CashRequestStatus.CANCELED },
      include: cashInclude,
    });

    await this.audit.record({
      userId: user.id,
      action: 'cash_request_canceled',
      entity: 'CashRequest',
      entityId: id,
      ...ctx,
    });

    return updated;
  }

  // =========================================================================
  // Comissões
  // =========================================================================

  async listCommissions(filters: ListCommissionsDto, user: AuthenticatedUser) {
    const page = filters.page ?? 1;
    const perPage = Math.min(filters.perPage ?? 35, 200);

    const where: Prisma.CommissionWhereInput = {
      endorsement: { quote: this.scopeFor(user) },
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.beneficiary ? { beneficiary: filters.beneficiary } : {}),
      ...(filters.companyId ? { companyId: filters.companyId } : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59`) } : {}),
            },
          }
        : {}),
    };

    const [items, total, totals] = await Promise.all([
      this.prisma.commission.findMany({
        where,
        include: commissionInclude,
        orderBy: { sequence: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.commission.count({ where }),
      this.prisma.commission.aggregate({
        where,
        _sum: { amount: true, amountBrl: true },
      }),
    ]);

    return {
      items,
      total,
      page,
      perPage,
      pages: Math.ceil(total / perPage),
      totals: {
        amount: Number(totals._sum.amount ?? 0),
        amountBrl: Number(totals._sum.amountBrl ?? 0),
      },
    };
  }

  /** Solicita a nota fiscal ao favorecido, em lote. */
  async requestInvoices(dto: RequestInvoiceDto, user: AuthenticatedUser, ctx: RequestContext) {
    if (!dto.ids?.length) throw new BadRequestException('Selecione ao menos uma comissão.');

    const commissions = await this.prisma.commission.findMany({
      where: {
        id: { in: dto.ids },
        endorsement: { quote: this.scopeFor(user) },
        status: CommissionStatus.PENDING,
      },
    });
    if (!commissions.length) {
      throw new BadRequestException('Nenhuma comissão pendente foi encontrada na seleção.');
    }

    const { count } = await this.prisma.commission.updateMany({
      where: { id: { in: commissions.map((c) => c.id) } },
      data: { status: CommissionStatus.INVOICE_REQUESTED, invoiceRequestedAt: new Date() },
    });

    await this.audit.record({
      userId: user.id,
      action: 'commission_invoice_requested',
      entity: 'Commission',
      after: { count },
      ...ctx,
    });

    return { ok: true, count };
  }

  /** Registra o pagamento das comissões selecionadas. */
  async payCommissions(dto: PayCommissionsDto, user: AuthenticatedUser, ctx: RequestContext) {
    if (!dto.ids?.length) throw new BadRequestException('Selecione ao menos uma comissão.');

    const commissions = await this.prisma.commission.findMany({
      where: {
        id: { in: dto.ids },
        endorsement: { quote: this.scopeFor(user) },
        status: { in: [CommissionStatus.PENDING, CommissionStatus.INVOICE_REQUESTED] },
      },
    });
    if (!commissions.length) {
      throw new BadRequestException('Nenhuma comissão em aberto foi encontrada na seleção.');
    }

    const paymentDate = dto.paymentDate ? new Date(dto.paymentDate) : new Date();

    const { count } = await this.prisma.commission.updateMany({
      where: { id: { in: commissions.map((c) => c.id) } },
      data: {
        status: CommissionStatus.PAID,
        paymentDate,
        ...(dto.invoiceNumber ? { invoiceNumber: dto.invoiceNumber } : {}),
      },
    });

    await this.audit.record({
      userId: user.id,
      action: 'commission_paid',
      entity: 'Commission',
      after: { count, paymentDate, invoiceNumber: dto.invoiceNumber },
      ...ctx,
    });

    return { ok: true, count };
  }

  /**
   * Extrato de comissões agrupado por favorecido — o "extrato de comissão"
   * pedido na reunião (docs/12-reuniao-cliente.md, item 7).
   */
  async commissionStatement(filters: ListCommissionsDto, user: AuthenticatedUser) {
    const where: Prisma.CommissionWhereInput = {
      endorsement: { quote: this.scopeFor(user) },
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.beneficiary ? { beneficiary: filters.beneficiary } : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59`) } : {}),
            },
          }
        : {}),
    };

    const commissions = await this.prisma.commission.findMany({
      where,
      include: commissionInclude,
      orderBy: { createdAt: 'asc' },
    });

    // Agrupa por favorecido, mantendo o detalhe para conferência.
    const groups = new Map<
      string,
      {
        key: string;
        beneficiary: string;
        name: string;
        count: number;
        amount: number;
        amountBrl: number;
        pending: number;
        paid: number;
        items: typeof commissions;
      }
    >();

    for (const commission of commissions) {
      const name =
        commission.company?.tradeName ??
        commission.company?.legalName ??
        commission.employee?.name ??
        'Corretora';
      const key = `${commission.beneficiary}:${commission.companyId ?? commission.employeeId ?? 'broker'}`;

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          beneficiary: commission.beneficiary,
          name,
          count: 0,
          amount: 0,
          amountBrl: 0,
          pending: 0,
          paid: 0,
          items: [],
        });
      }

      const group = groups.get(key)!;
      group.count += 1;
      group.amount = round(group.amount + Number(commission.amount));
      group.amountBrl = round(group.amountBrl + Number(commission.amountBrl));
      if (commission.status === CommissionStatus.PAID) {
        group.paid = round(group.paid + Number(commission.amount));
      } else if (commission.status !== CommissionStatus.CANCELED) {
        group.pending = round(group.pending + Number(commission.amount));
      }
      group.items.push(commission);
    }

    const rows = [...groups.values()].sort((a, b) => b.amount - a.amount);

    return {
      rows,
      totals: {
        count: commissions.length,
        amount: round(rows.reduce((acc, r) => acc + r.amount, 0)),
        amountBrl: round(rows.reduce((acc, r) => acc + r.amountBrl, 0)),
        pending: round(rows.reduce((acc, r) => acc + r.pending, 0)),
        paid: round(rows.reduce((acc, r) => acc + r.paid, 0)),
      },
    };
  }

  /** Indicadores das telas financeiras. */
  async summary(user: AuthenticatedUser) {
    const scope = { endorsement: { quote: this.scopeFor(user) } };

    const [toSend, sent, commissionsPending] = await Promise.all([
      this.prisma.cashRequest.count({
        where: { ...scope, status: CashRequestStatus.PENDING_SEND },
      }),
      this.prisma.cashRequest.count({ where: { ...scope, status: CashRequestStatus.SENT } }),
      this.prisma.commission.count({
        where: {
          ...scope,
          status: { in: [CommissionStatus.PENDING, CommissionStatus.INVOICE_REQUESTED] },
        },
      }),
    ]);

    return { cashToSend: toSend, cashSent: sent, commissionsPending };
  }
}
