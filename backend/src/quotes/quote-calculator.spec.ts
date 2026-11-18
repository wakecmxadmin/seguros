import { QuoteKind, RateLineItem } from '@prisma/client';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { roundHalfUpExact } from '../common/money';
import { calculateQuote, chargedBasis, type CalculationInput } from './quote-calculator';

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

  it('impostos entram na I.S. e geram prêmio pela taxa das linhas', () => {
    // Corrigido em 18/11/2026: em 385 importações do legado a linha de
    // impostos é tarifada (ex.: 30.691,29 × 0,13 % = 39,90). Ver docs/19, rodada 2.
    const result = calculateQuote({ ...process2085, taxes: 1000 });

    expect(result.insuredAmount).toBe(9164.21);
    expect(lineOf(result, RateLineItem.TAXES).client.premium).toBe(2.5);
    expect(lineOf(result, RateLineItem.TAXES).insurer.premium).toBe(0.54);
    expect(result.premiumClientRaw).toBe(22.91);
  });

  it('a linha de impostos aceita taxa própria (o legado permite zerar a do cliente)', () => {
    const result = calculateQuote({ ...process2085, taxes: 1000, taxRates: { client: 0 } });
    expect(lineOf(result, RateLineItem.TAXES).client.premium).toBe(0);
    expect(lineOf(result, RateLineItem.TAXES).insurer.premium).toBe(0.54);
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
    warStrike: true,
    clientRates: { base: 0.25, extra: 0, war: 0 },
    insurerRates: { base: 0.054, extra: 0, war: 0 },
    exchangeRate: 5.5,
  };

  it('usa as verbas de exportação (custo, frete e valor CIF calculado)', () => {
    const result = calculateQuote(base);
    const items = result.lines.map((l) => l.item);

    expect(items).toEqual([RateLineItem.COST, RateLineItem.FREIGHT, RateLineItem.CIF_VALUE]);
    // (10.000 + 500) ÷ (1 − 0,25 %) = 10.526,32 — o CIF é a diferença.
    expect(result.insuredAmount).toBe(10526.32);
    expect(lineOf(result, RateLineItem.CIF_VALUE).amount).toBe(26.32);
  });

  it('ignora o valor CIF digitado: a linha é sempre calculada', () => {
    const result = calculateQuote({ ...base, cifValue: 99999 });
    expect(result.insuredAmount).toBe(10526.32);
  });

  it('ignora despesas, lucros e impostos mesmo se informados', () => {
    const result = calculateQuote({
      ...base,
      expensesCovered: true,
      expensePercent: 10,
      taxes: 999,
    });
    expect(result.insuredAmount).toBe(10526.32);
  });

  it('soma o adicional por embarcação à taxa do cliente', () => {
    const result = calculateQuote({ ...base, vesselAdditionalPercent: 0.05 });
    expect(lineOf(result, RateLineItem.COST).client.total).toBe(0.3);
    // A taxa da seguradora não é afetada.
    expect(lineOf(result, RateLineItem.COST).insurer.total).toBe(0.054);
  });
});

/**
 * Numerários de exportação pagos no legado, lidos em 18/11/2026 (somente
 * leitura). Agravo de 25 % e IRB de US$ 10 em todos. Ver docs/19, rodada 2.
 */
