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

    const [items, total] = await Promise.all([
      this.prisma.exchangeRate.findMany({
        where,
        include: { currency: { select: { id: true, code: true, name: true } } },
        orderBy: [{ date: 'desc' }, { currency: { code: 'asc' } }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.exchangeRate.count({ where }),
    ]);

    return { items, total, page, perPage, pages: Math.ceil(total / perPage) };
  }

  /**
   * Taxa vigente para uma moeda numa data. Se não houver lançamento no dia
   * (fim de semana, feriado), usa o último dia útil anterior — o legado
   * simplesmente não tinha cotação e o cálculo parava.
   */
  async rateFor(currencyId: string, date = new Date()) {
    const currency = await this.prisma.currency.findUnique({ where: { id: currencyId } });
    if (!currency) throw new NotFoundException('Moeda não encontrada.');

    // Real não converte.
    if (currency.code === 'BRL') return { rate: 1, date, source: 'BRL', fallback: false };

    const exact = await this.prisma.exchangeRate.findUnique({
      where: { date_currencyId: { date: this.startOfDay(date), currencyId } },
    });
    if (exact) {
      return { rate: Number(exact.rate), date: exact.date, source: exact.source, fallback: false };
    }

    const previous = await this.prisma.exchangeRate.findFirst({
      where: { currencyId, date: { lte: this.startOfDay(date) } },
      orderBy: { date: 'desc' },
    });
    if (!previous) {
      throw new BadRequestException(
        `Não há cotação cadastrada para ${currency.code}. Importe a PTAX ou lance manualmente.`,
      );
    }

    return {
      rate: Number(previous.rate),
      date: previous.date,
      source: previous.source,
      fallback: true,
    };
  }

  async upsert(dto: UpsertRateDto, authorId: string, ctx: RequestContext) {
    const date = this.startOfDay(new Date(dto.date));

    const rate = await this.prisma.exchangeRate.upsert({
      where: { date_currencyId: { date, currencyId: dto.currencyId } },
      update: { rate: dto.rate, source: 'MANUAL' },
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

        for (const quote of quotes) {
          const date = this.startOfDay(new Date(quote.dataHoraCotacao));
          // `cotacaoVenda` é a referência usada para conversão de importação.
          const value = quote.cotacaoVenda;
          if (!value) continue;

          await this.prisma.exchangeRate.upsert({
            where: { date_currencyId: { date, currencyId: currency.id } },
            update: { rate: value, source: 'PTAX' },
            create: { date, currencyId: currency.id, rate: value, source: 'PTAX' },
          });
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
