import { BadRequestException, Injectable } from '@nestjs/common';
import { EndorsementPosition, EndorsementType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { EndorsementSelectionDto } from './dto/endorsements.dto';
import {
  csvEndorsementInclude,
  endorsementNumberValue,
  endorsementsCsv,
  fileSlug,
} from './endorsement-csv';

/** Teto de segurança: uma faixa mal digitada não pode trazer a base inteira. */
const MAX_ROWS = 2000;

const printInclude = {
  ...csvEndorsementInclude,
  parent: { select: { number: true } },
  quote: {
    select: {
      ...csvEndorsementInclude.quote.select,
      reference: true,
      commodityDescription: true,
      commodityType: { select: { name: true } },
      insurer: { select: { id: true, legalName: true } },
      policy: { select: { number: true } },
    },
  },
} satisfies Prisma.EndorsementInclude;

const MODAL = { AIR: 'Aéreo', SEA: 'Marítimo', ROAD: 'Rodoviário', RAIL: 'Ferroviário' } as const;

/**
 * Impressão e arquivo de provisórias/definitivas por faixa (`ImpressaoProvisoria`,
 * `ImpressaoDefinitiva`, `ArquivoProvisoria`, `ArquivoDefinitiva` do legado).
 * No legado o PDF e o CSV vinham prontos do servidor, num layout que não
 * conseguimos ver sem gerar; aqui a relação sai dos dados do domínio e o CSV usa
 * o mesmo layout do lote mensal.
 */
@Injectable()
export class EndorsementOutputService {
  constructor(private prisma: PrismaService) {}

  private scopeFor(user: AuthenticatedUser): Prisma.QuoteWhereInput {
    if (user.clientId) return { clientId: user.clientId };
    if (user.partnerId) return { partnerId: user.partnerId };
    return {};
  }

  private async select<T extends Prisma.EndorsementInclude>(
    filters: EndorsementSelectionDto,
    user: AuthenticatedUser,
    include: T,
  ) {
    if (
      filters.numberFrom !== undefined &&
      filters.numberTo !== undefined &&
      filters.numberFrom > filters.numberTo
    ) {
      throw new BadRequestException('A averbação inicial é maior que a final.');
    }

    const rows = await this.prisma.endorsement.findMany({
      where: {
        type: filters.type,
        position: { not: EndorsementPosition.CANCELED },
        quote: {
          ...this.scopeFor(user),
          ...(filters.insurerId ? { insurerId: filters.insurerId } : {}),
          ...(filters.kind ? { kind: filters.kind } : {}),
        },
        ...(filters.from || filters.to
          ? {
              issuedAt: {
                ...(filters.from ? { gte: new Date(filters.from) } : {}),
                ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59`) } : {}),
              },
            }
          : {}),
      },
      include,
      orderBy: { sequence: 'asc' },
      take: MAX_ROWS + 1,
    });

    // A faixa é pela parte numérica ("D-106493" → 106493). Filtrar aqui evita
    // depender da largura do zero à esquerda, que muda quando a série cresce.
    const inRange = rows.filter((e) => {
      const value = endorsementNumberValue(e.number);
      if (filters.numberFrom !== undefined && !(value >= filters.numberFrom)) return false;
      if (filters.numberTo !== undefined && !(value <= filters.numberTo)) return false;
      return true;
    });

    if (inRange.length > MAX_ROWS) {
      throw new BadRequestException(
        `A seleção passa de ${MAX_ROWS} averbações. Restrinja a faixa, o período ou a seguradora.`,
      );
    }
    return inRange as Prisma.EndorsementGetPayload<{ include: T }>[];
  }

  async printData(filters: EndorsementSelectionDto, user: AuthenticatedUser) {
    const rows = await this.select(filters, user, printInclude);

    const insurer = filters.insurerId
      ? await this.prisma.company.findUnique({
          where: { id: filters.insurerId },
          select: { legalName: true },
        })
      : null;

    const items = rows.map((e) => ({
      id: e.id,
      number: e.number,
      provisional: e.parent?.number ?? null,
      issuedAt: e.issuedAt,
      berthingDate: e.berthingDate,
      quoteNumber: e.quote.number,
      kind: e.quote.kind,
      reference: e.quote.reference,
      client: e.quote.client.legalName,
      clientDocument: e.quote.client.document,
      insurer: e.quote.insurer?.legalName ?? null,
      policyNumber: e.quote.policy?.number ?? null,
      commodity: e.quote.commodityDescription || e.quote.commodityType?.name || null,
      origin: e.quote.originCountry?.name ?? null,
      destination: e.quote.destinationCountry?.name ?? null,
      modal: MODAL[e.quote.modal],
      blNumber: e.blNumber,
      vessel: e.vessel?.name ?? null,
      currencyCode: e.currency.code,
      insuredAmount: Number(e.insuredAmount),
      premiumInsurer: Number(e.premiumInsurer),
    }));

    // Totais por moeda: somar USD com EUR não tem significado.
    const totals = new Map<string, { currencyCode: string; count: number; insuredAmount: number; premiumInsurer: number }>();
    for (const item of items) {
      const t = totals.get(item.currencyCode) ?? {
        currencyCode: item.currencyCode,
        count: 0,
        insuredAmount: 0,
        premiumInsurer: 0,
      };
      t.count += 1;
      t.insuredAmount = Math.round((t.insuredAmount + item.insuredAmount) * 100) / 100;
      t.premiumInsurer = Math.round((t.premiumInsurer + item.premiumInsurer) * 100) / 100;
      totals.set(item.currencyCode, t);
    }

    return {
      type: filters.type,
      insurer: insurer?.legalName ?? null,
      filters,
      items,
      totals: [...totals.values()],
    };
  }

  async file(filters: EndorsementSelectionDto, user: AuthenticatedUser) {
    const rows = await this.select(filters, user, csvEndorsementInclude);
    if (!rows.length) throw new BadRequestException('Nenhuma averbação na seleção.');

    const insurer = filters.insurerId
      ? await this.prisma.company.findUnique({
          where: { id: filters.insurerId },
          select: { legalName: true, tradeName: true },
        })
      : null;

    const kind = filters.type === EndorsementType.PROVISIONAL ? 'provisorias' : 'definitivas';
    const range = [rows[0].number, rows[rows.length - 1].number].map(fileSlug).join('-a-');
    const who = insurer ? `-${fileSlug(insurer.tradeName ?? insurer.legalName)}` : '';

    return { filename: `${kind}-${range}${who}.csv`, content: endorsementsCsv(rows) };
  }
}
