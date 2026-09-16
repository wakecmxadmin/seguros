import { Modal } from '@/lib/enums';

export type FieldType = 'text' | 'number' | 'rate' | 'select' | 'switch';

export interface CatalogField {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  /** Para `select`: opções fixas ou o catálogo de onde buscá-las. */
  options?: Array<{ value: string; label: string }>;
  optionsFrom?: string;
  /** Coluna que filtra as opções (país → estados, estado → cidades). */
  parentField?: string;
  /** Largura na grade do formulário. */
  span?: 1 | 2;
  /** Mostrar na tabela da listagem. */
  inTable?: boolean;
  numeric?: boolean;
}

export interface CatalogConfig {
  key: string;
  label: string;
  plural: string;
  /** Frase curta explicando para que serve — evita tela sem contexto. */
  description: string;
  fields: CatalogField[];
  /** Filtro por entidade pai na listagem. */
  parentFilter?: { catalog: string; label: string };
}

const ACTIVE_FIELD: CatalogField = {
  name: 'active',
  label: 'Ativo',
  type: 'switch',
  span: 1,
};

/**
 * Metadados dos cadastros simples. O componente genérico monta listagem e
 * formulário a partir daqui — no legado eram oito telas separadas na sidebar,
 * com três padrões visuais diferentes.
 */
export const CATALOGS: Record<string, CatalogConfig> = {
  countries: {
    key: 'countries',
    label: 'País',
    plural: 'Países',
    description:
      'Base de origem e destino das cotações. Substitui a lista do legado, que tinha entradas vazias e países repetidos.',
    fields: [
      { name: 'name', label: 'Nome', type: 'text', required: true, span: 2, inTable: true },
      { name: 'iso2', label: 'ISO alfa-2', type: 'text', placeholder: 'BR', inTable: true, hint: 'Padrão ISO 3166-1.' },
      { name: 'iso3', label: 'ISO alfa-3', type: 'text', placeholder: 'BRA', inTable: true },
      ACTIVE_FIELD,
    ],
  },

  states: {
    key: 'states',
    label: 'Estado',
    plural: 'Estados',
    description: 'Estados e províncias, vinculados ao país.',
    parentFilter: { catalog: 'countries', label: 'País' },
    fields: [
      { name: 'name', label: 'Nome', type: 'text', required: true, span: 2, inTable: true },
      {
        name: 'countryId', label: 'País', type: 'select', required: true,
        optionsFrom: 'countries', inTable: true,
      },
      { name: 'code', label: 'Sigla', type: 'text', placeholder: 'PR', inTable: true },
      ACTIVE_FIELD,
    ],
  },

  cities: {
    key: 'cities',
    label: 'Cidade',
    plural: 'Cidades',
    description: 'Cidades vinculadas ao estado.',
    parentFilter: { catalog: 'states', label: 'Estado' },
    fields: [
      { name: 'name', label: 'Nome', type: 'text', required: true, span: 2, inTable: true },
      {
        name: 'stateId', label: 'Estado', type: 'select', required: true,
        optionsFrom: 'states', inTable: true,
      },
      ACTIVE_FIELD,
    ],
  },

  ports: {
    key: 'ports',
    label: 'Porto/Aeroporto',
    plural: 'Portos e aeroportos',
    description:
      'Pontos de embarque e desembarque. Ganharam código UN/LOCODE e IATA, que não existiam no legado.',
    parentFilter: { catalog: 'countries', label: 'País' },
    fields: [
      { name: 'name', label: 'Nome', type: 'text', required: true, span: 2, inTable: true },
      {
        name: 'code', label: 'Código', type: 'text', placeholder: 'BRSSZ / GRU',
        hint: 'UN/LOCODE para marítimo e terrestre; IATA para aéreo.', inTable: true,
      },
      {
        name: 'modal', label: 'Modal', type: 'select', required: true,
        options: Object.entries(Modal).map(([value, label]) => ({ value, label })),
        inTable: true,
      },
      {
        name: 'countryId', label: 'País', type: 'select', required: true,
        optionsFrom: 'countries', inTable: true,
      },
      ACTIVE_FIELD,
    ],
  },

  currencies: {
    key: 'currencies',
    label: 'Moeda',
    plural: 'Moedas',
    description: 'Moedas aceitas nas cotações. O código ISO é o que liga a moeda à cotação do Banco Central.',
    fields: [
      { name: 'code', label: 'Código ISO', type: 'text', required: true, placeholder: 'USD', inTable: true },
      { name: 'name', label: 'Nome', type: 'text', required: true, span: 2, inTable: true },
      { name: 'symbol', label: 'Símbolo', type: 'text', placeholder: 'US$', inTable: true },
      ACTIVE_FIELD,
    ],
  },

  packagings: {
    key: 'packagings',
    label: 'Embalagem',
    plural: 'Embalagens',
    description: 'Tipo de acondicionamento da carga — influencia a análise de risco.',
    fields: [
      { name: 'name', label: 'Descrição', type: 'text', required: true, span: 2, inTable: true },
      ACTIVE_FIELD,
    ],
  },

  vessels: {
    key: 'vessels',
    label: 'Navio',
    plural: 'Navios',
    description:
      'Embarcações. O ano de construção alimenta o adicional por idade da embarcação nas exportações.',
    fields: [
      { name: 'name', label: 'Nome', type: 'text', required: true, span: 2, inTable: true },
      { name: 'imo', label: 'IMO', type: 'text', placeholder: '9999999', inTable: true },
      { name: 'buildYear', label: 'Ano de construção', type: 'number', inTable: true, numeric: true },
      ACTIVE_FIELD,
    ],
  },

  'commodity-types': {
    key: 'commodity-types',
    label: 'Tipo de mercadoria',
    plural: 'Tipos de mercadoria',
    description:
      'Classificação de risco da carga, com taxa sugerida por modal. No legado só existiam dois registros e tudo caía em “OUTROS”.',
    fields: [
      { name: 'code', label: 'Código', type: 'text', required: true, placeholder: 'MAQ', inTable: true },
      { name: 'name', label: 'Descrição', type: 'text', required: true, span: 2, inTable: true },
      {
        name: 'seaRoadRate', label: 'Taxa marítimo/terrestre (%)', type: 'rate',
        inTable: true, numeric: true,
      },
      { name: 'airRate', label: 'Taxa aérea (%)', type: 'rate', inTable: true, numeric: true },
      { name: 'deductible', label: 'Franquia (%)', type: 'rate', inTable: true, numeric: true },
      ACTIVE_FIELD,
    ],
  },
};

/** Agrupamento da navegação lateral da tela de cadastros. */
export const CATALOG_GROUPS: Array<{ title: string; items: string[] }> = [
  { title: 'Localização', items: ['countries', 'states', 'cities', 'ports'] },
  { title: 'Carga', items: ['commodity-types', 'packagings', 'vessels'] },
  { title: 'Financeiro', items: ['currencies'] },
];
