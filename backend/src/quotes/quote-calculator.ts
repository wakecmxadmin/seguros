import { QuoteKind, RateLineItem } from '@prisma/client';
import { money, percentOf } from '../common/money';

/**
 * Motor de cálculo do seguro.
 *
 * Função pura, sem banco e sem dependências do Nest — as regras vieram de
 * engenharia reversa do legado e foram conferidas contra processos reais
 * (ver docs/04-regras-calculo.md). Manter isolado é o que permite testar
 * cada regra sem subir a aplicação.
 */

export interface RateSet {
  /** Taxa básica da apólice/cobertura, em %. */
  base: number;
  /** Adicional por mercadoria, embalagem ou negociação, em %. */
  extra: number;
  /** GTM/GMCC — guerra, greve, tumulto e motim, em %. */
  war: number;
}

export interface CalculationInput {
  kind: QuoteKind;

  /** Verbas informadas pelo operador. */
  cost: number;
  freight: number;
  /** Impostos (importação) — entram na I.S. e geram prêmio (ver `taxRates`). */
  taxes?: number;
  /**
   * Ignorado. Mantido só para não quebrar chamadas antigas: na exportação a
   * linha "Valor CIF" é calculada (prêmio sobre prêmio), não digitada.
   */
  cifValue?: number;

  /**
   * Incoterm do processo. Na exportação decide quanto do prêmio é cobrado no
   * numerário (`premiumCharged`). Sem ele, cobra-se o prêmio total.
   */
  incoterm?: string | null;

  /**
   * IRB do processo, já na moeda do processo. Digitado por processo no legado
   * (US$ 0, 10 ou 30 nos dados reais). Entra como receita no resultado e, na
   * exportação, também na diferença.
   */
  irb?: number;

  /** Percentuais das verbas derivadas (importação). Default 10 no legado. */
  expensePercent?: number;
  profitPercent?: number;

  /** Coberturas acessórias marcadas. */
  expensesCovered?: boolean;
  expectedProfitCovered?: boolean;
  warStrike?: boolean;
  minimumPremiumApplied?: boolean;

  /** Taxas por lado. */
  clientRates: RateSet;
  insurerRates: RateSet;

  /**
   * Taxas totais da linha de impostos (importação), em %. Sem elas, vale a
   * taxa total das demais linhas — o padrão do legado.
   */
  taxRates?: { client?: number | null; insurer?: number | null };

  /** Piso de prêmio da apólice, na moeda do processo. */
  minimumPremium?: number;

  /** Acréscimo por característica da embarcação (exportação), em %. */
  vesselAdditionalPercent?: number;

  /** Cotação da moeda do processo em reais. */
  exchangeRate?: number;

  /** Rateio da comissão sobre o prêmio do cliente, em %. */
  partnerPercent?: number;
  brokerPercent?: number;
  salespersonPercent?: number;

  /**
   * Agravo, em %: o desconto que a seguradora concede sobre o prêmio dela,
   * reduzindo o valor que a corretora efetivamente paga.
   *
   * 25 % nos dois ramos — conferido em 35 numerários de importação e 324 de
   * exportação pagos no legado (docs/19-legado-validacoes.md, rodadas 1 e 2).
   * É o que explica as colunas `Dif USD` e `% de Rentabilidade` da
   * Planilha Produção do legado: o cliente paga o prêmio cheio e a seguradora
   * recebe menos. Vem dos Parâmetros quando não informado.
   */
  payableDiscountPercent?: number;
}

export interface CalculatedLine {
  item: RateLineItem;
  amount: number;
  client: RateSet & { total: number; premium: number };
  insurer: RateSet & { total: number; premium: number };
}

export interface CalculationResult {
  lines: CalculatedLine[];

  insuredAmount: number;

  /** Soma dos prêmios por linha, antes do piso. */
  premiumClientRaw: number;
  premiumClient: number;
  premiumInsurer: number;
  /** Verdadeiro quando o piso da apólice elevou o prêmio do cliente. */
  minimumPremiumUsed: boolean;

  /**
   * Prêmio cobrado do cliente no numerário. Na importação é o próprio prêmio
   * do cliente; na exportação depende do incoterm (ver `chargedBasis`). A nota
   * fiscal e as comissões usam sempre o prêmio total (`premiumClient`).
   */
  premiumCharged: number;

