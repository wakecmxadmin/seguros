import { Modal, QuoteKind } from '@prisma/client';

/**
 * Resolução de taxa por especificidade.
 *
 * "Cada cliente tem uma taxa" (docs/12-reuniao-cliente.md). A regra do cliente
 * pode valer para tudo ou só para uma combinação — apólice, cobertura, modal,
 * tipo de mercadoria. Entre várias regras aplicáveis, vence a mais específica.
 *
 * Ordem final de precedência no motor:
 *   taxa digitada  >  taxa do cliente  >  taxa da cobertura  >  taxa da apólice
 */

export interface ClientRateCandidate {
  id: string;
  policyId: string | null;
  coverageId: string | null;
  commodityTypeId: string | null;
  modal: Modal | null;
  kind: QuoteKind | null;
  rateClient: unknown;
  rateInsurer: unknown;
  minimumPremium: unknown;
  validFrom: Date | null;
  validTo: Date | null;
  active: boolean;
}

export interface RateContext {
  policyId?: string | null;
  coverageId?: string | null;
  commodityTypeId?: string | null;
  modal?: Modal | null;
  kind?: QuoteKind | null;
  date?: Date;
}

/**
 * Peso de cada dimensão. Apólice e cobertura pesam mais porque descrevem o
 * contrato; modal e mercadoria são recortes dentro dele.
 */
const WEIGHTS = {
  policyId: 8,
  coverageId: 4,
  commodityTypeId: 2,
  modal: 1,
  kind: 1,
} as const;

/** Uma regra só se aplica se todo campo preenchido bater com o contexto. */
export function matches(rate: ClientRateCandidate, context: RateContext): boolean {
  if (!rate.active) return false;

  const date = context.date ?? new Date();
  if (rate.validFrom && rate.validFrom > date) return false;
  if (rate.validTo && rate.validTo < date) return false;

  if (rate.policyId && rate.policyId !== context.policyId) return false;
  if (rate.coverageId && rate.coverageId !== context.coverageId) return false;
  if (rate.commodityTypeId && rate.commodityTypeId !== context.commodityTypeId) return false;
  if (rate.modal && rate.modal !== context.modal) return false;
  if (rate.kind && rate.kind !== context.kind) return false;

  return true;
}

export function specificity(rate: ClientRateCandidate): number {
  let score = 0;
  if (rate.policyId) score += WEIGHTS.policyId;
  if (rate.coverageId) score += WEIGHTS.coverageId;
  if (rate.commodityTypeId) score += WEIGHTS.commodityTypeId;
  if (rate.modal) score += WEIGHTS.modal;
  if (rate.kind) score += WEIGHTS.kind;
  return score;
}

/**
 * Escolhe a regra aplicável mais específica. Empate é resolvido pela vigência
 * mais recente — uma renegociação sobrepõe o acordo anterior.
 */
export function resolveClientRate(
  rates: ClientRateCandidate[],
  context: RateContext,
): ClientRateCandidate | null {
  const applicable = rates.filter((rate) => matches(rate, context));
  if (!applicable.length) return null;

  return applicable.sort((a, b) => {
    const bySpecificity = specificity(b) - specificity(a);
    if (bySpecificity !== 0) return bySpecificity;

    const aFrom = a.validFrom?.getTime() ?? 0;
    const bFrom = b.validFrom?.getTime() ?? 0;
    return bFrom - aFrom;
  })[0];
}

/** Descreve o escopo da regra em português, para a interface. */
export function describeScope(
  rate: ClientRateCandidate,
  labels: {
    policy?: string | null;
    coverage?: string | null;
    commodityType?: string | null;
  } = {},
): string {
  const parts: string[] = [];

  if (rate.kind) parts.push(rate.kind === 'IMPORT' ? 'Importação' : 'Exportação');
  if (labels.policy) parts.push(`apólice ${labels.policy}`);
  if (labels.coverage) parts.push(labels.coverage);
  if (labels.commodityType) parts.push(labels.commodityType);
  if (rate.modal) {
    const modal = { AIR: 'aéreo', SEA: 'marítimo', ROAD: 'terrestre', RAIL: 'ferroviário' };
    parts.push(modal[rate.modal]);
  }

  return parts.length ? parts.join(' · ') : 'Todos os processos deste cliente';
}
