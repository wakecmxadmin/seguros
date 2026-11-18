import { percentOf, roundHalfUpExact } from '../common/money';

/**
 * Contas da Planilha de Produção e dos rankings, por averbação definitiva.
 *
 * Fórmulas conferidas contra numerários pagos e rankings reais do legado
 * (docs/19-legado-validacoes.md):
 *
 *   A pagar c/ agravo US$ = prêmio seguradora US$ × (1 − agravo %)     385/385 imp · 314/315 exp
 *   Diferença US$         = prêmio cliente US$ (+ IRB na exportação)
 *                           − a pagar c/ agravo cru (sem arredondar)    385/385 imp · 314/315 exp
 *   Resultado US$         = prêmio cliente − prêmio seguradora
 *                           − comissão do parceiro + IRB                 34/35
 *   Valor R$              = round2(valor US$ já arredondado × taxa)
 *   % de rentabilidade    = diferença R$ ÷ prêmio cliente R$ × 100
 *
 * O resultado usa o prêmio da seguradora cheio, não o valor com agravo —
 * conferido no Ranking de Parceiros (FRESNOMAQ 2720 = 18.642,97 − 13.093,49
 * + 990 − 5.592,90 = 946,58).
 */

/** Arredondamento do legado (HALF_UP sobre o valor exato do double) — ver common/money. */
export function round2(value: number) {
  return roundHalfUpExact(value, 2);
}

export interface ProductionInput {
  /** Na exportação o IRB entra na diferença; na importação, não. */
  kind?: 'IMPORT' | 'EXPORT' | string;
  currencyCode: string;
  /** Câmbio moeda do processo → BRL gravado na averbação. */
  exchangeRate: number;
  /** Câmbio USD → BRL do dia da averbação (para converter moedas ≠ USD). */
  usdRate: number;
  /** Câmbio do numerário (USD → BRL), quando já existe — a "Tx. Rec." do legado. */
  receiptRate?: number | null;

  insuredAmount: number;
  premiumClient: number;
  premiumInsurer: number;
  payableDiscountPercent: number;
  /** Comissão do parceiro na moeda do processo. */
  partnerCommission: number;
  /** IRB já em US$. */
  irbUsd: number;
}

export interface ProductionFigures {
  /** Taxa USD → BRL usada nas colunas em reais. */
  brlRate: number;
  insuredUsd: number;
  premiumClientUsd: number;
  premiumInsurerUsd: number;
  payableUsd: number;
  premiumClientBrl: number;
  payableBrl: number;
  diffUsd: number;
  diffBrl: number;
  /** `null` quando não há prêmio em reais para dividir. */
  profitability: number | null;
  partnerCommissionUsd: number;
  irbUsd: number;
  irbBrl: number;
  resultUsd: number;
  /** Falta câmbio para converter a moeda do processo em US$. */
  missingRate: boolean;
}

export function productionFigures(input: ProductionInput): ProductionFigures {
  const isUsd = input.currencyCode === 'USD';
  const canConvert = isUsd || (input.exchangeRate > 0 && input.usdRate > 0);

  const toUsd = (value: number) => {
    if (isUsd) return round2(value);
    if (!canConvert) return 0;
    return round2((value * input.exchangeRate) / input.usdRate);
  };

  // Em USD a taxa de reais é a do numerário (ou a da própria averbação);
  // nas demais moedas o valor já foi levado a US$, então vale a do dólar.
  const brlRate = isUsd
    ? input.receiptRate || input.exchangeRate || input.usdRate
    : input.usdRate;

  const insuredUsd = toUsd(input.insuredAmount);
  const premiumClientUsd = toUsd(input.premiumClient);
  const premiumInsurerUsd = toUsd(input.premiumInsurer);
  const payableRawUsd = percentOf(premiumInsurerUsd, 100 - input.payableDiscountPercent);
  const payableUsd = round2(payableRawUsd);
  const partnerCommissionUsd = toUsd(input.partnerCommission);
  const irbUsd = round2(input.irbUsd);

  const premiumClientBrl = round2(premiumClientUsd * brlRate);
  const payableBrl = round2(payableUsd * brlRate);
  const irbBrl = round2(irbUsd * brlRate);
  const isExport = input.kind === 'EXPORT';
  const diffBrl = round2(premiumClientBrl + (isExport ? irbBrl : 0) - payableBrl);

  return {
    brlRate,
    insuredUsd,
    premiumClientUsd,
    premiumInsurerUsd,
    payableUsd,
    premiumClientBrl,
    payableBrl,
    diffUsd: round2(premiumClientUsd + (isExport ? irbUsd : 0) - payableRawUsd),
    diffBrl,
    profitability: premiumClientBrl ? round2((diffBrl / premiumClientBrl) * 100) : null,
    partnerCommissionUsd,
    irbUsd,
    irbBrl,
    resultUsd: round2(premiumClientUsd - premiumInsurerUsd - partnerCommissionUsd + irbUsd),
    missingRate: !canConvert,
  };
}

