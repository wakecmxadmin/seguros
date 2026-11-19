import {
  extractSigraId,
  incotermFromSigra,
  mapSigraAgencyToQuoteDraft,
  mapSigraToQuoteDraft,
  modalFromSigra,
} from './sigra-draft-mapper';
import type { SigraAgencyProcess, SigraProcessSummary } from '../sigra/sigra-process.types';

/** Casos tirados das rodadas de mapeamento do SIGRA (docs/21), com os valores reais. */

describe('extractSigraId', () => {
  it.each([
    ['FRES0579/26  1927944', 1927944],
    ['KLE 116/2026  1925212', 1925212],
    ['1923284   KLE 117/2026', 1923284],
    ['1935396', 1935396],
    ['PO 260172', null],
    ['E26068 - ZD050', null],
    ['PINHO7509 006/2026', null],
    ['', null],
    [null, null],
  ])('%s → %s', (text, expected) => {
    expect(extractSigraId(text as string | null)).toBe(expected);
  });

  it('ignora números maiores que 7 dígitos (CNPJ, CE Mercante)', () => {
    expect(extractSigraId('CE 162605362827511')).toBeNull();
    expect(extractSigraId('06337280000100')).toBeNull();
  });
});

describe('catálogos do SIGRA', () => {
  it('modal por global.sx_modal.id', () => {
    expect(modalFromSigra('1')).toBe('SEA');
    expect(modalFromSigra('3')).toBe('AIR');
    expect(modalFromSigra('2')).toBe('ROAD');
    expect(modalFromSigra('7')).toBe('RAIL');
    expect(modalFromSigra('5')).toBeNull(); // meios próprios
    expect(modalFromSigra(null)).toBeNull();
  });

  it('incoterm pelo código, inclusive DPU e OCV', () => {
    expect(incotermFromSigra('CIP')).toBe('CIP');
    expect(incotermFromSigra(' fob ')).toBe('FOB');
    expect(incotermFromSigra('DPU')).toBe('DPU');
    expect(incotermFromSigra('OCV')).toBe('OCV');
    expect(incotermFromSigra('XYZ')).toBeNull();
  });
});

const summary = (overrides: Partial<SigraProcessSummary> = {}): SigraProcessSummary => ({
  id: '1935396',
  cdDi: null, tipoServico: null, statusRegistro: null,
  docCarga: 'HRY26900757', docCargaMaster: null, tipoConhecimento: 'BL',
  localEmbarque: 'CNTAO - TSINGTAO',
  dtRegistro: null, dtEmbarque: new Date('2026-09-27T04:00:00Z'), dtPresencaCarga: null,
  dtChegadaBrasil: null, dtLiberacao: null, dtParametrizacao: null, dtInicioDesova: null, dtFimDesova: null,
  pesoBruto: '1500.5', pesoLiquido: null,
  vlFretePrepaidExt: null, vlFreteCollectExt: null, vlFrete: null, vlFreteExt: '820',
  vlFob: null, vlFobExt: '12345.67', vlSeguro: null, vlSeguroExt: null, vlSiscomex: null,
  vlTaxasCapatazia: null, vlTaxasDiversas: null, vlAduaneiroBrl: null, vlAduaneiroExt: null,
  vlTaxaDolar: '5.8', vlIi: '100', vlIpi: '50', vlPis: null, vlCofins: '10',
  ceMercante: '162605366288445', avaria: null,
  codigo: '260174',
  clientDocument: '04.049.640/0001-00',
  clientName: 'MULTI MERCANTES LTDA',
  modalId: '1',
  currencyCode: 'usd',
  incotermCode: 'FOB',
  invoiceNumber: '26empalux0608',
  arrivalDate: '2026-11-11',
  ...overrides,
});

