import { buildRanking, productionFigures, type ProductionInput } from './production-math';

const base: ProductionInput = {
  currencyCode: 'USD',
  exchangeRate: 5.5,
  usdRate: 5.5,
  receiptRate: null,
  insuredAmount: 100000,
  premiumClient: 100,
  premiumInsurer: 40,
  payableDiscountPercent: 25,
  partnerCommission: 30,
  irbUsd: 10,
};

describe('productionFigures', () => {
  it('agravo de 25 % deixa a pagar 75 % do prêmio da seguradora (docs/19)', () => {
    const f = productionFigures(base);
    expect(f.payableUsd).toBe(30);
    expect(f.diffUsd).toBe(70);
  });

  it('resultado usa o prêmio da seguradora cheio — caso real FRESNOMAQ 2720', () => {
    const f = productionFigures({
      ...base,
      premiumClient: 18642.97,
      premiumInsurer: 13093.49,
      partnerCommission: 5592.9,
      irbUsd: 990,
    });
    expect(f.resultUsd).toBe(946.58);
  });

  it('reais saem do valor em US$ já arredondado × taxa do numerário', () => {
    const f = productionFigures({ ...base, premiumClient: 10.005, receiptRate: 5.4321 });
    expect(f.premiumClientUsd).toBe(10.01);
    expect(f.brlRate).toBe(5.4321);
    // 10,01 × 5,4321 = 54,3753 → 54,38 (sem arredondar antes daria 54,35).
    expect(f.premiumClientBrl).toBe(54.38);
  });

  it('sem numerário, usa o câmbio gravado na averbação', () => {
    const f = productionFigures({ ...base, exchangeRate: 5.2, receiptRate: null });
    expect(f.brlRate).toBe(5.2);
    expect(f.premiumClientBrl).toBe(520);
  });

  it('rentabilidade = diferença R$ ÷ prêmio R$, e nula sem prêmio', () => {
    expect(productionFigures(base).profitability).toBe(70);
    expect(productionFigures({ ...base, premiumClient: 0 }).profitability).toBeNull();
  });

  it('converte moeda ≠ USD passando pelo real', () => {
    // 100 EUR × 6,00 = 600 BRL ÷ 5,00 = 120 USD
    const f = productionFigures({
      ...base,
      currencyCode: 'EUR',
      exchangeRate: 6,
      usdRate: 5,
      premiumClient: 100,
    });
    expect(f.premiumClientUsd).toBe(120);
    expect(f.brlRate).toBe(5);
    expect(f.missingRate).toBe(false);
  });

  it('sinaliza falta de câmbio em vez de inventar valor', () => {
    const f = productionFigures({ ...base, currencyCode: 'EUR', usdRate: 0 });
    expect(f.missingRate).toBe(true);
    expect(f.premiumClientUsd).toBe(0);
  });
});

describe('buildRanking', () => {
  const row = (quoteId: string, clientId: string, partner: string, premium: number) => ({
    ...productionFigures({ ...base, premiumClient: premium }),
    quoteId,
    clientId,
    partner,
  });

  it('percentual é sobre o prêmio do cliente e o total vem separado', () => {
    const rows = [
      row('q1', 'c1', 'ASCENSUS', 300),
      row('q2', 'c2', 'ASCENSUS', 100),
      row('q3', 'c3', 'Pinho', 100),
    ];
    const ranking = buildRanking(rows, (r) => ({ key: r.partner, label: r.partner }));

    expect(ranking.rows.map((r) => [r.position, r.label, r.percent])).toEqual([
      [1, 'ASCENSUS', 80],
      [2, 'Pinho', 20],
    ]);
    expect(ranking.rows[0].processes).toBe(2);
    expect(ranking.rows[0].clients).toBe(2);
    expect(ranking.totals.premiumClientUsd).toBe(500);
    expect(ranking.totals.processes).toBe(3);
  });

  it('duas definitivas do mesmo processo contam um processo só', () => {
    const rows = [row('q1', 'c1', 'A', 50), row('q1', 'c1', 'A', 50)];
    const ranking = buildRanking(rows, (r) => ({ key: r.partner, label: r.partner }));
    expect(ranking.rows[0].processes).toBe(1);
    expect(ranking.rows[0].premiumClientUsd).toBe(100);
  });
});
