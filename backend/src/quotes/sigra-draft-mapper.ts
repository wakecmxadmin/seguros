import type { Incoterm, Modal, QuoteKind } from '@prisma/client';
import type { SigraAgencyProcess, SigraFullProcess } from '../sigra/sigra-process.types';

/**
 * Tradução dos dados do SIGRA em sugestões para o formulário de cotação.
 * Função pura — os ids do nosso banco (cliente, moeda, país, porto) são
 * resolvidos depois pelo `QuotesService`, a partir das chaves que vêm aqui
 * (CNPJ, sigla ISO, UN/LOCODE, nome do país). Mapeamento: docs/21.
 */

export interface QuoteSigraDraft {
  sigraId: string;
  kind: QuoteKind;
  /** Sugestões para o formulário — tudo editável, nada é gravado sozinho. */
  suggestion: {
    modal: Modal | null;
    incoterm: Incoterm | null;
    weightKg: number | null;
    ncm: string | null;
    invoiceNumber: string | null;
    commodityDescription: string | null;
    /** Valor da mercadoria na moeda do processo (importação: FOB estrangeiro). */
    cost: number | null;
    freight: number | null;
    /** Soma II + IPI + PIS + COFINS — conferir antes de usar. */
    taxes: number | null;
    /** "<código Pinho>  <id SIGRA>", o formato que a referência já usa no legado. */
    reference: string | null;
    /** Resolvidos pelo `QuotesService`. */
    clientId: string | null;
    currencyId: string | null;
    originCountryId: string | null;
    originPortId: string | null;
    destinationCountryId: string | null;
  };
  /** Chaves para resolver os ids acima — não vão para o formulário. */
  keys: {
    clientDocument: string | null;
    currencyCode: string | null;
    originLocode: string | null;
    destinationCountryName: string | null;
  };
  /** Só informativo — exibir ao operador, nunca gravar direto num campo. */
  info: {
    clientName: string | null;
    documentNumber: string | null;
    ceMercante: string | null;
    departureDate: string | null;
    arrivalDate: string | null;
    vessel: string | null;
    origin: string | null;
    destination: string | null;
    exporterName: string | null;
    /**
     * Câmbio do próprio processo no SIGRA — NÃO aplicar como câmbio da cotação:
     * é a exceção da tarefa 49, sem decisão de negócio.
     */
    exchangeRate: number | null;
  };
  /** O que o SIGRA não tem e o operador precisa preencher. */
  missing: string[];
}

/** `global.sx_modal.id` → nosso `Modal`. 5 ("Meios próprios") não tem equivalente. */
const SIGRA_MODAL: Record<string, Modal> = {
  '1': 'SEA',
  '2': 'ROAD',
  '3': 'AIR',
  '7': 'RAIL',
};

const INCOTERMS = new Set<string>([
  'EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DAT', 'DDU', 'DDP', 'CI', 'DPU', 'OCV',
]);

export function modalFromSigra(modalId: string | null): Modal | null {
  return modalId ? (SIGRA_MODAL[modalId] ?? null) : null;
}

export function incotermFromSigra(code: string | null): Incoterm | null {
  const normalized = code?.trim().toUpperCase() ?? '';
  return INCOTERMS.has(normalized) ? (normalized as Incoterm) : null;
}

/**
 * Extrai o id do processo SIGRA de uma referência no formato do legado
 * (`FRES0579/26  1927944`, `KLE 116/2026  1925212`, `1935396`). O id é o
 * `pinho.processo.id`, um número de 7 dígitos (docs/21, rodada 8). Devolve o
 * último encontrado, que é onde o legado costuma colocá-lo.
 */
export function extractSigraId(text: string | null | undefined): number | null {
  if (!text) return null;
  const matches = text.match(/(?<!\d)[12]\d{6}(?!\d)/g);
  return matches ? Number(matches[matches.length - 1]) : null;
}

const toNumber = (value: string | null | undefined): number | null =>
  value === null || value === undefined || value === '' ? null : Number(value);

const digits = (value: string | null) => value?.replace(/\D/g, '') || null;

function referenceFor(codigo: string | null, sigraId: string) {
  return codigo ? `${codigo}  ${sigraId}` : sigraId;
}

