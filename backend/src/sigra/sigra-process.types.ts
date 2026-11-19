/**
 * Formatos dos dados lidos do banco `sigraweb` (SIGRA), restritos aos campos já
 * confirmados linha a linha em docs/13-sigra-campos-necessarios.md e docs/SIGRA_DB.md.
 *
 * Tabelas satélite ainda não confirmadas por linha (BL detalhado, CE Mercante,
 * fatura, documento/arquivo) ficam de fora até a "rodada 3" (tarefa 47) ser concluída.
 */

export interface SigraProcessSummary {
  id: string;
  cdDi: string | null;
  tipoServico: string | null;
  statusRegistro: string | null;

  docCarga: string | null;
  docCargaMaster: string | null;
  tipoConhecimento: string | null;
  localEmbarque: string | null;

  dtRegistro: Date | null;
  dtEmbarque: Date | null;
  dtPresencaCarga: Date | null;
  dtChegadaBrasil: Date | null;
  dtLiberacao: Date | null;
  dtParametrizacao: Date | null;
  dtInicioDesova: Date | null;
  dtFimDesova: Date | null;

  pesoBruto: string | null;
  pesoLiquido: string | null;

  vlFretePrepaidExt: string | null;
  vlFreteCollectExt: string | null;
  vlFrete: string | null;
  vlFreteExt: string | null;
  vlFob: string | null;
  vlFobExt: string | null;
  vlSeguro: string | null;
  vlSeguroExt: string | null;
  vlSiscomex: string | null;
  vlTaxasCapatazia: string | null;
  vlTaxasDiversas: string | null;
  vlAduaneiroBrl: string | null;
  vlAduaneiroExt: string | null;
  /** Taxa cambial do próprio processo (PTAX + spread do câmbio contratado) — ver tarefa 49. */
  vlTaxaDolar: string | null;
  vlIi: string | null;
  vlIpi: string | null;
  vlPis: string | null;
  vlCofins: string | null;

  /** Código do processo na Pinho (`processo.codigo`, ex.: `FRES0351/26`, `260174`). */
  codigo: string | null;
  /** Cliente = `processo.id_parceiro` → `sis_empresa` (não `id_empresa`, que é a própria Pinho). */
  clientDocument: string | null;
  clientName: string | null;
  /** `global.sx_modal.id`: 1 Marítimo, 2 Rodoviário, 3 Aéreo, 5 Meios próprios, 7 Ferroviário. */
  modalId: string | null;
  /** Sigla ISO da moeda (fatura; na falta, `id_moeda_fob` do processo). */
  currencyCode: string | null;
  /** Código do incoterm da fatura (`global.sx_incoterms.codigo`). */
  incotermCode: string | null;
  invoiceNumber: string | null;
  /** Chegada ao Brasil já como data local (`YYYY-MM-DD`) — fuso corrigido no SQL. */
  arrivalDate: string | null;

  /** Número do CE Mercante "filhote" do processo. */
  ceMercante: string | null;
  /** Descrição de avaria a nível de processo (null = sem avaria). */
  avaria: string | null;
}

export interface SigraAddition {
  id: string;
  nome: string | null;
  pais: string | null;
  cidade: string | null;
  cep: string | null;
  logradouro: string | null;
  ncm: string | null;
  idIncoterms: string | null;
}

export interface SigraItem {
  idAdicao: string;
  numItem: number | null;
  numeroInvoice: string | null;
  partNumber: string | null;
  denominacao: string | null;
  descricao: string | null;
  quantidade: string | null;
  vlUnitario: string | null;
  vlTotal: string | null;
  pesoLiquido: string | null;
  codigoInterno: string | null;
}

export interface SigraContainer {
  numero: string | null;
  /** Confirmado por linha em 2026-09-18 voltando `0` — provável FK de catálogo, não o texto ("40'"). */
  tamanho: number | string | null;
  situacao: string | null;
  avarias: string | null;
  dtDesunitizacao: Date | null;
}

export interface SigraFullProcess {
  summary: SigraProcessSummary | null;
  additions: SigraAddition[];
  items: SigraItem[];
  containers: SigraContainer[];
}

/** Onde o processo mora no SIGRA (docs/21 — rodadas 8 a 11). */
export type SigraProcessKind = 'IMPORT' | 'EXPORT_AGENCY' | 'EXPORT_CUSTOMS' | 'OTHER';

/**
 * Exportação com seguro: fica no agenciamento (`pinho.age_processo`), não no
 * despacho (`exp_processo`). Tem a logística completa, mas **não** o valor da
 * mercadoria nem o frete segurado (docs/21, rodada 11).
 */
export interface SigraAgencyProcess {
  id: string;
  codigo: string | null;
  clientDocument: string | null;
  clientName: string | null;
  /** Referência do cliente (`codigo_parceiro`) — é a "fatura" do legado. */
  clientReference: string | null;
  incotermCode: string | null;
  modalId: string | null;
  cargoType: string | null;
  origin: string | null;
  destination: string | null;
  finalDestination: string | null;
  vesselName: string | null;
  voyage: string | null;
  flight: string | null;
  /** MAWB/MBL. */
  documentNumber: string | null;
  departureDate: string | null;
  arrivalDate: string | null;
  dueNumber: string | null;
}

/** PDF anexado ao processo: `op_processo_documento` → `op_documento` → `sis_arquivo`. */
export interface SigraDocument {
  type: string | null;
  number: string | null;
  createdAt: Date | null;
  fileName: string | null;
  url: string;
  size: number | null;
}
