/**
 * Valores dos marcadores da proposta (docs/16-legado-documentos.md § 7.3–7.4).
 *
 * Os nomes são os do legado, para que os modelos .docx atuais funcionem sem
 * edição. Função pura: recebe a cotação já carregada e devolve strings.
 */

import { money, percentOf } from '../common/money';

export interface ProposalQuote {
  number: number;
  kind: 'IMPORT' | 'EXPORT';
  modal: 'AIR' | 'SEA' | 'ROAD' | 'RAIL';
  incoterm: string;
  clientName: string;
  clientDocument: string | null;
  contactName: string | null;
  policyNumber: string | null;
  insurerName: string | null;
  commodity: string | null;
  invoiceNumber: string | null;
  origin: string | null;
  destination: string | null;
  packaging: string | null;
  currencyCode: string;
  notes: string | null;
  weightKg: number;

  insuredAmount: number;
  premiumClient: number;
  minimumPremiumApplied: boolean;
  warStrike: boolean;
  expensePercent: number;
  profitPercent: number;

  /** Grade de taxas gravada na cotação. */
  lines: {
    item: 'COST' | 'FREIGHT' | 'EXPENSES' | 'EXPECTED_PROFIT' | 'TAXES' | 'CIF_VALUE';
    amount: number;
    baseRateClient: number;
    extraRateClient: number;
    warRateClient: number;
    premiumClient: number;
  }[];
}

const MODAL: Record<ProposalQuote['modal'], string> = {
  AIR: 'Aéreo',
  SEA: 'Marítimo',
  ROAD: 'Rodoviário',
  RAIL: 'Ferroviário',
};

/** 1234.5 → "1.234,50" */
export function brNumber(value: number, digits = 2) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** CNPJ/CPF formatado a partir dos dígitos. */
export function formatDocument(digits: string | null) {
  if (!digits) return '';
  if (digits.length === 14)
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (digits.length === 11) return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return digits;
}

export interface Scenario {
  key: string;
  insured: number;
  premium: number;
}

/**
 * Os seis cenários da "Estimativa de seguro" da importação.
 *
 * Regra conferida contra 385 importações pagas do legado, que guardam os seis
 * pares `fobFr*Is`/`fobFr*Pr` (docs/19, rodada 2):
 *   - despesas, lucros e impostos são os da própria cotação; o cenário que
 *     depende de uma verba ausente sai zerado;
 *   - a linha de impostos é tarifada, com a taxa dela;
 *   - prêmio = max(round(base × taxa + impostos × taxa de impostos), piso).
 */
export function importScenarios(q: ProposalQuote): Scenario[] {
  const line = (item: ProposalQuote['lines'][number]['item']) => q.lines.find((l) => l.item === item);
  const total = (l?: ProposalQuote['lines'][number]) =>
    l ? l.baseRateClient + l.extraRateClient + (q.warStrike ? l.warRateClient : 0) : 0;

  const cost = line('COST')?.amount ?? 0;
  const freight = line('FREIGHT')?.amount ?? 0;
  const expenses = line('EXPENSES')?.amount ?? 0;
  const profit = line('EXPECTED_PROFIT')?.amount ?? 0;
  const taxes = line('TAXES')?.amount ?? 0;

  const rate = total(line('COST') ?? line('FREIGHT'));
  const taxRate = line('TAXES') ? total(line('TAXES')) : rate;

  // Piso: a cotação guarda o prêmio já com o mínimo; se ele ficou acima da
  // soma das linhas, a diferença é o mínimo aplicado. (Sem o valor do piso
  // gravado na cotação — tarefa 36 — não dá para aplicá-lo quando a cotação
  // inteira ficou acima dele.)
  const linesPremium = money(q.lines.reduce((acc, l) => acc + l.premiumClient, 0));
  const floor = q.minimumPremiumApplied && q.premiumClient > linesPremium ? q.premiumClient : 0;

  const scenario = (key: string, parts: { expenses?: boolean; profit?: boolean; taxes?: boolean }) => {
    const available =
      (!parts.expenses || expenses > 0) && (!parts.profit || profit > 0) && (!parts.taxes || taxes > 0);
    if (!available) return { key, insured: 0, premium: 0 };

    const tariffed = cost + freight + (parts.expenses ? expenses : 0) + (parts.profit ? profit : 0);
    const taxed = parts.taxes ? taxes : 0;
    return {
      key,
      insured: money(tariffed + taxed),
      premium: Math.max(money(percentOf(tariffed, rate) + percentOf(taxed, taxRate)), floor),
    };
  };

  return [
    scenario('fobFr', {}),
    scenario('fobFrDes', { expenses: true }),
    scenario('fobFrDesLuc', { expenses: true, profit: true }),
    scenario('fobFrImp', { taxes: true }),
    scenario('fobFrDesImp', { expenses: true, taxes: true }),
    scenario('fobFrDesLucImp', { expenses: true, profit: true, taxes: true }),
  ];
}

export function proposalValues(q: ProposalQuote): Record<string, string> {
  const amount = (item: string) => q.lines.find((l) => l.item === item)?.amount ?? 0;

  const values: Record<string, string> = {
    deCliente: q.clientName,
    deContato: q.contactName ?? '',
    cdApolice: q.policyNumber ?? '',
    cdTransacao: String(q.number),
    cnpj: formatDocument(q.clientDocument),
    deSeguradora: q.insurerName ?? '',
    deMercadoria: q.commodity ?? '',
    deGuia: q.invoiceNumber ?? '',
    deModal: MODAL[q.modal],
    deOrigem: q.origin ?? '',
    deDestino: q.destination ?? '',
    deEmbalagem: q.packaging ?? '',
    deMoedaSigla: q.currencyCode,
    deObservacao: q.notes ?? '',
    vlPeso: brNumber(q.weightKg, 3),
    vlMercadoria: brNumber(amount('COST')),
    vlFrete: brNumber(amount('FREIGHT')),
    vlFinalPremioCliente: brNumber(q.premiumClient),
    deTipoValor: q.incoterm,
    vlFinalImpostoSeguradora: brNumber(q.insuredAmount),
  };

  if (q.kind === 'IMPORT') {
    for (const s of importScenarios(q)) {
      values[`${s.key}Is`] = brNumber(s.insured);
      values[`${s.key}Pr`] = brNumber(s.premium);
    }
  }

  return values;
}
