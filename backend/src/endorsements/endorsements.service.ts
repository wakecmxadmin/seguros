import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EndorsementPosition,
  EndorsementType,
  Prisma,
  QuoteKind,
  QuotePosition,
  QuoteStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FxService } from '../fx/fx.service';
import { SettingsService } from '../settings/settings.service';
import type { RequestContext } from '../auth/auth.service';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import {
  ChangePositionDto,
  IssueFinalDto,
  IssueProvisionalDto,
  ListEndorsementsDto,
} from './dto/endorsements.dto';

const listInclude = {
  currency: { select: { id: true, code: true } },
  vessel: { select: { id: true, name: true } },
  quote: {
    select: {
      id: true,
      number: true,
      kind: true,
      modal: true,
      client: { select: { id: true, legalName: true, tradeName: true } },
      partner: { select: { id: true, legalName: true, tradeName: true } },
      insurer: { select: { id: true, legalName: true, tradeName: true } },
      policy: { select: { id: true, number: true } },
    },
  },
} satisfies Prisma.EndorsementInclude;

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

@Injectable()
export class EndorsementsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private fx: FxService,
    private settings: SettingsService,
  ) {}

  // -------------------------------------------------------------------------
  // Consulta
  // -------------------------------------------------------------------------

  async list(filters: ListEndorsementsDto, user: AuthenticatedUser) {
    const page = filters.page ?? 1;
    const perPage = Math.min(filters.perPage ?? 25, 200);

    const where: Prisma.EndorsementWhereInput = {
      quote: this.scopeFor(user),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.position ? { position: filters.position } : {}),
      ...(filters.kind ? { quote: { ...this.scopeFor(user), kind: filters.kind } } : {}),
      ...(filters.from || filters.to
        ? {
            issuedAt: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59`) } : {}),
            },
          }
        : {}),
      ...(filters.search
        ? {
            OR: [
              { number: { contains: filters.search, mode: 'insensitive' as const } },
              { blNumber: { contains: filters.search, mode: 'insensitive' as const } },
              { containerNumber: { contains: filters.search, mode: 'insensitive' as const } },
              {
                quote: {
                  client: {
                    legalName: { contains: filters.search, mode: 'insensitive' as const },
                  },
                },
              },
            ],
          }
        : {}),
      /// Só provisórias com saldo — usado pela tela de emissão de definitiva.
      ...(filters.withBalance === 'true'
        ? { type: EndorsementType.PROVISIONAL, balance: { gt: 0 } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.endorsement.findMany({
        where,
        include: listInclude,
        orderBy: { sequence: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.endorsement.count({ where }),
    ]);

    return {
      items: await this.withDeadlines(items),
      total,
      page,
      perPage,
      pages: Math.ceil(total / perPage),
    };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const endorsement = await this.prisma.endorsement.findFirst({
      where: { id, quote: this.scopeFor(user) },
      include: {
        ...listInclude,
        parent: { select: { id: true, number: true, balance: true } },
        children: {
          select: { id: true, number: true, insuredAmount: true, issuedAt: true, position: true },
          orderBy: { sequence: 'asc' },
        },
        positionHistory: { orderBy: { createdAt: 'desc' } },
        cashRequests: { orderBy: { createdAt: 'desc' } },
        commissions: {
          include: {
            company: { select: { id: true, legalName: true, tradeName: true } },
            employee: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!endorsement) throw new NotFoundException('Averbação não encontrada.');
    const [withDeadlines] = await this.withDeadlines([endorsement]);
    return withDeadlines;
  }

  /**
   * Prazos contados a partir da atracação (docs/12-reuniao-cliente.md):
   * TFA/liberação de avarias e liberação. Os dias são configuráveis porque a
   * regra exata ainda precisa de confirmação.
   */
  private async withDeadlines<T extends { berthingDate: Date | null }>(items: T[]) {
    const [tfaDays, releaseDays] = await Promise.all([
      this.settings.number('deadline.tfa_days'),
      this.settings.number('deadline.release_days'),
    ]);

    const today = new Date();

    return items.map((item) => {
      if (!item.berthingDate) {
        return { ...item, tfaDueDate: null, releaseDueDate: null, overdue: null };
      }

      const tfaDueDate = new Date(item.berthingDate);
      tfaDueDate.setDate(tfaDueDate.getDate() + tfaDays);

      const releaseDueDate = new Date(item.berthingDate);
      releaseDueDate.setDate(releaseDueDate.getDate() + releaseDays);

      return {
        ...item,
        tfaDueDate,
        releaseDueDate,
        overdue: {
          tfa: tfaDueDate < today,
          release: releaseDueDate < today,
        },
      };
    });
  }

  private scopeFor(user: AuthenticatedUser): Prisma.QuoteWhereInput {
    if (user.clientId) return { clientId: user.clientId };
    if (user.partnerId) return { partnerId: user.partnerId };
    return {};
  }

  // -------------------------------------------------------------------------
  // Emissão
  // -------------------------------------------------------------------------

  /**
   * Emite a provisória de uma cotação aprovada. A provisória abre o saldo que
   * as definitivas vão consumindo.
   */
  async issueProvisional(dto: IssueProvisionalDto, user: AuthenticatedUser, ctx: RequestContext) {
    const quote = await this.prisma.quote.findFirst({
      where: { id: dto.quoteId, ...this.scopeFor(user) },
      include: { currency: true },
    });
    if (!quote) throw new NotFoundException('Cotação não encontrada.');

    if (quote.status !== QuoteStatus.QUOTE) {
      throw new BadRequestException('Esta cotação já gerou averbação.');
    }
    if (quote.position !== QuotePosition.APPROVED) {
      throw new BadRequestException(
        'Só cotações aprovadas podem virar provisória. Aprove a cotação primeiro.',
      );
    }
    if (Number(quote.insuredAmount) <= 0) {
      throw new BadRequestException('A cotação não tem importância segurada.');
    }

    const number = await this.nextNumber(EndorsementType.PROVISIONAL, quote.kind);
    const insuredAmount = Number(quote.insuredAmount);

    const endorsement = await this.prisma.$transaction(async (tx) => {
      const created = await tx.endorsement.create({
        data: {
          number,
          type: EndorsementType.PROVISIONAL,
          position: EndorsementPosition.PENDING,
          quoteId: quote.id,
          issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : new Date(),
          berthingDate: dto.berthingDate ? new Date(dto.berthingDate) : null,
          blNumber: dto.blNumber ?? null,
          containerNumber: dto.containerNumber ?? null,
          vesselId: dto.vesselId ?? null,
          currencyId: quote.currencyId,
          insuredAmount,
          premiumClient: quote.premiumClient,
          premiumInsurer: quote.premiumInsurer,
          exchangeRate: quote.exchangeRate,
          insuredAmountBrl: quote.insuredAmountBrl,
          premiumClientBrl: quote.premiumClientBrl,
          // A provisória nasce com o saldo integral.
          balance: insuredAmount,
          balancePercent: 100,
          notes: dto.notes ?? null,
          createdById: user.id,
          positionHistory: {
            create: { to: EndorsementPosition.PENDING, userId: user.id, reason: 'Emissão' },
          },
        },
        include: listInclude,
      });

      await tx.quote.update({
        where: { id: quote.id },
        data: { status: QuoteStatus.PROVISIONAL, position: QuotePosition.PENDING },
      });

      return created;
    });

    await this.audit.record({
      userId: user.id,
      action: 'endorsement_provisional_issued',
      entity: 'Endorsement',
      entityId: endorsement.id,
      after: { number, insuredAmount },
      ...ctx,
    });

    return endorsement;
  }

  /**
   * Emite uma definitiva consumindo o saldo de uma provisória.
   * Uma provisória pode gerar várias definitivas até zerar o saldo.
   */
  async issueFinal(dto: IssueFinalDto, user: AuthenticatedUser, ctx: RequestContext) {
    const provisional = await this.prisma.endorsement.findFirst({
      where: { id: dto.provisionalId, quote: this.scopeFor(user) },
      include: { quote: { include: { currency: true } } },
    });
    if (!provisional) throw new NotFoundException('Provisória não encontrada.');

    if (provisional.type !== EndorsementType.PROVISIONAL) {
      throw new BadRequestException('A averbação de origem precisa ser uma provisória.');
    }
    if (provisional.position === EndorsementPosition.CANCELED) {
      throw new BadRequestException('Esta provisória está cancelada.');
    }

    // Trava de negócio: "só pode fazer a averbação quando a carga está atracada".
    const berthingDate = dto.berthingDate
      ? new Date(dto.berthingDate)
      : provisional.berthingDate;

    if (!berthingDate) {
      throw new BadRequestException(
        'Informe a data de atracação: a definitiva só pode ser emitida com a carga atracada.',
      );
    }
    if (berthingDate > new Date()) {
      throw new BadRequestException(
        'A data de atracação está no futuro. A carga ainda não atracou.',
      );
    }

    const balance = Number(provisional.balance);
    const amount = round(dto.insuredAmount);

    if (amount <= 0) {
      throw new BadRequestException('Informe a importância segurada da definitiva.');
    }
    if (amount > balance + 0.001) {
      throw new BadRequestException(
        `A definitiva (${amount.toFixed(2)}) excede o saldo da provisória (${balance.toFixed(2)}).`,
      );
    }

    // O prêmio da definitiva é proporcional à fatia consumida da provisória.
    const ratio = Number(provisional.insuredAmount) > 0
      ? amount / Number(provisional.insuredAmount)
      : 0;
    const premiumClient = round(Number(provisional.premiumClient) * ratio);
    const premiumInsurer = round(Number(provisional.premiumInsurer) * ratio);

    let exchangeRate = Number(provisional.exchangeRate);
    try {
      const found = await this.fx.rateFor(provisional.currencyId, new Date());
      exchangeRate = found.rate;
    } catch {
      // Mantém o câmbio da provisória se não houver cotação para hoje.
    }

    const number = await this.nextNumber(EndorsementType.FINAL, provisional.quote.kind);
    const newBalance = round(balance - amount);
    const newPercent = Number(provisional.insuredAmount) > 0
      ? round((newBalance / Number(provisional.insuredAmount)) * 100)
      : 0;

    const result = await this.prisma.$transaction(async (tx) => {
      const created = await tx.endorsement.create({
        data: {
          number,
          type: EndorsementType.FINAL,
          position: EndorsementPosition.FOLLOW_UP,
          quoteId: provisional.quoteId,
          parentId: provisional.id,
          issuedAt: new Date(),
          berthingDate,
          blNumber: dto.blNumber ?? provisional.blNumber,
          containerNumber: dto.containerNumber ?? provisional.containerNumber,
          vesselId: dto.vesselId ?? provisional.vesselId,
          currencyId: provisional.currencyId,
          insuredAmount: amount,
          premiumClient,
          premiumInsurer,
          exchangeRate,
          insuredAmountBrl: round(amount * exchangeRate),
          premiumClientBrl: round(premiumClient * exchangeRate),
          // A definitiva não abre saldo próprio.
          balance: 0,
          balancePercent: 0,
          notes: dto.notes ?? null,
          createdById: user.id,
          positionHistory: {
            create: { to: EndorsementPosition.FOLLOW_UP, userId: user.id, reason: 'Emissão' },
          },
        },
        include: listInclude,
      });

      await tx.endorsement.update({
        where: { id: provisional.id },
        data: {
          balance: newBalance,
          balancePercent: newPercent,
          // Saldo zerado encerra a provisória.
          position: newBalance <= 0.001 ? EndorsementPosition.SETTLED : provisional.position,
        },
      });

      if (newBalance <= 0.001) {
        await tx.quote.update({
          where: { id: provisional.quoteId },
          data: { status: QuoteStatus.FINAL, position: QuotePosition.FOLLOW_UP },
        });
      }

      return created;
    });

    // Comissões nascem junto com a definitiva, sobre o prêmio efetivamente emitido.
    await this.createCommissions(result.id, user.id);

    await this.audit.record({
      userId: user.id,
      action: 'endorsement_final_issued',
      entity: 'Endorsement',
      entityId: result.id,
      after: { number, insuredAmount: amount, provisional: provisional.number, newBalance },
      ...ctx,
    });

    return result;
  }

  /**
   * Rateia a comissão do prêmio entre parceiro, corretora e vendedor,
   * usando os percentuais definidos na cotação.
   */
  private async createCommissions(endorsementId: string, userId: string) {
    const endorsement = await this.prisma.endorsement.findUniqueOrThrow({
      where: { id: endorsementId },
      include: { quote: true },
    });

    const { quote } = endorsement;
    const premium = Number(endorsement.premiumClient);
    const rate = Number(endorsement.exchangeRate);

    const entries = [
      {
        beneficiary: 'PARTNER' as const,
        percent: Number(quote.partnerPercent),
        companyId: quote.partnerId,
        employeeId: null,
      },
      {
        beneficiary: 'BROKER' as const,
        percent: Number(quote.brokerPercent),
        companyId: null,
        employeeId: null,
      },
      {
        beneficiary: 'SALESPERSON' as const,
        percent: Number(quote.salespersonPercent),
        companyId: null,
        employeeId: quote.salespersonId,
      },
    ].filter((e) => e.percent > 0);

    for (const entry of entries) {
      const amount = round((premium * entry.percent) / 100);
      if (amount <= 0) continue;

      await this.prisma.commission.create({
        data: {
          endorsementId,
          beneficiary: entry.beneficiary,
          companyId: entry.companyId,
          employeeId: entry.employeeId,
          currencyId: endorsement.currencyId,
          premiumBase: premium,
          percent: entry.percent,
          amount,
          exchangeRate: rate,
          amountBrl: round(amount * rate),
          createdById: userId,
        },
      });
    }
  }

  // -------------------------------------------------------------------------
  // Posição
  // -------------------------------------------------------------------------

  async changePosition(
    id: string,
    dto: ChangePositionDto,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ) {
    const endorsement = await this.findOne(id, user);

    if (endorsement.position === dto.position) {
      throw new BadRequestException('A averbação já está nesta posição.');
    }
    if (endorsement.position === EndorsementPosition.CANCELED) {
      throw new BadRequestException('Averbação cancelada não muda de posição.');
    }
    if (dto.position === EndorsementPosition.CANCELED && !dto.reason) {
      throw new BadRequestException('Informe o motivo do cancelamento.');
    }

    // Cancelar uma definitiva devolve o valor ao saldo da provisória.
    const updated = await this.prisma.$transaction(async (tx) => {
      if (
        dto.position === EndorsementPosition.CANCELED &&
        endorsement.type === EndorsementType.FINAL &&
        endorsement.parentId
      ) {
        const parent = await tx.endorsement.findUniqueOrThrow({
          where: { id: endorsement.parentId },
        });
        const restored = round(Number(parent.balance) + Number(endorsement.insuredAmount));
        const percent = Number(parent.insuredAmount) > 0
          ? round((restored / Number(parent.insuredAmount)) * 100)
          : 0;

        await tx.endorsement.update({
          where: { id: parent.id },
          data: {
            balance: restored,
            balancePercent: percent,
            position: EndorsementPosition.PENDING,
          },
        });
      }

      return tx.endorsement.update({
        where: { id },
        data: {
          position: dto.position,
          positionHistory: {
            create: {
              from: endorsement.position,
              to: dto.position,
              reason: dto.reason ?? null,
              userId: user.id,
            },
          },
        },
        include: listInclude,
      });
    });

    await this.audit.record({
      userId: user.id,
      action: 'endorsement_position_changed',
      entity: 'Endorsement',
      entityId: id,
      before: { position: endorsement.position },
      after: { position: dto.position, reason: dto.reason },
      ...ctx,
    });

    return updated;
  }

  // -------------------------------------------------------------------------

  /**
   * Numeração observada no legado: `P-####` para provisória, `D-######` para
   * definitiva de importação e `E-#####` para definitiva de exportação.
   */
  private async nextNumber(type: EndorsementType, kind: QuoteKind) {
    const prefix =
      type === EndorsementType.PROVISIONAL ? 'P' : kind === QuoteKind.IMPORT ? 'D' : 'E';

    const last = await this.prisma.endorsement.findFirst({
      where: { number: { startsWith: `${prefix}-` } },
      orderBy: { sequence: 'desc' },
      select: { number: true },
    });

    const lastValue = last ? parseInt(last.number.split('-')[1], 10) : 0;
    const next = (Number.isFinite(lastValue) ? lastValue : 0) + 1;
    const width = prefix === 'P' ? 4 : prefix === 'D' ? 6 : 5;

    return `${prefix}-${String(next).padStart(width, '0')}`;
  }

  /** Totais para o painel de acompanhamento. */
  async summary(user: AuthenticatedUser) {
    const scope = { quote: this.scopeFor(user) };

    const [pending, withBalance, followUp] = await Promise.all([
      this.prisma.endorsement.count({
        where: { ...scope, type: EndorsementType.PROVISIONAL, position: EndorsementPosition.PENDING },
      }),
      this.prisma.endorsement.count({
        where: { ...scope, type: EndorsementType.PROVISIONAL, balance: { gt: 0 } },
      }),
      this.prisma.endorsement.count({
        where: { ...scope, type: EndorsementType.FINAL, position: EndorsementPosition.FOLLOW_UP },
      }),
    ]);

    // Averbações com prazo de TFA vencido — a contagem começa na atracação.
    const tfaDays = await this.settings.number('deadline.tfa_days');
    const limit = new Date();
    limit.setDate(limit.getDate() - tfaDays);

    const overdueTfa = await this.prisma.endorsement.count({
      where: {
        ...scope,
        position: { in: [EndorsementPosition.PENDING, EndorsementPosition.FOLLOW_UP] },
        berthingDate: { not: null, lt: limit },
      },
    });

    return {
      pendingProvisionals: pending,
      provisionalsWithBalance: withBalance,
      finalsInFollowUp: followUp,
      overdueTfa,
    };
  }
}
