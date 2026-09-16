import { QuoteKind, RateLineItem } from '@prisma/client';
import { calculateQuote, type CalculationInput } from './quote-calculator';

/**
 * Os dois primeiros blocos reproduzem processos reais lidos na plataforma legada
 * em 02/09/2026 (somente leitura). Se o motor divergir deles, a regra mudou —
 * ou quebramos algo. Ver docs/04-regras-calculo.md.
 */

const lineOf = (result: ReturnType<typeof calculateQuote>, item: RateLineItem) =>
  result.lines.find((l) => l.item === item)!;

describe('calculateQuote — importação', () => {
  /**
   * Processo 2085 — AKAD, apólice 027982026000206220002687.
   * Custo 7.056,06 · Frete 365,95 · Despesas 10% · taxa cliente 0,25 · seguradora 0,054
   * Coberturas: Guerra e Greve ✔, Despesas ✔, Prêmio Mínimo ✔, Lucros ✘
   * Esperado em tela: I.S. 8.164,21 · prêmio cliente 30,00 · seguradora 4,41
   */
  const process2085: CalculationInput = {
    kind: QuoteKind.IMPORT,
    cost: 7056.06,
    freight: 365.95,
    expensePercent: 10,
    profitPercent: 10,
    expensesCovered: true,
    expectedProfitCovered: false,
    warStrike: true,
    minimumPremiumApplied: true,
    minimumPremium: 30,
    // A tela mostra GTM/GMCC zerado mesmo com a cobertura marcada.
    clientRates: { base: 0.25, extra: 0, war: 0 },
    insurerRates: { base: 0.054, extra: 0, war: 0 },
    exchangeRate: 5.4942,
  };

  it('deriva despesas de (custo + frete) pelo percentual', () => {
    const result = calculateQuote(process2085);
    expect(lineOf(result, RateLineItem.EXPENSES).amount).toBe(742.2);
  });

  it('não inclui lucros esperados quando a cobertura está desmarcada', () => {
    const result = calculateQuote(process2085);
    expect(lineOf(result, RateLineItem.EXPECTED_PROFIT).amount).toBe(0);
  });

  it('soma a importância segurada', () => {
    expect(calculateQuote(process2085).insuredAmount).toBe(8164.21);
  });

  it('calcula o prêmio de cada linha', () => {
    const result = calculateQuote(process2085);
    expect(lineOf(result, RateLineItem.COST).client.premium).toBe(17.64);
    expect(lineOf(result, RateLineItem.FREIGHT).client.premium).toBe(0.91);
    expect(lineOf(result, RateLineItem.EXPENSES).client.premium).toBe(1.86);

    expect(lineOf(result, RateLineItem.COST).insurer.premium).toBe(3.81);
    expect(lineOf(result, RateLineItem.FREIGHT).insurer.premium).toBe(0.2);
    expect(lineOf(result, RateLineItem.EXPENSES).insurer.premium).toBe(0.4);
  });

  it('aplica o prêmio mínimo apenas ao cliente', () => {
    const result = calculateQuote(process2085);
    expect(result.premiumClientRaw).toBe(20.41);
    expect(result.premiumClient).toBe(30);
    expect(result.minimumPremiumUsed).toBe(true);
    // A seguradora não recebe o piso.
    expect(result.premiumInsurer).toBe(4.41);
  });

  it('converte para reais pela cotação do processo', () => {
    const result = calculateQuote(process2085);
    expect(result.insuredAmountBrl).toBe(44855.8);
    expect(result.premiumClientBrl).toBe(164.83);
  });

  it('apura a margem da corretora', () => {
    const result = calculateQuote(process2085);
    expect(result.grossMargin).toBe(25.59);
    expect(result.marginPercent).toBe(85.3);
  });

  /**
   * Processo 2084 — mesma apólice, valores maiores, sem acionar o piso.
   * Custo 13.880,00 · Frete 700,14 · Despesas 1.458,01 · I.S. 16.038,15
   * Prêmio cliente 40,10 · seguradora 8,67 · I.S. R$ 87.990,10
   */
  const process2084: CalculationInput = {
    ...process2085,
    cost: 13880,
    freight: 700.14,
    exchangeRate: 5.4863,
  };

  it('não aplica o piso quando o prêmio calculado o supera', () => {
    const result = calculateQuote(process2084);

    expect(lineOf(result, RateLineItem.EXPENSES).amount).toBe(1458.01);
    expect(result.insuredAmount).toBe(16038.15);
    expect(result.premiumClientRaw).toBe(40.1);
    expect(result.premiumClient).toBe(40.1);
    expect(result.minimumPremiumUsed).toBe(false);
    expect(result.premiumInsurer).toBe(8.67);
  });

  it('impostos entram na base da I.S. mas não geram prêmio', () => {
    const result = calculateQuote({ ...process2085, taxes: 1000 });

    expect(result.insuredAmount).toBe(9164.21);
    expect(lineOf(result, RateLineItem.TAXES).client.premium).toBe(0);
    expect(lineOf(result, RateLineItem.TAXES).insurer.premium).toBe(0);
    // O prêmio bruto não muda com a entrada de impostos.
    expect(result.premiumClientRaw).toBe(20.41);
  });

  it('soma o GTM/GMCC à taxa quando há cobertura de guerra e greve', () => {
    const semGuerra = calculateQuote({
      ...process2085,
      warStrike: false,
      minimumPremiumApplied: false,
      clientRates: { base: 0.25, extra: 0, war: 0.05 },
      insurerRates: { base: 0.054, extra: 0, war: 0.01 },
    });
    const comGuerra = calculateQuote({
      ...process2085,
      warStrike: true,
      minimumPremiumApplied: false,
      clientRates: { base: 0.25, extra: 0, war: 0.05 },
      insurerRates: { base: 0.054, extra: 0, war: 0.01 },
    });

    expect(lineOf(semGuerra, RateLineItem.COST).client.total).toBe(0.25);
    expect(lineOf(comGuerra, RateLineItem.COST).client.total).toBe(0.3);
    expect(comGuerra.premiumClientRaw).toBeGreaterThan(semGuerra.premiumClientRaw);
  });

  it('rateia a comissão sobre o prêmio do cliente', () => {
    // 30% do parceiro é o default do legado, conferido na tela de comissões.
    const result = calculateQuote({ ...process2085, partnerPercent: 30 });
    expect(result.commissions.partner).toBe(9);
  });
});

