import JSZip from 'jszip';
import { amountInWords, integerInWords } from './amount-in-words';
import { listPlaceholders, mergeDocx } from './docx-merge';
import { formatDocument, importScenarios, proposalValues, type ProposalQuote } from './proposal-values';

describe('amountInWords', () => {
  it.each([
    [0, 'zero real'],
    [1, 'um real'],
    [0.01, 'um centavo'],
    [100, 'cem reais'],
    [101, 'cento e um reais'],
    [1000, 'mil reais'],
    [1001, 'mil e um reais'],
    [1100, 'mil e cem reais'],
    [1234.56, 'mil duzentos e trinta e quatro reais e cinquenta e seis centavos'],
    [21000, 'vinte e um mil reais'],
    [1_000_000, 'um milhão de reais'],
    [2_500_000, 'dois milhões e quinhentos mil reais'],
    [1_200_300, 'um milhão duzentos mil e trezentos reais'],
    [54.38, 'cinquenta e quatro reais e trinta e oito centavos'],
  ])('%s → %s', (value, expected) => {
    expect(amountInWords(value)).toBe(expected);
  });

  it('inteiros sem moeda', () => {
    expect(integerInWords(999)).toBe('novecentos e noventa e nove');
    expect(integerInWords(16)).toBe('dezesseis');
  });
});

async function docx(paragraphs: string[]) {
  const zip = new JSZip();
  zip.file(
    'word/document.xml',
    `<?xml version="1.0"?><w:document xmlns:w="w"><w:body>${paragraphs
      .map((p) => `<w:p>${p}</w:p>`)
      .join('')}</w:body></w:document>`,
  );
  zip.file('word/header1.xml', '<w:hdr xmlns:w="w"><w:p><w:r><w:t>Proc. [cdTransacao]</w:t></w:r></w:p></w:hdr>');
  return zip.generateAsync({ type: 'nodebuffer' });
}

