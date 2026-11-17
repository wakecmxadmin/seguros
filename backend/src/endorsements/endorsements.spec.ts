import { EndorsementType } from '@prisma/client';
import { endorsementNumberValue, endorsementsCsv, type CsvEndorsement } from './endorsement-csv';
import { extensionFigures } from './extension-math';

describe('extensionFigures', () => {
  it('cobra 20 % dos prêmios, como os numerários do legado', () => {
    // prêmio do cliente 54,37 × 20 % = 10,874 → 10,87
    expect(extensionFigures({ premiumClient: 54.37, premiumInsurer: 10.03, percent: 20, exchangeRate: 5.4321 })).toEqual({
      premiumClient: 10.87,
      premiumInsurer: 2.01,
      premiumClientBrl: 59.05, // 10,87 × 5,4321 = 59,0469
    });
  });

  it('respeita percentual informado na prorrogação', () => {
    expect(extensionFigures({ premiumClient: 100, premiumInsurer: 40, percent: 12.5, exchangeRate: 0 })).toEqual({
      premiumClient: 12.5,
      premiumInsurer: 5,
      premiumClientBrl: 0,
    });
  });
});

describe('endorsementNumberValue', () => {
  it.each([
    ['D-106493', 106493],
    ['P-0042', 42],
    ['E-00007', 7],
    ['106493', 106493],
  ])('%s → %s', (input, expected) => expect(endorsementNumberValue(input)).toBe(expected));

  it('sem dígitos não entra em faixa nenhuma', () => {
    expect(endorsementNumberValue('PRG')).toBeNaN();
  });
});

describe('endorsementsCsv', () => {
  const row = {
    number: 'D-000001',
    type: EndorsementType.FINAL,
    issuedAt: new Date('2026-11-10T12:00:00Z'),
    berthingDate: null,
    blNumber: 'MSCU;123',
    containerNumber: null,
    insuredAmount: 1234.5,
    premiumInsurer: 2,
    currency: { code: 'USD' },
    vessel: null,
    quote: {
      number: 2720,
      kind: 'IMPORT',
      modal: 'SEA',
      client: { legalName: 'Cliente "Teste"', document: '06337280000100' },
      originCountry: { name: 'China' },
      destinationCountry: null,
    },
  } as unknown as CsvEndorsement;

  it('sai com BOM, ponto e vírgula e campos escapados', () => {
    const csv = endorsementsCsv([row]);
    expect(csv.startsWith('﻿Averbacao;Tipo;Data')).toBe(true);
    const line = csv.split('\r\n')[1];
    expect(line).toContain('D-000001;Definitiva;2026-11-10;2720;"Cliente ""Teste""";06337280000100;"MSCU;123"');
    expect(line.endsWith(';USD;1234.50;2.00;')).toBe(true);
  });
});
