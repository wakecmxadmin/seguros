import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Cron } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { RequestContext } from '../auth/auth.service';
import { ListRatesDto, UpsertRateDto } from './dto/fx.dto';

/**
 * Endpoint público de cotações do Banco Central (Olinda / PTAX).
 * Substitui o lançamento manual diário do legado — ver docs/10-dores-e-melhorias.md (item 3).
 */
const PTAX_BASE =
  'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaPeriodo';

/** Moedas com cotação publicada pelo BCB. */
const PTAX_SUPPORTED = new Set([
  'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'SEK', 'NOK', 'DKK', 'CNY',
]);

/**
 * Moedas com a fórmula da taxa oficial da corretora confirmada (tarefa 48):
 * PTAX do dia + 6%. É essa taxa — não a PTAX pura — que a corretora usa para
 * fechar câmbio, e é ela que entra no cálculo de prêmio.
 */
const OFFICIAL_MARKUP_CURRENCIES = new Set(['USD', 'EUR', 'CHF', 'JPY', 'GBP']);
const OFFICIAL_MARKUP = 1.06;

/** Prioridade de fonte ao escolher a cotação vigente de uma data. */
const SOURCE_PRIORITY = ['MANUAL', 'OFICIAL', 'PTAX'];

@Injectable()
export class FxService {
  private readonly logger = new Logger(FxService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private http: HttpService,
  ) {}

  /**
   * Reimporta os últimos dias todo dia útil às 14h (horário de Brasília) —
   * a PTAX do BCB costuma ser publicada por volta das 13h. A janela de 5 dias
   * cobre feriados e eventuais falhas do agendamento sem risco de duplicar
   * nada, já que `importPtax` faz upsert por data e moeda.
   */
  @Cron('0 0 14 * * 1-5', { name: 'ptax-daily-import', timeZone: 'America/Sao_Paulo' })
  async importPtaxDaily() {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 5);

    const result = await this.importPtax(
      { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
      undefined,
      {},
    );
    this.logger.log(`Importação diária da PTAX: ${result.total} cotação(ões) atualizada(s).`);
  }

  async list(filters: ListRatesDto) {
    const page = filters.page ?? 1;
    const perPage = Math.min(filters.perPage ?? 60, 400);

    const where = {
      ...(filters.currencyId ? { currencyId: filters.currencyId } : {}),
      ...(filters.from || filters.to
        ? {
            date: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(filters.to ? { lte: new Date(filters.to) } : {}),
            },
          }
        : {}),
    };

    const rows = await this.prisma.exchangeRate.findMany({
      where,
      include: { currency: { select: { id: true, code: true, name: true } } },
    });

    // Uma linha por data/moeda: a PTAX pura (`baseRate`) e a taxa efetivamente
    // usada no cálculo (`appliedRate` — oficial +6% ou lançamento manual, quando
    // houver) convivem na mesma linha em vez de aparecerem duplicadas.
    const groups = new Map<
      string,
      {
        date: Date;
        currency: { id: string; code: string; name: string };
        ptax?: (typeof rows)[number];
        oficial?: (typeof rows)[number];
        manual?: (typeof rows)[number];
      }
    >();

    for (const row of rows) {
      const key = `${row.date.getTime()}_${row.currencyId}`;
      const group = groups.get(key) ?? { date: row.date, currency: row.currency };
      if (row.source === 'PTAX') group.ptax = row;
      else if (row.source === 'OFICIAL') group.oficial = row;
      else if (row.source === 'MANUAL') group.manual = row;
      groups.set(key, group);
    }

    const merged = Array.from(groups.values()).map((g) => {
      const applied = g.manual ?? g.oficial ?? null;
      const anyRow = (g.manual ?? g.oficial ?? g.ptax)!;
      return {
        id: anyRow.id,
        date: g.date,
        currency: g.currency,
        baseRate: g.ptax ? g.ptax.rate : null,
        appliedRate: applied ? applied.rate : null,
        appliedSource: g.manual ? ('MANUAL' as const) : g.oficial ? ('OFICIAL' as const) : null,
      };
    });

    // Moedas com taxa oficial confirmada (+6%, tarefa 48) sobem para o topo de
    // cada data — são as que entram no cálculo de prêmio; o resto segue alfabético.
    merged.sort((a, b) => {
      if (a.date.getTime() !== b.date.getTime()) return b.date.getTime() - a.date.getTime();
      const aMarkup = OFFICIAL_MARKUP_CURRENCIES.has(a.currency.code);
      const bMarkup = OFFICIAL_MARKUP_CURRENCIES.has(b.currency.code);
      if (aMarkup !== bMarkup) return aMarkup ? -1 : 1;
      return a.currency.code.localeCompare(b.currency.code);
    });

    const total = merged.length;
    const items = merged.slice((page - 1) * perPage, (page - 1) * perPage + perPage);

