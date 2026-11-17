import { Injectable } from '@nestjs/common';
import { EndorsementPosition, EndorsementType, Prisma, QuotePosition, QuoteStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

/** Itens mostrados por grupo; o total vem à parte. */
const LIMIT = 50;
const DAY = 24 * 60 * 60 * 1000;

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY);

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const name = (c?: { legalName: string; tradeName: string | null } | null) =>
  c ? c.tradeName || c.legalName : null;

export interface AlertItem {
  id: string;
  /** Registro a abrir: cotação, averbação ou apólice. */
  target: { kind: 'quote' | 'endorsement' | 'policy'; id: string };
  title: string;
  subtitle: string | null;
  /** Data que motivou o alerta (vencimento, emissão, última alteração). */
  date: Date;
  overdue: boolean;
  detail: string;
}

export interface AlertGroup {
  key: 'deadlines' | 'provisionals' | 'quotes' | 'policies';
  title: string;
  description: string;
  total: number;
  items: AlertItem[];
}

/**
 * Pendências calculadas na hora, sem tabela própria (módulo `notifications` de
 * docs/07-modulos.md). O legado não tinha nada parecido: o operador descobria
 * prazo vencido abrindo processo por processo. Os limites ficam em Parâmetros.
 */
@Injectable()
export class AlertsService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
  ) {}

  private scopeFor(user: AuthenticatedUser): Prisma.QuoteWhereInput {
    if (user.clientId) return { clientId: user.clientId };
    if (user.partnerId) return { partnerId: user.partnerId };
    return {};
  }

  async list(user: AuthenticatedUser) {
    const can = (permission: string) => user.permissions.includes(permission);
    const groups: AlertGroup[] = [];
    if (can('endorsement:list')) {
      groups.push(await this.deadlines(user));
      groups.push(await this.provisionals(user));
    }
    if (can('quote:list')) groups.push(await this.quotes(user));
    // Apólice é cadastro interno: usuário de cliente/parceiro não vê.
    if (can('policy:list') && !user.clientId && !user.partnerId) groups.push(await this.policies());
    return { groups, total: groups.reduce((acc, g) => acc + g.total, 0) };
  }

  /**
   * TFA e prazo de averbação contados da atracação (mesma regra de
   * `EndorsementsService.withDeadlines`), vencidos ou vencendo em N dias.
   */
  private async deadlines(user: AuthenticatedUser): Promise<AlertGroup> {
    const [tfaDays, endorsementDays, warningDays] = await Promise.all([
      this.settings.number('deadline.tfa_days'),
      this.settings.number('deadline.endorsement_days'),
      this.settings.number('alerts.deadline_warning_days'),
    ]);

    const today = startOfToday();
    // Atracação a partir da qual algum dos prazos já cai dentro da janela.
    const latestBerthing = addDays(today, warningDays - Math.min(tfaDays, endorsementDays) + 1);

    const rows = await this.prisma.endorsement.findMany({
      where: {
        quote: this.scopeFor(user),
        position: { in: [EndorsementPosition.PENDING, EndorsementPosition.FOLLOW_UP] },
        berthingDate: { not: null, lt: latestBerthing },
      },
      select: {
        id: true,
        number: true,
        type: true,
        berthingDate: true,
        quote: { select: { number: true, client: { select: { legalName: true, tradeName: true } } } },
      },
      orderBy: { berthingDate: 'asc' },
    });

    const limit = addDays(today, warningDays + 1);
    const items: AlertItem[] = [];
    for (const e of rows) {
      const tfa = addDays(e.berthingDate!, tfaDays);
      const endorsement = addDays(e.berthingDate!, endorsementDays);
      // O prazo mais próximo é o que importa; ambos aparecem no detalhe.
      const due = tfa < endorsement ? tfa : endorsement;
      if (due >= limit) continue;
      const overdue = due < today;
      const label =
        tfa.getTime() === endorsement.getTime() ? 'TFA e averbação' : due === tfa ? 'TFA' : 'averbação';
      items.push({
        id: `deadline-${e.id}`,
        target: { kind: 'endorsement', id: e.id },
        title: `${e.number} · proc. ${e.quote.number}`,
        subtitle: name(e.quote.client),
        date: due,
        overdue,
        detail: overdue ? `prazo de ${label} vencido` : `prazo de ${label} vence em breve`,
      });
    }
    items.sort((a, b) => a.date.getTime() - b.date.getTime());

    return {
      key: 'deadlines',
      title: 'Prazos de TFA e averbação',
      description: `Contados da atracação. Aparecem ${warningDays} dia(s) antes de vencer.`,
      total: items.length,
      items: items.slice(0, LIMIT),
    };
  }

  private async provisionals(user: AuthenticatedUser): Promise<AlertGroup> {
    const days = await this.settings.number('alerts.provisional_without_final_days');
    const where: Prisma.EndorsementWhereInput = {
      quote: this.scopeFor(user),
      type: EndorsementType.PROVISIONAL,
      position: { not: EndorsementPosition.CANCELED },
      balance: { gt: 0 },
      children: { none: {} },
      issuedAt: { lt: addDays(startOfToday(), -days) },
    };

    const [total, rows] = await Promise.all([
      this.prisma.endorsement.count({ where }),
      this.prisma.endorsement.findMany({
        where,
        select: {
          id: true,
          number: true,
          issuedAt: true,
          quote: { select: { number: true, client: { select: { legalName: true, tradeName: true } } } },
        },
        orderBy: { issuedAt: 'asc' },
        take: LIMIT,
      }),
    ]);

    const today = startOfToday().getTime();
    return {
      key: 'provisionals',
      title: 'Provisórias sem definitiva',
      description: `Emitidas há mais de ${days} dias e ainda sem nenhuma definitiva.`,
      total,
      items: rows.map((e) => ({
        id: `provisional-${e.id}`,
        target: { kind: 'endorsement' as const, id: e.id },
        title: `${e.number} · proc. ${e.quote.number}`,
        subtitle: name(e.quote.client),
        date: e.issuedAt,
        overdue: true,
        detail: `emitida há ${Math.floor((today - e.issuedAt.getTime()) / DAY)} dias`,
      })),
    };
  }

  private async quotes(user: AuthenticatedUser): Promise<AlertGroup> {
    const days = await this.settings.number('alerts.stale_quote_days');
    const where: Prisma.QuoteWhereInput = {
      ...this.scopeFor(user),
      status: QuoteStatus.QUOTE,
      position: { in: [QuotePosition.OPEN_PROPOSAL, QuotePosition.APPROVED] },
      updatedAt: { lt: addDays(startOfToday(), -days) },
    };

    const [total, rows] = await Promise.all([
      this.prisma.quote.count({ where }),
      this.prisma.quote.findMany({
        where,
        select: {
          id: true,
          number: true,
          position: true,
          updatedAt: true,
          client: { select: { legalName: true, tradeName: true } },
        },
        orderBy: { updatedAt: 'asc' },
        take: LIMIT,
      }),
    ]);

    const today = startOfToday().getTime();
    return {
      key: 'quotes',
      title: 'Cotações paradas',
      description: `Em aberto ou aprovadas, sem alteração há mais de ${days} dias.`,
      total,
      items: rows.map((q) => ({
        id: `quote-${q.id}`,
        target: { kind: 'quote' as const, id: q.id },
        title: `Cotação ${q.number}`,
        subtitle: name(q.client),
        date: q.updatedAt,
        overdue: false,
        detail: `${q.position === QuotePosition.APPROVED ? 'aprovada, sem provisória' : 'proposta em aberto'} · parada há ${Math.floor((today - q.updatedAt.getTime()) / DAY)} dias`,
      })),
    };
  }

  private async policies(): Promise<AlertGroup> {
    const days = await this.settings.number('alerts.policy_expiry_days');
    const where: Prisma.PolicyWhereInput = {
      active: true,
      validTo: { not: null, lt: addDays(startOfToday(), days + 1) },
    };

    const [total, rows] = await Promise.all([
      this.prisma.policy.count({ where }),
      this.prisma.policy.findMany({
        where,
        select: {
          id: true,
          number: true,
          description: true,
          validTo: true,
          insurer: { select: { legalName: true, tradeName: true } },
        },
        orderBy: { validTo: 'asc' },
        take: LIMIT,
      }),
    ]);

    const today = startOfToday();
    return {
      key: 'policies',
      title: 'Apólices a vencer',
      description: `Ativas com fim de vigência nos próximos ${days} dias — ou já vencidas.`,
      total,
      items: rows.map((p) => {
        const overdue = p.validTo! < today;
        return {
          id: `policy-${p.id}`,
          target: { kind: 'policy' as const, id: p.id },
          title: `Apólice ${p.number}`,
          subtitle: [name(p.insurer), p.description].filter(Boolean).join(' · ') || null,
          date: p.validTo!,
          overdue,
          detail: overdue ? 'vigência encerrada e apólice ainda ativa' : 'vigência termina em breve',
        };
      }),
    };
  }
}
