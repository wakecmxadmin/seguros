/**
 * Valores dos marcadores da proposta (docs/16-legado-documentos.md § 7.3–7.4).
 *
 * Os nomes são os do legado, para que os modelos .docx atuais funcionem sem
 * edição. Função pura: recebe a cotação já carregada e devolve strings.
 */

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

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

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
 * Os seis cenários da "Estimativa de seguro" da importação: o cliente escolhe
 * quais verbas compõem a I.S. Usa a mesma taxa e a mesma regra do motor de
 * cálculo — impostos entram na I.S. mas não são tarifados, e o piso só vale
 * quando a cotação aplicou prêmio mínimo.
 */
export function importScenarios(q: ProposalQuote): Scenario[] {
  const line = (item: ProposalQuote['lines'][number]['item']) => q.lines.find((l) => l.item === item);
  const cost = line('COST')?.amount ?? 0;
  const freight = line('FREIGHT')?.amount ?? 0;
  const taxes = line('TAXES')?.amount ?? 0;
  const base = round2(cost + freight);

  // Despesas e lucros são oferecidos mesmo quando não foram marcados na
  // cotação: é justamente a escolha que a proposta apresenta ao cliente.
  const expenses = round2((base * q.expensePercent) / 100);
  const profit = round2((base * q.profitPercent) / 100);

  const ref = line('COST') ?? line('FREIGHT');
  const rate = ref
    ? ref.baseRateClient + ref.extraRateClient + (q.warStrike ? ref.warRateClient : 0)
    : 0;

  // Piso: a cotação guarda o prêmio já com o mínimo; se ele ficou acima da
  // soma das linhas, a diferença é o mínimo aplicado.
  const linesPremium = round2(q.lines.reduce((acc, l) => acc + l.premiumClient, 0));
  const floor = q.minimumPremiumApplied && q.premiumClient > linesPremium ? q.premiumClient : 0;

  const premiumOf = (tariffed: number) => Math.max(round2((tariffed * rate) / 100), floor);

  const scenario = (key: string, parts: { expenses?: boolean; profit?: boolean; taxes?: boolean }) => {
    const tariffed = round2(base + (parts.expenses ? expenses : 0) + (parts.profit ? profit : 0));
    return {
      key,
      insured: round2(tariffed + (parts.taxes ? taxes : 0)),
      premium: premiumOf(tariffed),
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