describe('calculateQuote — exportação', () => {
  const base: CalculationInput = {
    kind: QuoteKind.EXPORT,
    cost: 10000,
    freight: 500,
    cifValue: 1500,
    warStrike: true,
    clientRates: { base: 0.25, extra: 0, war: 0 },
    insurerRates: { base: 0.054, extra: 0, war: 0 },
    exchangeRate: 5.5,
  };

  it('usa as verbas de exportação (custo, frete e valor CIF)', () => {
    const result = calculateQuote(base);
    const items = result.lines.map((l) => l.item);

    expect(items).toEqual([RateLineItem.COST, RateLineItem.FREIGHT, RateLineItem.CIF_VALUE]);
    expect(result.insuredAmount).toBe(12000);
  });

  it('ignora despesas, lucros e impostos mesmo se informados', () => {
    const result = calculateQuote({
      ...base,
      expensesCovered: true,
      expensePercent: 10,
      taxes: 999,
    });
    expect(result.insuredAmount).toBe(12000);
  });

  it('soma o adicional por embarcação à taxa do cliente', () => {
    const result = calculateQuote({ ...base, vesselAdditionalPercent: 0.05 });
    expect(lineOf(result, RateLineItem.COST).client.total).toBe(0.3);
    // A taxa da seguradora não é afetada.
    expect(lineOf(result, RateLineItem.COST).insurer.total).toBe(0.054);
  });
});

describe('calculateQuote — agravo da seguradora', () => {
  const base: CalculationInput = {
    kind: QuoteKind.IMPORT,
    cost: 10000,
    freight: 0,
    clientRates: { base: 1, extra: 0, war: 0 },
    insurerRates: { base: 0.5, extra: 0, war: 0 },
  };

  it('sem agravo, o valor a pagar é o próprio prêmio', () => {
    const result = calculateQuote(base);
    expect(result.premiumInsurer).toBe(50);
    expect(result.insurerPayable).toBe(50);
  });

  it('aplica o percentual de agravo informado', () => {
    // Parametrizado: o legado tem o campo como 20% e a tela exibe 25%.
    expect(calculateQuote({ ...base, insurerSurchargePercent: 20 }).insurerPayable).toBe(60);
    expect(calculateQuote({ ...base, insurerSurchargePercent: 25 }).insurerPayable).toBe(62.5);
  });
});

describe('calculateQuote — bordas', () => {
  it('não quebra com processo zerado', () => {
    const result = calculateQuote({
      kind: QuoteKind.IMPORT,
      cost: 0,
      freight: 0,
      clientRates: { base: 0, extra: 0, war: 0 },
      insurerRates: { base: 0, extra: 0, war: 0 },
    });

    expect(result.insuredAmount).toBe(0);
    expect(result.premiumClient).toBe(0);
    expect(result.marginPercent).toBe(0);
  });

  it('arredonda valores monetários em 2 casas e taxas em 5', () => {
    const result = calculateQuote({
      kind: QuoteKind.IMPORT,
      cost: 1234.567,
      freight: 0,
      clientRates: { base: 0.123456789, extra: 0, war: 0 },
      insurerRates: { base: 0, extra: 0, war: 0 },
    });

    expect(result.insuredAmount).toBe(1234.57);
    expect(lineOf(result, RateLineItem.COST).client.total).toBe(0.12346);
  });
});