/** Importação — `pinho.imp_processo` e satélites. */
export function mapSigraToQuoteDraft(data: SigraFullProcess): QuoteSigraDraft {
  const { summary, additions, items } = data;
  if (!summary) {
    throw new Error('mapSigraToQuoteDraft chamado sem summary.');
  }

  const ncm = additions[0]?.ncm ?? null;
  const commodityDescription =
    Array.from(
      new Set(items.map((item) => item.denominacao).filter((v): v is string => Boolean(v))),
    ).join(' / ') || null;

  const taxParts = [summary.vlIi, summary.vlIpi, summary.vlPis, summary.vlCofins].map(toNumber);
  const taxes = taxParts.every((v) => v === null)
    ? null
    : taxParts.reduce<number>((acc, v) => acc + (v ?? 0), 0);

  const modal =
    modalFromSigra(summary.modalId) ?? (/awb/i.test(summary.tipoConhecimento ?? '') ? 'AIR' : null);
  const locode = summary.localEmbarque?.split(' - ')[0]?.trim().toUpperCase() ?? '';

  const missing: string[] = [];
  if (!summary.clientDocument) missing.push('Cliente');
  if (!summary.currencyCode) missing.push('Moeda');
  if (summary.vlFobExt === null) missing.push('Valor da mercadoria');

  return {
    sigraId: summary.id,
    kind: 'IMPORT',
    suggestion: {
      modal,
      incoterm: incotermFromSigra(summary.incotermCode),
      weightKg: toNumber(summary.pesoBruto),
      ncm,
      invoiceNumber: summary.invoiceNumber ?? items[0]?.numeroInvoice ?? null,
      commodityDescription,
      cost: toNumber(summary.vlFobExt),
      freight: toNumber(summary.vlFreteExt),
      taxes,
      reference: referenceFor(summary.codigo, summary.id),
      clientId: null,
      currencyId: null,
      originCountryId: null,
      originPortId: null,
      destinationCountryId: null,
    },
    keys: {
      clientDocument: digits(summary.clientDocument),
      currencyCode: summary.currencyCode?.trim().toUpperCase() || null,
      originLocode: /^[A-Z]{5}$/.test(locode) ? locode : null,
      destinationCountryName: null,
    },
    info: {
      clientName: summary.clientName,
      documentNumber: summary.docCarga,
      ceMercante: summary.ceMercante,
      departureDate: summary.dtEmbarque ? new Date(summary.dtEmbarque).toISOString().slice(0, 10) : null,
      arrivalDate: summary.arrivalDate,
      vessel: null,
      origin: summary.localEmbarque,
      destination: null,
      exporterName: additions[0]?.nome ?? null,
      exchangeRate: toNumber(summary.vlTaxaDolar),
    },
    missing,
  };
}

/**
 * Exportação — `pinho.age_processo` (agenciamento). O SIGRA tem a logística,
 * mas não o valor da mercadoria nem o frete segurado (docs/21, rodada 11):
 * esses ficam para o operador.
 */
export function mapSigraAgencyToQuoteDraft(agency: SigraAgencyProcess): QuoteSigraDraft {
  // "NAIROBI - Quênia" → "Quênia"; "Caucedo" (sem país) → null.
  const destinationParts = agency.destination?.split(' - ') ?? [];
  const destinationCountryName =
    destinationParts.length > 1 ? destinationParts[destinationParts.length - 1].trim() : null;

  const missing = ['Valor da mercadoria', 'Frete'];
  if (!agency.clientDocument) missing.unshift('Cliente');
  missing.push('Moeda');

  return {
    sigraId: agency.id,
    kind: 'EXPORT',
    suggestion: {
      modal: modalFromSigra(agency.modalId),
      incoterm: incotermFromSigra(agency.incotermCode),
      weightKg: null,
      ncm: null,
      invoiceNumber: agency.clientReference,
      commodityDescription: null,
      cost: null,
      freight: null,
      taxes: null,
      reference: referenceFor(agency.codigo, agency.id),
      clientId: null,
      currencyId: null,
      originCountryId: null,
      originPortId: null,
      destinationCountryId: null,
    },
    keys: {
      clientDocument: digits(agency.clientDocument),
      currencyCode: null,
      originLocode: null,
      destinationCountryName,
    },
    info: {
      clientName: agency.clientName,
      documentNumber: agency.documentNumber,
      ceMercante: null,
      departureDate: agency.departureDate,
      arrivalDate: agency.arrivalDate,
      vessel:
        [agency.vesselName, agency.voyage].filter(Boolean).join(' · ') ||
        (agency.flight ? `Voo ${agency.flight}` : null),
      origin: agency.origin,
      destination: [agency.destination, agency.finalDestination].filter(Boolean).join(' → ') || null,
      exporterName: null,
      exchangeRate: null,
    },
    missing,
  };
}