  /** IRB considerado no cálculo, na moeda do processo. */
  irb: number;

  /**
   * Margem bruta da corretora — a "Diferença" do legado: prêmio do cliente
   * (+ IRB na exportação) − valor efetivamente pago à seguradora.
   */
  grossMargin: number;
  marginPercent: number;

  /**
   * Resultado do processo — o "Resultado US$" do legado: prêmio do cliente −
   * prêmio cheio da seguradora − comissão do parceiro + IRB.
   */
  netResult: number;

  /** Valor efetivamente pago à seguradora: prêmio − agravo. */
  insurerPayable: number;
  /** Agravo em valor — o desconto concedido pela seguradora. */
  payableDiscount: number;

  commissions: {
    partner: number;
    broker: number;
    salesperson: number;
    total: number;
  };

  exchangeRate: number;
  insuredAmountBrl: number;
  premiumClientBrl: number;
  premiumInsurerBrl: number;
  premiumChargedBrl: number;
}

/**
 * Quanto do prêmio de exportação é cobrado do cliente, pelo incoterm.
 *
 * Conferido em 324 numerários de exportação pagos do legado (docs/19, rodada 2):
 * quando o vendedor já embute seguro e frete no preço (CIF, CIP, D-terms) cobra-se o
 * prêmio total; quando embute só o frete (CFR, CPT), o prêmio de custo + frete,
 * sem o prêmio sobre prêmio; nos demais, só o prêmio do custo. DAT, DDU, FAS e CI
 * não apareceram nos dados — classificados pela mesma lógica.
 */
export type ChargedBasis = 'TOTAL' | 'COST_FREIGHT' | 'COST';

export function chargedBasis(incoterm?: string | null): ChargedBasis {
  switch (incoterm) {
    case 'CFR':
    case 'CPT':
      return 'COST_FREIGHT';
    case 'EXW':
    case 'FCA':
    case 'FAS':
    case 'FOB':
      return 'COST';
    default:
      return 'TOTAL';
  }
}

/** Valores monetários: 2 casas. Taxas: 5 casas. */
const MONEY = 2;
const RATE = 5;

function round(value: number, digits: number) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  // O epsilon evita que 1.005 vire 1.00 por representação binária.
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

const rate = (v: number) => round(v, RATE);

function totalRate(rates: RateSet, includeWar: boolean) {
  return rate(rates.base + rates.extra + (includeWar ? rates.war : 0));
}

