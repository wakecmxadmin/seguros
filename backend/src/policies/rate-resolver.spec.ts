import { Modal, QuoteKind } from '@prisma/client';
import {
  describeScope,
  resolveClientRate,
  specificity,
  type ClientRateCandidate,
} from './rate-resolver';

function rate(overrides: Partial<ClientRateCandidate> = {}): ClientRateCandidate {
  return {
    id: Math.random().toString(36).slice(2),
    policyId: null,
    coverageId: null,
    commodityTypeId: null,
    modal: null,
    kind: null,
    rateClient: 0,
    rateInsurer: 0,
    minimumPremium: null,
    validFrom: null,
    validTo: null,
    active: true,
    ...overrides,
  };
}

const context = {
  policyId: 'pol-1',
  coverageId: 'cov-1',
  commodityTypeId: 'com-1',
  modal: Modal.SEA,
  kind: QuoteKind.IMPORT,
  date: new Date('2026-09-02'),
};

describe('resolveClientRate', () => {
  it('devolve null quando o cliente não tem regra', () => {
    expect(resolveClientRate([], context)).toBeNull();
  });

  it('usa a regra geral quando é a única', () => {
    const geral = rate({ rateClient: 0.3 });
    expect(resolveClientRate([geral], context)?.id).toBe(geral.id);
  });

  it('prefere a regra mais específica sobre a geral', () => {
    const geral = rate({ rateClient: 0.3 });
    const doModal = rate({ modal: Modal.SEA, rateClient: 0.2 });

    expect(resolveClientRate([geral, doModal], context)?.id).toBe(doModal.id);
  });

  it('apólice pesa mais que modal', () => {
    const porModal = rate({ modal: Modal.SEA });
    const porApolice = rate({ policyId: 'pol-1' });

    expect(resolveClientRate([porModal, porApolice], context)?.id).toBe(porApolice.id);
  });

  it('combinação de escopos vence escopo único', () => {
    const soApolice = rate({ policyId: 'pol-1' });
    const apoliceEModal = rate({ policyId: 'pol-1', modal: Modal.SEA });

    expect(resolveClientRate([soApolice, apoliceEModal], context)?.id).toBe(apoliceEModal.id);
  });

  it('ignora regra cujo escopo não bate com o processo', () => {
    const outroModal = rate({ modal: Modal.AIR, rateClient: 0.1 });
    const geral = rate({ rateClient: 0.3 });

    expect(resolveClientRate([outroModal, geral], context)?.id).toBe(geral.id);
  });

  it('ignora regra de outra apólice mesmo sendo mais específica', () => {
    const outraApolice = rate({ policyId: 'pol-999', modal: Modal.SEA });
    const geral = rate({});

    expect(resolveClientRate([outraApolice, geral], context)?.id).toBe(geral.id);
  });

  it('ignora regra inativa', () => {
    const inativa = rate({ modal: Modal.SEA, active: false });
    const geral = rate({});

    expect(resolveClientRate([inativa, geral], context)?.id).toBe(geral.id);
  });

  it('respeita a vigência', () => {
    const expirada = rate({ modal: Modal.SEA, validTo: new Date('2026-01-01') });
    const futura = rate({ modal: Modal.SEA, validFrom: new Date('2027-01-01') });
    const vigente = rate({ modal: Modal.SEA, validFrom: new Date('2026-01-01') });

    expect(resolveClientRate([expirada, futura, vigente], context)?.id).toBe(vigente.id);
  });

  it('no empate de especificidade, a vigência mais recente vence', () => {
    const antiga = rate({ modal: Modal.SEA, validFrom: new Date('2025-01-01') });
    const nova = rate({ modal: Modal.SEA, validFrom: new Date('2026-06-01') });

    expect(resolveClientRate([antiga, nova], context)?.id).toBe(nova.id);
  });

  it('separa importação de exportação', () => {
    const exportacao = rate({ kind: QuoteKind.EXPORT, rateClient: 0.9 });
    const importacao = rate({ kind: QuoteKind.IMPORT, rateClient: 0.1 });

    expect(resolveClientRate([exportacao, importacao], context)?.id).toBe(importacao.id);
  });
});

describe('specificity', () => {
  it('cresce com o número de escopos', () => {
    expect(specificity(rate({}))).toBe(0);
    expect(specificity(rate({ modal: Modal.SEA }))).toBe(1);
    expect(specificity(rate({ policyId: 'x' }))).toBe(8);
    expect(specificity(rate({ policyId: 'x', coverageId: 'y' }))).toBe(12);
  });
});

describe('describeScope', () => {
  it('descreve a regra sem escopo', () => {
    expect(describeScope(rate({}))).toBe('Todos os processos deste cliente');
  });

  it('descreve a combinação de escopos', () => {
    const scope = describeScope(
      rate({ kind: QuoteKind.IMPORT, modal: Modal.SEA, policyId: 'p' }),
      { policy: '0279-8202' },
    );
    expect(scope).toBe('Importação · apólice 0279-8202 · marítimo');
  });
});