async function documentText(buffer: Buffer, part = 'word/document.xml') {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file(part)!.async('string');
  return [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
}

describe('mergeDocx', () => {
  it('troca marcadores no corpo e no cabeçalho, escapando XML', async () => {
    const input = await docx(['<w:r><w:t>Á [deCliente], apólice [cdApolice]</w:t></w:r>']);
    const { buffer, unresolved } = await mergeDocx(input, {
      deCliente: 'A & B Ltda',
      cdApolice: '123',
      cdTransacao: '2085',
    });
    expect(await documentText(buffer)).toBe('Á A &amp; B Ltda, apólice 123');
    expect(await documentText(buffer, 'word/header1.xml')).toBe('Proc. 2085');
    expect(unresolved).toEqual([]);
  });

  it('junta marcador partido entre runs pelo Word', async () => {
    const input = await docx([
      '<w:r><w:t>Cliente: [de</w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>Cli</w:t></w:r><w:r><w:t>ente] fim</w:t></w:r>',
    ]);
    const { buffer } = await mergeDocx(input, { deCliente: 'FRESNOMAQ', cdTransacao: '1' });
    expect(await documentText(buffer)).toBe('Cliente: FRESNOMAQ fim');
  });

  it('marcador sem valor fica no texto e é reportado', async () => {
    const input = await docx(['<w:r><w:t>[deCliente] [campoInexistente]</w:t></w:r>']);
    const { buffer, unresolved } = await mergeDocx(input, { deCliente: 'X', cdTransacao: '1' });
    expect(await documentText(buffer)).toBe('X [campoInexistente]');
    expect(unresolved).toEqual(['campoInexistente']);
  });

  it('lista os marcadores do modelo', async () => {
    const input = await docx(['<w:r><w:t>[b] [a]</w:t></w:r>']);
    expect(await listPlaceholders(input)).toEqual(['a', 'b', 'cdTransacao']);
  });
});

const quote: ProposalQuote = {
  number: 2085,
  kind: 'IMPORT',
  modal: 'SEA',
  incoterm: 'CFR',
  clientName: 'Cliente Teste',
  clientDocument: '06337280000100',
  contactName: 'Fulano',
  policyNumber: '0279820',
  insurerName: 'AKAD',
  commodity: 'Máquinas',
  invoiceNumber: 'INV-1',
  origin: 'Qingdao, China',
  destination: 'Paranaguá, Brasil',
  packaging: 'Caixa',
  currencyCode: 'USD',
  notes: null,
  weightKg: 1500,
  insuredAmount: 8164.21,
  premiumClient: 30,
  minimumPremiumApplied: false,
  warStrike: false,
  expensePercent: 10,
  profitPercent: 10,
  lines: [
    { item: 'COST', amount: 7056.06, baseRateClient: 0.1, extraRateClient: 0.05, warRateClient: 0.02, premiumClient: 10.58 },
    { item: 'FREIGHT', amount: 365.95, baseRateClient: 0.1, extraRateClient: 0.05, warRateClient: 0.02, premiumClient: 0.55 },
    { item: 'EXPENSES', amount: 742.2, baseRateClient: 0.1, extraRateClient: 0.05, warRateClient: 0.02, premiumClient: 1.11 },
    { item: 'EXPECTED_PROFIT', amount: 0, baseRateClient: 0.1, extraRateClient: 0.05, warRateClient: 0.02, premiumClient: 0 },
    { item: 'TAXES', amount: 2000, baseRateClient: 0, extraRateClient: 0, warRateClient: 0, premiumClient: 0 },
  ],
};

describe('importScenarios', () => {
  it('cenário que depende de verba ausente sai zerado (lucros desmarcados)', () => {
    const s = Object.fromEntries(importScenarios(quote).map((x) => [x.key, x]));
    // base 7.422,01; despesas 742,20; taxa 0,15 %; impostos 2.000 com taxa 0
    expect(s.fobFr).toEqual({ key: 'fobFr', insured: 7422.01, premium: 11.13 });
    expect(s.fobFrDes.insured).toBe(8164.21);
    expect(s.fobFrDesLuc).toEqual({ key: 'fobFrDesLuc', insured: 0, premium: 0 });
    expect(s.fobFrImp.insured).toBe(9422.01);
    expect(s.fobFrDesLucImp).toEqual({ key: 'fobFrDesLucImp', insured: 0, premium: 0 });
  });

  it('confere com o legado — processo 2041, D-107166 (todas as verbas)', () => {
    const line = (item: ProposalQuote['lines'][number]['item'], amount: number) => ({
      item, amount, baseRateClient: 0.13, extraRateClient: 0, warRateClient: 0, premiumClient: 0,
    });
    const s = Object.fromEntries(
      importScenarios({
        ...quote,
        warStrike: true,
        minimumPremiumApplied: false,
        premiumClient: 166.04,
        lines: [
          line('COST', 61189.5),
          line('FREIGHT', 19000),
          line('EXPENSES', 8018.95),
          line('EXPECTED_PROFIT', 8820.84),
          line('TAXES', 30691.29),
        ],
      }).map((x) => [x.key, x]),
    );
    // Valores fobFr*Is/Pr do legado, arredondados.
    expect(s.fobFr).toEqual({ key: 'fobFr', insured: 80189.5, premium: 104.25 });
    expect(s.fobFrDes).toEqual({ key: 'fobFrDes', insured: 88208.45, premium: 114.67 });
    expect(s.fobFrDesLuc).toEqual({ key: 'fobFrDesLuc', insured: 97029.29, premium: 126.14 });
    expect(s.fobFrImp).toEqual({ key: 'fobFrImp', insured: 110880.79, premium: 144.15 });
    expect(s.fobFrDesImp).toEqual({ key: 'fobFrDesImp', insured: 118899.74, premium: 154.57 });
    expect(s.fobFrDesLucImp).toEqual({ key: 'fobFrDesLucImp', insured: 127720.58, premium: 166.04 });
  });

  it('com guerra e greve, a taxa inclui o adicional', () => {
    const s = importScenarios({ ...quote, warStrike: true });
    expect(s[0].premium).toBe(12.62); // 7.422,01 × 0,17 %
  });

  it('aplica o piso só quando a cotação usou prêmio mínimo', () => {
    const s = importScenarios({ ...quote, minimumPremiumApplied: true, premiumClient: 30 });
    expect(s.filter((x) => x.insured > 0).every((x) => x.premium >= 30)).toBe(true);
  });
});

describe('proposalValues', () => {
  it('formata números em pt-BR e o CNPJ', () => {
    const v = proposalValues(quote);
    expect(v.cnpj).toBe('06.337.280/0001-00');
    expect(v.vlMercadoria).toBe('7.056,06');
    expect(v.fobFrDesIs).toBe('8.164,21');
    expect(v.deModal).toBe('Marítimo');
    expect(v.vlPeso).toBe('1.500,000');
  });

  it('exportação não leva os cenários de importação', () => {
    expect(proposalValues({ ...quote, kind: 'EXPORT' }).fobFrIs).toBeUndefined();
  });

  it('CPF também é formatado', () => {
    expect(formatDocument('12345678901')).toBe('123.456.789-01');
  });
});
