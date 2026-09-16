import { QuoteKind, RateLineItem } from '@prisma/client';

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
  /** Impostos (importação) — só entram na base se algum tributo estiver marcado. */
  taxes?: number;
  /** Valor CIF (exportação). */
  cifValue?: number;

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
   * Agravo aplicado sobre o valor a pagar à seguradora, em %.
   * O campo no banco legado se chama `vlDolarAPagarAgravo20` (20%), mas a
   * Planilha Produção exibe "AGRAVO 25%". Parametrizado até o cliente confirmar
   * qual é a regra vigente — ver novas_tarefas.md, item 1.
   */
  insurerSurchargePercent?: number;
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

  /** Margem bruta da corretora. */
  grossMargin: number;
  marginPercent: number;

  /** Valor a pagar à seguradora, com agravo. */
  insurerPayable: number;
  insurerSurcharge: number;

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

const money = (v: number) => round(v, MONEY);
const rate = (v: number) => round(v, RATE);

function totalRate(rates: RateSet, includeWar: boolean) {
  return rate(rates.base + rates.extra + (includeWar ? rates.war : 0));
}

export function calculateQuote(input: CalculationInput): CalculationResult {
  const isImport = input.kind === QuoteKind.IMPORT;
  const cost = money(input.cost ?? 0);
  const freight = money(input.freight ?? 0);

  // --- 1. Verbas ----------------------------------------------------------
  // Despesas e lucros esperados derivam de (custo + frete) e só entram na base
  // quando a cobertura acessória correspondente está marcada. Conferido no
  // processo 2085: (7.056,06 + 365,95) × 10% = 742,20 com "Despesas" marcada e
  // lucros = 0,00 com "Lucros Esperados" desmarcada.
  const derivationBase = cost + freight;

  const expenses =
    isImport && input.expensesCovered
      ? money((derivationBase * (input.expensePercent ?? 0)) / 100)
      : 0;

  const expectedProfit =
    isImport && input.expectedProfitCovered
      ? money((derivationBase * (input.profitPercent ?? 0)) / 100)
      : 0;

  const taxes = isImport ? money(input.taxes ?? 0) : 0;
  const cifValue = isImport ? 0 : money(input.cifValue ?? 0);

  const amounts: Array<[RateLineItem, number]> = isImport
    ? [
        [RateLineItem.COST, cost],
        [RateLineItem.FREIGHT, freight],
        [RateLineItem.EXPENSES, expenses],
        [RateLineItem.EXPECTED_PROFIT, expectedProfit],
        [RateLineItem.TAXES, taxes],
      ]
    : [
        [RateLineItem.COST, cost],
        [RateLineItem.FREIGHT, freight],
        [RateLineItem.CIF_VALUE, cifValue],
      ];

  // --- 2. Importância segurada -------------------------------------------
  const insuredAmount = money(amounts.reduce((acc, [, value]) => acc + value, 0));

  // --- 3. Taxas e prêmio por linha ---------------------------------------
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

  const lines: CalculatedLine[] = amounts.map(([item, amount]) => {
    // Impostos não são tarifados: entram na base da I.S. mas não geram prêmio.
    const tariffed = item !== RateLineItem.TAXES;

    const clientLineRate = tariffed ? clientTotalRate : 0;
    const insurerLineRate = tariffed ? insurerTotalRate : 0;

    return {
      item,
      amount,
      client: {
        ...(tariffed ? clientRates : { base: 0, extra: 0, war: 0 }),
        total: clientLineRate,
        premium: money((amount * clientLineRate) / 100),
      },
      insurer: {
        ...(tariffed ? insurerRates : { base: 0, extra: 0, war: 0 }),
        total: insurerLineRate,
        premium: money((amount * insurerLineRate) / 100),
      },
    };
  });

  // --- 4. Prêmios totais --------------------------------------------------
  const premiumClientRaw = money(lines.reduce((acc, l) => acc + l.client.premium, 0));
  const premiumInsurer = money(lines.reduce((acc, l) => acc + l.insurer.premium, 0));

  // O piso da apólice se aplica apenas ao lado do cliente. Conferido no
  // processo 2085: soma 20,41 → cobrado 30,00, com a seguradora em 4,41.
  const minimum = input.minimumPremiumApplied ? (input.minimumPremium ?? 0) : 0;
  const premiumClient = money(Math.max(premiumClientRaw, minimum));
  const minimumPremiumUsed = premiumClient > premiumClientRaw;

  // --- 5. Margem e repasse ------------------------------------------------
  const grossMargin = money(premiumClient - premiumInsurer);
  const marginPercent = premiumClient > 0 ? round((grossMargin / premiumClient) * 100, MONEY) : 0;

  const surchargePercent = input.insurerSurchargePercent ?? 0;
  const insurerSurcharge = money((premiumInsurer * surchargePercent) / 100);
  const insurerPayable = money(premiumInsurer + insurerSurcharge);

  // --- 6. Comissões -------------------------------------------------------
  const partner = money((premiumClient * (input.partnerPercent ?? 0)) / 100);
  const broker = money((premiumClient * (input.brokerPercent ?? 0)) / 100);
  const salesperson = money((premiumClient * (input.salespersonPercent ?? 0)) / 100);

  // --- 7. Conversão cambial ----------------------------------------------
  const exchangeRate = input.exchangeRate ?? 0;

  return {
    lines,
    insuredAmount,
    premiumClientRaw,
    premiumClient,
    premiumInsurer,
    minimumPremiumUsed,
    grossMargin,
    marginPercent,
    insurerPayable,
    insurerSurcharge,
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
  };
}