export function calculateQuote(input: CalculationInput): CalculationResult {
  const isImport = input.kind === QuoteKind.IMPORT;
  const cost = money(input.cost ?? 0);
  const freight = money(input.freight ?? 0);
  const irb = money(Math.max(input.irb ?? 0, 0));

  // --- 1. Taxas -------------------------------------------------------------
  const includeWar = !!input.warStrike;

  // O adicional por embarcação incide sobre a taxa do cliente na exportação.
  const vesselExtra = isImport ? 0 : (input.vesselAdditionalPercent ?? 0);

  const clientRates: RateSet = {
    base: rate(input.clientRates.base),
    extra: rate(input.clientRates.extra + vesselExtra),
    war: rate(input.clientRates.war),
  };
  const insurerRates: RateSet = {
    base: rate(input.insurerRates.base),
    extra: rate(input.insurerRates.extra),
    war: rate(input.insurerRates.war),
  };

  const clientTotalRate = totalRate(clientRates, includeWar);
  const insurerTotalRate = totalRate(insurerRates, includeWar);

  // --- 2. Verbas e importância segurada --------------------------------------
  let amounts: Array<[RateLineItem, number]>;
  let insuredAmount: number;

  if (isImport) {
    // Despesas e lucros esperados derivam de (custo + frete) e só entram na base
    // quando a cobertura acessória correspondente está marcada. Conferido no
    // processo 2085: (7.056,06 + 365,95) × 10% = 742,20 com "Despesas" marcada e
    // lucros = 0,00 com "Lucros Esperados" desmarcada.
    const derivationBase = cost + freight;
    const expenses = input.expensesCovered
      ? money(percentOf(derivationBase, input.expensePercent ?? 0))
      : 0;
    // Lucros esperados incidem sobre custo + frete + despesas — conferido em
    // 385 importações do legado (ex.: (17.512,91 + 9.500 + 2.701,29) × 10 %
    // = 2.971,42). Corrigido em 18/11/2026; antes usávamos só custo + frete.
    const expectedProfit = input.expectedProfitCovered
      ? money(percentOf(derivationBase + expenses, input.profitPercent ?? 0))
      : 0;
    const taxes = money(input.taxes ?? 0);

    amounts = [
      [RateLineItem.COST, cost],
      [RateLineItem.FREIGHT, freight],
      [RateLineItem.EXPENSES, expenses],
      [RateLineItem.EXPECTED_PROFIT, expectedProfit],
      [RateLineItem.TAXES, taxes],
    ];
    insuredAmount = money(amounts.reduce((acc, [, value]) => acc + value, 0));
  } else {
    // Exportação: o prêmio entra na própria importância segurada ("prêmio
    // sobre prêmio"). I.S. = (custo + frete) ÷ (1 − taxa do cliente), e a
    // linha "Valor CIF" da grade é exatamente essa parcela a mais. Conferido em
    // 323 de 324 numerários de exportação do legado (docs/19, rodada 2).
    const base = cost + freight;
    const factor = 1 - clientTotalRate / 100;
    insuredAmount = factor > 0 ? money(base / factor) : money(base);
    amounts = [
      [RateLineItem.COST, cost],
      [RateLineItem.FREIGHT, freight],
      [RateLineItem.CIF_VALUE, money(insuredAmount - base)],
    ];
  }

  // --- 3. Prêmio por linha ---------------------------------------------------
  // A linha de impostos gera prêmio, com taxa própria (por padrão a mesma das
  // demais linhas). Em 5 de 385 importações do legado o operador zerou a taxa
  // do cliente sobre impostos e manteve a da seguradora.
  const taxClientRate = rate(input.taxRates?.client ?? clientTotalRate);
  const taxInsurerRate = rate(input.taxRates?.insurer ?? insurerTotalRate);

  const rawPremiums = amounts.map(([item, amount]) => {
    const isTax = item === RateLineItem.TAXES;
    const clientLineRate = isTax ? taxClientRate : clientTotalRate;
    const insurerLineRate = isTax ? taxInsurerRate : insurerTotalRate;
    return {
      item,
      amount,
      isTax,
      clientLineRate,
      insurerLineRate,
      client: percentOf(amount, clientLineRate),
      insurer: percentOf(amount, insurerLineRate),
    };
  });

  const lines: CalculatedLine[] = rawPremiums.map((l) => ({
    item: l.item,
    amount: l.amount,
    client: {
      ...(l.isTax ? { base: l.clientLineRate, extra: 0, war: 0 } : clientRates),
      total: l.clientLineRate,
      premium: money(l.client),
    },
    insurer: {
      ...(l.isTax ? { base: l.insurerLineRate, extra: 0, war: 0 } : insurerRates),
      total: l.insurerLineRate,
      premium: money(l.insurer),
    },
  }));

  // --- 4. Prêmios totais --------------------------------------------------
  // Regras conferidas contra numerários pagos do legado (docs/19, rodada 2),
  // inclusive nas peculiaridades de arredondamento — são elas que produzem os
  // valores que o cliente e a seguradora já conhecem:
  //
  // Importação (385/385):
  //   cliente     = soma crua das linhas, arredondada no fim;
  //   seguradora  = custo, frete e lucros arredondados + despesas e impostos
  //                 crus, arredondada no fim;
  //   base do agravo (`vlDolarAPagar`) = soma crua das linhas da seguradora,
  //                 arredondada (pode diferir 1 centavo do prêmio acima).
  // Exportação (314/315): I.S. × taxa, dos dois lados; as linhas são só
  //   detalhamento (E-50311: 14,13 + 0,62 + 0,04 = 14,79, total 14,78).
  let premiumClientRaw: number;
  let premiumInsurer: number;
  let payableBase: number;

  if (isImport) {
    const roundedInsurerItems: RateLineItem[] = [
      RateLineItem.COST,
      RateLineItem.FREIGHT,
      RateLineItem.EXPECTED_PROFIT,
    ];
    premiumClientRaw = money(rawPremiums.reduce((acc, l) => acc + l.client, 0));
    premiumInsurer = money(
      rawPremiums.reduce(
        (acc, l) => acc + (roundedInsurerItems.includes(l.item) ? money(l.insurer) : l.insurer),
        0,
      ),
    );
    payableBase = money(rawPremiums.reduce((acc, l) => acc + l.insurer, 0));
  } else {
    premiumClientRaw = money(percentOf(insuredAmount, clientTotalRate));
    premiumInsurer = money(percentOf(insuredAmount, insurerTotalRate));
    payableBase = premiumInsurer;
  }

  // O piso da apólice se aplica apenas ao lado do cliente. Conferido no
  // processo 2085: soma 20,41 → cobrado 30,00, com a seguradora em 4,41.
  const minimum = input.minimumPremiumApplied ? (input.minimumPremium ?? 0) : 0;
  const premiumClient = money(Math.max(premiumClientRaw, minimum));
  const minimumPremiumUsed = premiumClient > premiumClientRaw;

  // Prêmio cobrado no numerário. Com o piso aplicado, cobra-se o piso.
  let premiumCharged = premiumClient;
  if (!isImport && !minimumPremiumUsed) {
    const basis = chargedBasis(input.incoterm);
    if (basis === 'COST_FREIGHT') {
      premiumCharged = money(percentOf(cost + freight, clientTotalRate));
    } else if (basis === 'COST') {
      premiumCharged = money(percentOf(cost, clientTotalRate));
    }
  }

  // --- 5. Margem e repasse ------------------------------------------------
  // O agravo é desconto, não acréscimo: a seguradora libera um percentual do
  // prêmio e a corretora paga a diferença. O piso em zero evita que um
  // percentual digitado errado (acima de 100) vire pagamento negativo.
  //
  // O legado guarda o "a pagar c/ agravo" sem arredondar (base × 0,75) e só
  // arredonda na exibição; a diferença é feita sobre esse valor cru. Assim os
  // dois batem em 385/385 importações e 314/315 exportações em US$.
  const discountPercent = Math.min(Math.max(input.payableDiscountPercent ?? 0, 0), 100);
  const payableRaw = percentOf(payableBase, 100 - discountPercent);
  const insurerPayable = money(payableRaw);
  const payableDiscount = money(payableBase - payableRaw);

  // Rentabilidade = prêmio do cliente − o que de fato sai para a seguradora,
  // já com o agravo abatido. Na exportação o IRB cobrado entra junto
  // (`vlDiferencaDolar` = prêmio + IRB − a pagar c/ agravo); na importação,
  // não (35/35).
  const grossMargin = money(premiumClient + (isImport ? 0 : irb) - payableRaw);
  const marginPercent = premiumClient > 0 ? round((grossMargin / premiumClient) * 100, MONEY) : 0;

  // --- 6. Comissões -------------------------------------------------------
  const partner = money(percentOf(premiumClient, input.partnerPercent ?? 0));
  const broker = money(percentOf(premiumClient, input.brokerPercent ?? 0));
  const salesperson = money(percentOf(premiumClient, input.salespersonPercent ?? 0));

  // Resultado do legado: prêmio cheio da seguradora (sem agravo), comissão do
  // parceiro e IRB como receita, nos dois ramos.
  const netResult = money(premiumClient - premiumInsurer - partner + irb);

  // --- 7. Conversão cambial ----------------------------------------------
  const exchangeRate = input.exchangeRate ?? 0;

  return {
    lines,
    insuredAmount,
    premiumClientRaw,
    premiumClient,
    premiumInsurer,
    minimumPremiumUsed,
    premiumCharged,
    irb,
    grossMargin,
    marginPercent,
    netResult,
    insurerPayable,
    payableDiscount,
    commissions: {
      partner,
      broker,
      salesperson,
      total: money(partner + broker + salesperson),
    },
    exchangeRate,
    insuredAmountBrl: money(insuredAmount * exchangeRate),
    premiumClientBrl: money(premiumClient * exchangeRate),
    premiumInsurerBrl: money(premiumInsurer * exchangeRate),
    premiumChargedBrl: money(premiumCharged * exchangeRate),
  };
}
