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