describe('calculateQuote — exportação contra o legado', () => {
  const exportCase = (
    incoterm: string,
    cost: number,
    freight: number,
    clientRate: number,
    insurerRate: number,
    partnerPercent: number,
  ): CalculationInput => ({
    kind: QuoteKind.EXPORT,
    incoterm,
    cost,
    freight,
    warStrike: true,
    clientRates: { base: clientRate, extra: 0, war: 0 },
    insurerRates: { base: insurerRate, extra: 0, war: 0 },
    partnerPercent,
    payableDiscountPercent: 25,
    irb: 10,
  });

  it('E-50316 (CIP): prêmio sobre prêmio e cobrança do total', () => {
    const r = calculateQuote(exportCase('CIP', 119644, 2923.11, 0.25, 0.25, 30));
    expect(r.insuredAmount).toBe(122874.3);
    expect(r.premiumClient).toBe(307.19);
    expect(r.premiumInsurer).toBe(307.19);
    expect(r.premiumCharged).toBe(307.19);
    expect(r.commissions.partner).toBe(92.16);
    expect(r.insurerPayable).toBe(230.39);
    // Diferença = prêmio + IRB − a pagar c/ agravo.
    expect(r.grossMargin).toBe(86.8);
    expect(r.netResult).toBe(-82.16);
  });

  it('E-50311 (CFR): cobra o prêmio de custo + frete', () => {
    const r = calculateQuote(exportCase('CFR', 5650, 248.44, 0.25, 0.25, 30));
    expect(r.insuredAmount).toBe(5913.22);
    expect(r.premiumClient).toBe(14.78);
    expect(r.premiumCharged).toBe(14.75);
    expect(r.netResult).toBe(5.57);
  });

  it('E-50317 (FCA): cobra só o prêmio do custo', () => {
    const r = calculateQuote(exportCase('FCA', 21327.96, 836, 0.25, 0.25, 30));
    expect(r.insuredAmount).toBe(22219.51);
    expect(r.premiumClient).toBe(55.55);
    expect(r.premiumCharged).toBe(53.32);
    expect(r.commissions.partner).toBe(16.66);
    expect(r.netResult).toBe(-6.66);
  });

  it('E-50294 (EXW): cobra só o prêmio do custo', () => {
    const r = calculateQuote(exportCase('EXW', 6972.5, 456.54, 0.25, 0.25, 30));
    expect(r.premiumClient).toBe(18.62);
    expect(r.premiumCharged).toBe(17.43);
  });

  it('E-50052 (FOB): seguradora com taxa própria sobre a mesma I.S.', () => {
    const r = calculateQuote(exportCase('FOB', 50432.54, 8068.8, 0.2851, 0.065, 20));
    expect(r.insuredAmount).toBe(58668.6);
    expect(r.premiumClient).toBe(167.26);
    expect(r.premiumInsurer).toBe(38.13);
    expect(r.premiumCharged).toBe(143.78);
    expect(r.commissions.partner).toBe(33.45);
    expect(r.netResult).toBe(105.68);
  });

  it('com o prêmio mínimo aplicado, cobra o piso qualquer que seja o incoterm', () => {
    const r = calculateQuote({
      ...exportCase('FOB', 1000, 100, 0.25, 0.25, 30),
      minimumPremiumApplied: true,
      minimumPremium: 30,
    });
    expect(r.premiumClient).toBe(30);
    expect(r.premiumCharged).toBe(30);
  });

  it('classifica os incoterms pela regra do legado', () => {
    expect(chargedBasis('CIF')).toBe('TOTAL');
    expect(chargedBasis('DDP')).toBe('TOTAL');
    expect(chargedBasis('CPT')).toBe('COST_FREIGHT');
    expect(chargedBasis('FOB')).toBe('COST');
    expect(chargedBasis(undefined)).toBe('TOTAL');
  });
});

/**
 * Conferência em massa contra os 324 numerários de exportação pagos do legado.
 * O arquivo tem dados reais de clientes e fica fora do git
 * (backend/prisma/data/mapeamento/) — sem ele, o bloco é pulado.
 */
const legacyExportFile = join(__dirname, '../../prisma/data/mapeamento/num-pagos-exp.json');
const describeIfData = existsSync(legacyExportFile) ? describe : describe.skip;