// ---------------------------------------------------------------------------
// Rankings
// ---------------------------------------------------------------------------

export interface RankingSource extends ProductionFigures {
  quoteId: string;
  clientId: string;
}

export interface RankingRow {
  key: string;
  label: string;
  position: number;
  /** Participação no prêmio do cliente — conferido no legado: não é sobre a I.S. */
  percent: number;
  insuredUsd: number;
  premiumClientUsd: number;
  premiumClientBrl: number;
  premiumInsurerUsd: number;
  partnerCommissionUsd: number;
  irbUsd: number;
  irbBrl: number;
  resultUsd: number;
  processes: number;
  clients: number;
}

type Totals = Omit<RankingRow, 'key' | 'label' | 'position'>;

/**
 * Agrupa as linhas por uma dimensão e ordena pelo prêmio do cliente.
 * O total vem separado, e não como "último registro" da lista (bug do legado,
 * que duplicava ou exibia uma linha vazia).
 */
export function buildRanking<T extends RankingSource>(
  rows: T[],
  keyOf: (row: T) => { key: string; label: string },
): { rows: RankingRow[]; totals: Totals } {
  const groups = new Map<
    string,
    { label: string; rows: T[]; quotes: Set<string>; clients: Set<string> }
  >();

  for (const row of rows) {
    const { key, label } = keyOf(row);
    let group = groups.get(key);
    if (!group) {
      group = { label, rows: [], quotes: new Set(), clients: new Set() };
      groups.set(key, group);
    }
    group.rows.push(row);
    group.quotes.add(row.quoteId);
    group.clients.add(row.clientId);
  }

  const sum = (items: T[], field: keyof ProductionFigures) =>
    round2(items.reduce((acc, item) => acc + (Number(item[field]) || 0), 0));

  const totalPremium = sum(rows, 'premiumClientUsd');
  const percentOf = (value: number) =>
    totalPremium ? round2((value / totalPremium) * 100) : 0;

  const result = [...groups.entries()]
    .map(([key, group]) => {
      const premiumClientUsd = sum(group.rows, 'premiumClientUsd');
      return {
        key,
        label: group.label,
        position: 0,
        percent: percentOf(premiumClientUsd),
        insuredUsd: sum(group.rows, 'insuredUsd'),
        premiumClientUsd,
        premiumClientBrl: sum(group.rows, 'premiumClientBrl'),
        premiumInsurerUsd: sum(group.rows, 'premiumInsurerUsd'),
        partnerCommissionUsd: sum(group.rows, 'partnerCommissionUsd'),
        irbUsd: sum(group.rows, 'irbUsd'),
        irbBrl: sum(group.rows, 'irbBrl'),
        resultUsd: sum(group.rows, 'resultUsd'),
        processes: group.quotes.size,
        clients: group.clients.size,
      };
    })
    .sort((a, b) => b.premiumClientUsd - a.premiumClientUsd || a.label.localeCompare(b.label))
    .map((row, index) => ({ ...row, position: index + 1 }));

  return {
    rows: result,
    totals: {
      percent: rows.length ? 100 : 0,
      insuredUsd: sum(rows, 'insuredUsd'),
      premiumClientUsd: totalPremium,
      premiumClientBrl: sum(rows, 'premiumClientBrl'),
      premiumInsurerUsd: sum(rows, 'premiumInsurerUsd'),
      partnerCommissionUsd: sum(rows, 'partnerCommissionUsd'),
      irbUsd: sum(rows, 'irbUsd'),
      irbBrl: sum(rows, 'irbBrl'),
      resultUsd: sum(rows, 'resultUsd'),
      processes: new Set(rows.map((r) => r.quoteId)).size,
      clients: new Set(rows.map((r) => r.clientId)).size,
    },
  };
}
