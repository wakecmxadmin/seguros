import { EndorsementType, Prisma } from '@prisma/client';

/**
 * Layout do arquivo de remessa à seguradora, compartilhado pelo lote mensal e
 * pelo "Arquivo de Provisórias/Definitivas" (faixa de averbação + seguradora).
 *
 * As colunas seguem o que foi citado na reunião — nº do documento, navio,
 * data — mais os campos que o legado usava no arquivo de remessa.
 * **O layout definitivo ainda precisa ser confirmado com cada seguradora**
 * (ver novas_tarefas.md, item 28).
 */
export const csvEndorsementInclude = {
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
} satisfies Prisma.EndorsementInclude;

export type CsvEndorsement = Prisma.EndorsementGetPayload<{ include: typeof csvEndorsementInclude }>;

const HEADER = [
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

const isoDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');

// Ponto e vírgula + BOM: o Excel em pt-BR abre direto, sem assistente.
const escape = (value: string) => (/[";\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

export function endorsementsCsv(endorsements: CsvEndorsement[]) {
  const rows = endorsements.map((e) => [
    e.number,
    e.type === EndorsementType.PROVISIONAL ? 'Provisoria' : 'Definitiva',
    isoDate(e.issuedAt),
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
    isoDate(e.berthingDate),
  ]);

  const csv = [HEADER, ...rows]
    .map((row) => row.map((cell) => escape(String(cell))).join(';'))
    .join('\r\n');

  return `﻿${csv}`;
}

export const fileSlug = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

/** Parte numérica de "D-106493" — a faixa do legado é por número de averbação. */
export function endorsementNumberValue(number: string) {
  const digits = number.replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : NaN;
}