describeIfData('calculateQuote — numerários de exportação do legado (em US$)', () => {
  type LegacyRow = Record<string, unknown>;
  // Só processos em dólar: nos demais o legado guarda comissão e resultado já
  // convertidos para US$, e o motor trabalha na moeda do processo.
  const all: LegacyRow[] = existsSync(legacyExportFile)
    ? JSON.parse(readFileSync(legacyExportFile, 'utf-8'))
    : [];
  const rows = all.filter((r) => r.cdMoeda === 2);
  const usd = rows;
  const num = (r: LegacyRow, k: string) => Number(r[k] ?? 0);

  const results = rows.map((r) => ({
    r,
    out: calculateQuote({
      kind: QuoteKind.EXPORT,
      incoterm: String(r.deTipoValor),
      cost: num(r, 'vlMercadoria'),
      freight: num(r, 'vlFrete'),
      warStrike: false,
      clientRates: { base: num(r, 'txTotal'), extra: 0, war: 0 },
      insurerRates: { base: num(r, 'txTotalSeguradora'), extra: 0, war: 0 },
      partnerPercent: num(r, 'vlComissaoParceiro'),
      payableDiscountPercent: 25,
      irb: num(r, 'vlIrbDolar'),
    }),
  }));

  const hits = (pick: (x: (typeof results)[number]) => [number, number]) =>
    results.filter((x) => {
      const [a, b] = pick(x);
      return Math.abs(a - b) < 0.001;
    }).length;

  it('I.S. e prêmios batem em todos menos um (E-50031, fora do padrão no legado)', () => {
    expect(hits((x) => [x.out.insuredAmount, num(x.r, 'impSegurada')])).toBeGreaterThanOrEqual(rows.length - 1);
    expect(hits((x) => [x.out.premiumClient, num(x.r, 'vlFinalPremioCliente')])).toBeGreaterThanOrEqual(rows.length - 1);
    expect(hits((x) => [x.out.premiumInsurer, num(x.r, 'vlFinalPremioSeguradora')])).toBeGreaterThanOrEqual(rows.length - 1);
  });

  it('prêmio cobrado bate em todos menos as exceções do legado (4 CPT cobrados pelo total)', () => {
    expect(hits((x) => [x.out.premiumCharged, num(x.r, 'vlPremioOverDolar')])).toBeGreaterThanOrEqual(rows.length - 6);
  });

  it('a pagar c/ agravo e diferença batem com o valor cru do legado', () => {
    // O legado guarda esses dois sem arredondar; compara-se com a mesma regra.
    expect(hits((x) => [x.out.insurerPayable, roundHalfUpExact(num(x.r, 'vlDolarAPagarAgravo20'))])).toBeGreaterThanOrEqual(rows.length - 1);
    expect(hits((x) => [x.out.grossMargin, roundHalfUpExact(num(x.r, 'vlDiferencaDolar'))])).toBeGreaterThanOrEqual(rows.length - 1);
  });

  it('comissão e resultado batem com a regra de arredondamento do legado', () => {
    expect(hits((x) => [x.out.commissions.partner, num(x.r, 'vlComissaoParceiroDolar')])).toBeGreaterThanOrEqual(usd.length - 2);
    expect(hits((x) => [x.out.netResult, num(x.r, 'vlResultadoDolar')])).toBeGreaterThanOrEqual(rows.length - 2);
  });
});

/**
 * Conferência em massa contra os numerários de importação pagos do legado
 * (400 mais recentes, lidos em 18/11/2026). Fora do git; sem o arquivo, pula.
 */
const legacyImportFile = join(__dirname, '../../prisma/data/mapeamento/num-pagos-imp.json');
const describeIfImportData = existsSync(legacyImportFile) ? describe : describe.skip;