    return { items, total, page, perPage, pages: Math.ceil(total / perPage) };
  }

  /**
   * Taxa vigente para uma moeda numa data. Se não houver lançamento no dia
   * (fim de semana, feriado), usa o último dia útil anterior — o legado
   * simplesmente não tinha cotação e o cálculo parava.
   *
   * Pode haver mais de uma fonte cadastrada na mesma data (PTAX pura e
   * OFICIAL convivendo, por exemplo) — a escolhida segue `SOURCE_PRIORITY`:
   * lançamento manual sempre vence; na ausência dele, a taxa oficial
   * (PTAX + 6%, tarefa 48); só na ausência de ambas cai para a PTAX pura.
   */
  async rateFor(currencyId: string, date = new Date()) {
    const currency = await this.prisma.currency.findUnique({ where: { id: currencyId } });
    if (!currency) throw new NotFoundException('Moeda não encontrada.');

    // Real não converte.
    if (currency.code === 'BRL') return { rate: 1, date, source: 'BRL', fallback: false };

    const target = this.startOfDay(date);
    const exactRows = await this.prisma.exchangeRate.findMany({ where: { currencyId, date: target } });
    if (exactRows.length) {
      const picked = this.pickBySource(exactRows);
      return { rate: Number(picked.rate), date: picked.date, source: picked.source, fallback: false };
    }

    const lastDate = await this.prisma.exchangeRate.findFirst({
      where: { currencyId, date: { lte: target } },
      orderBy: { date: 'desc' },
      select: { date: true },
    });
    if (!lastDate) {
      throw new BadRequestException(
        `Não há cotação cadastrada para ${currency.code}. Importe a PTAX ou lance manualmente.`,
      );
    }

    const previousRows = await this.prisma.exchangeRate.findMany({
      where: { currencyId, date: lastDate.date },
    });
    const picked = this.pickBySource(previousRows);

    return {
      rate: Number(picked.rate),
      date: picked.date,
      source: picked.source,
      fallback: true,
    };
  }

  private pickBySource<T extends { source: string }>(rows: T[]): T {
    for (const source of SOURCE_PRIORITY) {
      const found = rows.find((row) => row.source === source);
      if (found) return found;
    }
    return rows[0];
  }

  async upsert(dto: UpsertRateDto, authorId: string, ctx: RequestContext) {
    const date = this.startOfDay(new Date(dto.date));

    const rate = await this.prisma.exchangeRate.upsert({
      where: { date_currencyId_source: { date, currencyId: dto.currencyId, source: 'MANUAL' } },
      update: { rate: dto.rate },
      create: { date, currencyId: dto.currencyId, rate: dto.rate, source: 'MANUAL' },
      include: { currency: { select: { code: true } } },
    });

    await this.audit.record({
      userId: authorId,
      action: 'exchange_rate_set',
      entity: 'ExchangeRate',
      entityId: rate.id,
      after: { date, currency: rate.currency.code, rate: dto.rate },
      ...ctx,
    });

    return rate;
  }

  /**
   * Importa a PTAX do Banco Central para um intervalo.
   * Idempotente: relançar o mesmo período apenas atualiza os valores.
   */
  async importPtax(
    params: { from: string; to: string; currencyCodes?: string[] },
    authorId?: string,
    ctx: RequestContext = {},
  ) {
    const currencies = await this.prisma.currency.findMany({
      where: {
        active: true,
        code: { not: 'BRL', ...(params.currencyCodes ? { in: params.currencyCodes } : {}) },
      },
    });

    const results: Array<{ code: string; imported: number; skipped?: string }> = [];

    for (const currency of currencies) {
      if (!PTAX_SUPPORTED.has(currency.code)) {
        results.push({ code: currency.code, imported: 0, skipped: 'não publicada pelo BCB' });
        continue;
      }

      try {
        const quotes = await this.fetchPtax(currency.code, params.from, params.to);
        let imported = 0;
        const hasMarkup = OFFICIAL_MARKUP_CURRENCIES.has(currency.code);

        for (const quote of quotes) {
          const date = this.startOfDay(new Date(quote.dataHoraCotacao));
          // `cotacaoVenda` é a referência usada para conversão de importação.
          const value = quote.cotacaoVenda;
          if (!value) continue;

          await this.prisma.exchangeRate.upsert({
            where: { date_currencyId_source: { date, currencyId: currency.id, source: 'PTAX' } },
            update: { rate: value },
            create: { date, currencyId: currency.id, rate: value, source: 'PTAX' },
          });

          // Taxa oficial da corretora (tarefa 48): PTAX do dia + 6%. A PTAX
          // pura acima segue registrada como fonte auxiliar/comparação.
          if (hasMarkup) {
            const official = Number((value * OFFICIAL_MARKUP).toFixed(6));
            await this.prisma.exchangeRate.upsert({
              where: { date_currencyId_source: { date, currencyId: currency.id, source: 'OFICIAL' } },
              update: { rate: official },
              create: { date, currencyId: currency.id, rate: official, source: 'OFICIAL' },
            });
          }
          imported++;
        }

        results.push({ code: currency.code, imported });
      } catch (error) {
        this.logger.error(`Falha ao importar PTAX de ${currency.code}`, error as Error);
        results.push({ code: currency.code, imported: 0, skipped: 'erro na consulta ao BCB' });
      }
    }

    const total = results.reduce((acc, r) => acc + r.imported, 0);

    await this.audit.record({
      userId: authorId ?? null,
      action: 'exchange_rate_ptax_import',
      entity: 'ExchangeRate',
      after: {
        from: params.from,
        to: params.to,
        total,
        results,
        trigger: authorId ? 'manual' : 'automatic',
      },
      ...ctx,
    });

    return { ok: true, total, results };
  }

  private async fetchPtax(code: string, from: string, to: string) {
    const url =
      `${PTAX_BASE}(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)` +
      `?@moeda='${code}'&@dataInicial='${this.toUsDate(from)}'` +
      `&@dataFinalCotacao='${this.toUsDate(to)}'&$format=json&$select=cotacaoVenda,dataHoraCotacao`;

    const response = await firstValueFrom(this.http.get(url, { timeout: 20_000 }));
    return (response.data?.value ?? []) as Array<{
      cotacaoVenda: number;
      dataHoraCotacao: string;
    }>;
  }

  /** O Olinda espera MM-DD-YYYY. */
  private toUsDate(iso: string) {
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${m}-${d}-${y}`;
  }

  private startOfDay(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }
}