describe('mapSigraToQuoteDraft (importação)', () => {
  const draft = mapSigraToQuoteDraft({ summary: summary(), additions: [], items: [], containers: [] });

  it('sugere modal, incoterm, invoice e a referência no formato do legado', () => {
    expect(draft.kind).toBe('IMPORT');
    expect(draft.suggestion.modal).toBe('SEA');
    expect(draft.suggestion.incoterm).toBe('FOB');
    expect(draft.suggestion.invoiceNumber).toBe('26empalux0608');
    expect(draft.suggestion.reference).toBe('260174  1935396');
  });

  it('passa as chaves para resolver cliente, moeda e porto', () => {
    expect(draft.keys.clientDocument).toBe('04049640000100');
    expect(draft.keys.currencyCode).toBe('USD');
    expect(draft.keys.originLocode).toBe('CNTAO');
  });

  it('valores e chegada', () => {
    expect(draft.suggestion.cost).toBe(12345.67);
    expect(draft.suggestion.freight).toBe(820);
    expect(draft.suggestion.taxes).toBe(160);
    expect(draft.info.arrivalDate).toBe('2026-11-11');
    expect(draft.info.documentNumber).toBe('HRY26900757');
    expect(draft.missing).toEqual([]);
  });

  it('cai no tipo de conhecimento quando o modal não vem', () => {
    const air = mapSigraToQuoteDraft({
      summary: summary({ modalId: null, tipoConhecimento: 'AWB' }),
      additions: [], items: [], containers: [],
    });
    expect(air.suggestion.modal).toBe('AIR');
  });

  it('avisa o que falta', () => {
    const empty = mapSigraToQuoteDraft({
      summary: summary({ clientDocument: null, currencyCode: null, vlFobExt: null }),
      additions: [], items: [], containers: [],
    });
    expect(empty.missing).toEqual(['Cliente', 'Moeda', 'Valor da mercadoria']);
  });
});

const agency = (overrides: Partial<SigraAgencyProcess> = {}): SigraAgencyProcess => ({
  id: '1921824',
  codigo: 'Pi/2264/26',
  clientDocument: '05445030000125',
  clientName: 'Kalay do Brasil Ltda',
  clientReference: 'KLE 109/2026',
  incotermCode: 'CIP',
  modalId: '3',
  cargoType: 'Aéreo',
  origin: 'CURITIBA VIA GUARULHOS',
  destination: 'NAIROBI - Quênia',
  finalDestination: null,
  vesselName: null,
  voyage: null,
  flight: 'LH6965S',
  documentNumber: '020-03846533',
  departureDate: '2026-10-15',
  arrivalDate: '2026-10-21',
  dueNumber: null,
  ...overrides,
});

describe('mapSigraAgencyToQuoteDraft (exportação)', () => {
  const draft = mapSigraAgencyToQuoteDraft(agency());

  it('traz a logística e a referência do cliente como fatura', () => {
    expect(draft.kind).toBe('EXPORT');
    expect(draft.suggestion.modal).toBe('AIR');
    expect(draft.suggestion.incoterm).toBe('CIP');
    expect(draft.suggestion.invoiceNumber).toBe('KLE 109/2026');
    expect(draft.suggestion.reference).toBe('Pi/2264/26  1921824');
    expect(draft.keys.destinationCountryName).toBe('Quênia');
    expect(draft.info.vessel).toBe('Voo LH6965S');
    expect(draft.info.documentNumber).toBe('020-03846533');
  });

  it('não inventa valor de mercadoria nem frete: o SIGRA não tem', () => {
    expect(draft.suggestion.cost).toBeNull();
    expect(draft.suggestion.freight).toBeNull();
    expect(draft.missing).toEqual(['Valor da mercadoria', 'Frete', 'Moeda']);
  });

  it('marítimo: navio e viagem; destino sem país não resolve país', () => {
    const sea = mapSigraAgencyToQuoteDraft(
      agency({ modalId: '1', destination: 'Caucedo', vesselName: 'COSTA RICA EXPRESS', voyage: '2632N', flight: null }),
    );
    expect(sea.suggestion.modal).toBe('SEA');
    expect(sea.info.vessel).toBe('COSTA RICA EXPRESS · 2632N');
    expect(sea.keys.destinationCountryName).toBeNull();
  });
});