describeIfImportData('calculateQuote — numerários de importação do legado (em US$)', () => {
  type LegacyRow = Record<string, unknown>;
  const all: LegacyRow[] = existsSync(legacyImportFile)
    ? JSON.parse(readFileSync(legacyImportFile, 'utf-8'))
    : [];
  const rows = all.filter((r) => r.cdMoeda === 2);
  const num = (r: LegacyRow, k: string) => Number(r[k] ?? 0);

  const results = rows.map((r) => {
    const war = !!r.flGuerraGreve;
    return {
      r,
      out: calculateQuote({
        kind: QuoteKind.IMPORT,
        cost: num(r, 'vlMercadoria'),
        freight: num(r, 'vlFrete'),
        taxes: r.flImposto ? num(r, 'vlImpostos') : 0,
        expensePercent: num(r, 'vlPercentualDespesa'),
        profitPercent: num(r, 'vlPercentualLucroEsperado'),
        expensesCovered: !!r.flDespesas,
        expectedProfitCovered: !!r.flLucroEsperados,
        warStrike: war,
        minimumPremiumApplied: !!r.flCalculadoMinimo,
        minimumPremium: num(r, 'vlPremioMinimoCliente'),
        clientRates: {
          base: num(r, 'txBasicaCliente'),
          extra: num(r, 'txAdicionalCliente'),
          war: num(r, 'txGuerraGreveCliente'),
        },
        insurerRates: {
          base: num(r, 'txBasicaSeguradora'),
          extra: num(r, 'txAdicionalSeguradora'),
          war: num(r, 'txGuerraGreveSeguradora'),
        },
        taxRates: { client: num(r, 'txTotalImpostos'), insurer: num(r, 'vlTotalImpostoSeguradora') },
        partnerPercent: num(r, 'vlComissaoParceiro'),
        payableDiscountPercent: 25,
        irb: num(r, 'vlIrbDolar'),
      }),
    };
  });

  const hits = (pick: (x: (typeof results)[number]) => [number, number]) =>
    results.filter((x) => {
      const [a, b] = pick(x);
      return Math.abs(a - b) < 0.001;
    }).length;

  it('I.S., prêmio do cliente e da seguradora batem em todos', () => {
    expect(hits((x) => [x.out.insuredAmount, num(x.r, 'impSegurada')])).toBe(rows.length);
    expect(hits((x) => [x.out.premiumClient, num(x.r, 'vlFinalPremioCliente')])).toBe(rows.length);
    expect(hits((x) => [x.out.premiumInsurer, num(x.r, 'vlFinalPremioSeguradora')])).toBe(rows.length);
  });

  it('a pagar c/ agravo e diferença batem em todos', () => {
    expect(hits((x) => [x.out.insurerPayable, roundHalfUpExact(num(x.r, 'vlDolarAPagarAgravo20'))])).toBe(rows.length);
    expect(hits((x) => [x.out.grossMargin, roundHalfUpExact(num(x.r, 'vlDiferencaDolar'))])).toBe(rows.length);
  });

  it('comissão e resultado batem com a regra do legado', () => {
    expect(hits((x) => [x.out.commissions.partner, num(x.r, 'vlComissaoParceiroDolar')])).toBeGreaterThanOrEqual(rows.length - 2);
    expect(hits((x) => [x.out.netResult, num(x.r, 'vlResultadoDolar')])).toBeGreaterThanOrEqual(rows.length - 2);
  });
});

const money = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

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
    expect(result.payableDiscount).toBe(0);
  });

  it('o agravo é desconto: abate do valor a pagar à seguradora', () => {
    // Importação 25 % — conferido em 35 numerários pagos do legado
    // (`vlDolarAPagarAgravo20` = `vlDolarAPagar` × 0,75), ver docs/19.
    const result = calculateQuote({ ...base, payableDiscountPercent: 25 });
    // 50,00 × 25 % = 12,50; o que a corretora paga é o resto.
    expect(result.payableDiscount).toBe(12.5);
    expect(result.insurerPayable).toBe(37.5);
  });

  it('usa o percentual de exportação quando informado', () => {
    // Exportação também 25 % (324/324 no legado); prêmio maior para checar o arredondamento.
    const result = calculateQuote({
      ...base,
      kind: QuoteKind.EXPORT,
      payableDiscountPercent: 25,
    });
    expect(result.payableDiscount).toBe(money(result.premiumInsurer * 0.25));
    expect(result.insurerPayable).toBe(
      money(result.premiumInsurer - result.payableDiscount),
    );
  });

  it('o agravo entra na margem bruta — é a rentabilidade do processo', () => {
    const semAgravo = calculateQuote(base);
    const comAgravo = calculateQuote({ ...base, payableDiscountPercent: 25 });
    expect(comAgravo.grossMargin).toBe(
      money(semAgravo.grossMargin + comAgravo.payableDiscount),
    );
  });

  it('nunca gera pagamento negativo, mesmo com percentual absurdo', () => {
    const result = calculateQuote({ ...base, payableDiscountPercent: 150 });
    expect(result.insurerPayable).toBe(0);
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
