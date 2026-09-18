import type { SigraFullProcess } from '../sigra/sigra-process.types';

export interface QuoteSigraDraft {
  sigraId: string;
  /** Sugestões para o formulário — tudo editável, nada é gravado sozinho. */
  suggestion: {
    modal: 'AIR' | null;
    weightKg: number | null;
    ncm: string | null;
    invoiceNumber: string | null;
    commodityDescription: string | null;
    /** FOB em moeda estrangeira — vira a verba "Custo" quando `budgetMode: VALUES`. */
    cost: number | null;
    /** Frete em moeda estrangeira. */
    freight: number | null;
    /** Soma II + IPI + PIS + COFINS — conferir antes de usar, o legado trata "impostos" como um bloco só. */
    taxes: number | null;
    /** Resolvidos pelo `QuotesService` a partir do prefixo UN/LOCODE de `local_embarque` — ver ali. */
    originCountryId: string | null;
    originPortId: string | null;
  };
  /** Só informativo — exibir pro operador, nunca gravar direto num campo do formulário. */
  reference: {
    docCarga: string | null;
    ceMercante: string | null;
    dtEmbarque: Date | null;
    dtPresencaCarga: Date | null;
    /**
     * Câmbio do próprio processo no SIGRA — NÃO aplicar automaticamente como taxa
     * de câmbio da cotação: é a exceção da tarefa 49, ainda sem decisão de negócio.
     */
    exchangeRate: number | null;
    localEmbarque: string | null;
    exporterName: string | null;
  };
}

const toNumber = (value: string | null): number | null =>
  value === null || value === undefined ? null : Number(value);

/**
 * Traduz os dados brutos do SIGRA (já filtrados pelos campos confirmados, ver
 * docs/13-sigra-campos-necessarios.md) em sugestões para o formulário de cotação
 * de importação. Moeda, cliente e porto ficam de fora de propósito — não há
 * mapeamento confiável ainda (ver conversa da tarefa 44).
 */
export function mapSigraToQuoteDraft(data: SigraFullProcess): QuoteSigraDraft {
  const { summary, additions, items } = data;
  if (!summary) {
    throw new Error('mapSigraToQuoteDraft chamado sem summary.');
  }

  const ncm = additions[0]?.ncm ?? null;
  const invoiceNumber = items[0]?.numeroInvoice ?? null;
  const commodityDescription =
    Array.from(
      new Set(items.map((item) => item.denominacao).filter((v): v is string => Boolean(v))),
    ).join(' / ') || null;

  const taxParts = [summary.vlIi, summary.vlIpi, summary.vlPis, summary.vlCofins].map(toNumber);
  const taxes = taxParts.every((v) => v === null)
    ? null
    : taxParts.reduce<number>((acc, v) => acc + (v ?? 0), 0);

  return {
    sigraId: summary.id,
    suggestion: {
      modal: /awb/i.test(summary.tipoConhecimento ?? '') ? 'AIR' : null,
      weightKg: toNumber(summary.pesoBruto),
      ncm,
      invoiceNumber,
      commodityDescription,
      cost: toNumber(summary.vlFobExt),
      freight: toNumber(summary.vlFreteExt),
      taxes,
      originCountryId: null,
      originPortId: null,
    },
    reference: {
      docCarga: summary.docCarga,
      ceMercante: summary.ceMercante,
      dtEmbarque: summary.dtEmbarque,
      dtPresencaCarga: summary.dtPresencaCarga,
      exchangeRate: toNumber(summary.vlTaxaDolar),
      localEmbarque: summary.localEmbarque,
      exporterName: additions[0]?.nome ?? null,
    },
  };
}
