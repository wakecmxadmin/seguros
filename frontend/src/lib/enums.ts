/** Rótulos em português dos enums do backend. Fonte única para selects e badges. */

export const Modal = {
  SEA: 'Marítimo',
  AIR: 'Aéreo',
  ROAD: 'Terrestre',
  RAIL: 'Ferroviário',
} as const;

export const CompanyRole = {
  CLIENT: 'Cliente',
  PARTNER: 'Parceiro',
  INSURER: 'Seguradora',
  CARRIER: 'Transportadora',
  SURVEYOR: 'Vistoriador',
} as const;

export const QuoteKind = {
  IMPORT: 'Importação',
  EXPORT: 'Exportação',
} as const;

export const QuoteStatus = {
  QUOTE: 'Cotação',
  PROVISIONAL: 'Provisória',
  FINAL: 'Definitiva',
} as const;

export const QuotePosition = {
  OPEN_PROPOSAL: 'Proposta em aberto',
  APPROVED: 'Aprovada',
  REJECTED: 'Reprovada',
  PENDING: 'Pendente',
  FOLLOW_UP: 'Follow-up',
  CANCELED: 'Cancelada',
} as const;

export const CargoCondition = {
  NEW: 'Nova',
  USED: 'Usada',
} as const;

export const Incoterm = {
  EXW: 'EXW', FCA: 'FCA', FAS: 'FAS', FOB: 'FOB', CFR: 'CFR', CIF: 'CIF',
  CPT: 'CPT', CIP: 'CIP', DAP: 'DAP', DAT: 'DAT', DDU: 'DDU', DDP: 'DDP', CI: 'CI',
} as const;

export const BillingVia = {
  BROKER: 'Corretora',
  PARTNER: 'Parceiro',
} as const;

export const BudgetMode = {
  RATES: 'Taxas',
  VALUES: 'Valores',
} as const;

export const DeclaredValue = {
  DECLARED: 'Com valor declarado',
  AIR_NO_DECLARED_INCLUDED: 'Cobertura aérea sem valor declarado já incluída',
  NOT_DECLARED: 'Sem valor declarado',
  NA: 'Não se aplica',
} as const;

export const RateLineItem = {
  COST: 'Custo',
  FREIGHT: 'Frete',
  EXPENSES: 'Despesas',
  EXPECTED_PROFIT: 'Lucros esperados',
  TAXES: 'Impostos',
  CIF_VALUE: 'Valor CIF',
} as const;

/** Cor de status do processo — preserva a semântica das linhas coloridas do legado. */
export const STATUS_VARIANT = {
  QUOTE: 'quote',
  PROVISIONAL: 'provisional',
  FINAL: 'final',
} as const;
