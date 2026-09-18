import { Injectable } from '@nestjs/common';
import { SigraConnectionService } from './sigra-connection.service';
import type {
  SigraAddition, SigraContainer, SigraFullProcess, SigraItem, SigraProcessSummary,
} from './sigra-process.types';

/**
 * Leitura dos dados do processo de importação no SIGRA, limitada aos campos já
 * confirmados linha a linha (ver docs/13-sigra-campos-necessarios.md e docs/SIGRA_DB.md).
 * Cada método é um único SELECT parametrizado — nunca agrega lógica de escrita.
 */
@Injectable()
export class SigraProcessService {
  constructor(private db: SigraConnectionService) {}

  isConfigured(): boolean {
    return this.db.isConfigured();
  }

  async getSummary(sigraId: number): Promise<SigraProcessSummary | null> {
    const rows = await this.db.query<{
      id: string;
      cd_di: string | null;
      tipo_servico: string | null;
      status_registro: string | null;
      doc_carga: string | null;
      doc_carga_master: string | null;
      tipo_conhecimento: string | null;
      local_embarque: string | null;
      dt_registro: Date | null;
      dt_embarque: Date | null;
      dt_presenca_carga: Date | null;
      dt_chegada_brasil: Date | null;
      dt_liberacao: Date | null;
      dt_parametrizacao: Date | null;
      dt_inicio_desova: Date | null;
      dt_fim_desova: Date | null;
      peso_bruto: string | null;
      peso_liquido: string | null;
      vl_frete_prepaid_ext: string | null;
      vl_frete_collect_ext: string | null;
      vl_frete: string | null;
      vl_frete_ext: string | null;
      vl_fob: string | null;
      vl_fob_ext: string | null;
      vl_seguro: string | null;
      vl_seguro_ext: string | null;
      vl_siscomex: string | null;
      vl_taxas_capatazia: string | null;
      vl_taxas_diversas: string | null;
      vl_aduaneiro_brl: string | null;
      vl_aduaneiro_ext: string | null;
      vl_taxa_dolar: string | null;
      vl_ii: string | null;
      vl_ipi: string | null;
      vl_pis: string | null;
      vl_cofins: string | null;
      ce_mercante: string | null;
      avaria: string | null;
    }>(
      `SELECT
         p.id, p.cd_di, p.tipo_servico, p.status_registro,
         p.doc_carga, p.doc_carga_master, p.tipo_conhecimento, p.local_embarque,
         proc.dt_registro,
         p.dt_embarque, p.dt_presenca_carga, p.dt_chegada_brasil, p.dt_liberacao, p.dt_parametrizacao,
         p.dt_inicio_desova, p.dt_fim_desova,
         p.peso_bruto, p.peso_liquido,
         p.vl_frete_prepaid_ext, p.vl_frete_collect_ext, p.vl_frete, p.vl_frete_ext,
         p.vl_fob, p.vl_fob_ext,
         p.vl_seguro, p.vl_seguro_ext,
         p.vl_siscomex, p.vl_taxas_capatazia, p.vl_taxas_diversas,
         p.vl_aduaneiro_brl, p.vl_aduaneiro_ext,
         p.vl_taxa_dolar,
         p.vl_ii, p.vl_ipi, p.vl_pis, p.vl_cofins,
         p.ce_mercante, p.avaria
       FROM pinho.imp_processo p
       LEFT JOIN pinho.processo proc ON proc.id = p.id
       WHERE p.id = $1`,
      [sigraId],
    );

    const row = rows[0];
    if (!row) return null;

    return {
      id: row.id,
      cdDi: row.cd_di,
      tipoServico: row.tipo_servico,
      statusRegistro: row.status_registro,
      docCarga: row.doc_carga,
      docCargaMaster: row.doc_carga_master,
      tipoConhecimento: row.tipo_conhecimento,
      localEmbarque: row.local_embarque,
      dtRegistro: row.dt_registro,
      dtEmbarque: row.dt_embarque,
      dtPresencaCarga: row.dt_presenca_carga,
      dtChegadaBrasil: row.dt_chegada_brasil,
      dtLiberacao: row.dt_liberacao,
      dtParametrizacao: row.dt_parametrizacao,
      dtInicioDesova: row.dt_inicio_desova,
      dtFimDesova: row.dt_fim_desova,
      pesoBruto: row.peso_bruto,
      pesoLiquido: row.peso_liquido,
      vlFretePrepaidExt: row.vl_frete_prepaid_ext,
      vlFreteCollectExt: row.vl_frete_collect_ext,
      vlFrete: row.vl_frete,
      vlFreteExt: row.vl_frete_ext,
      vlFob: row.vl_fob,
      vlFobExt: row.vl_fob_ext,
      vlSeguro: row.vl_seguro,
      vlSeguroExt: row.vl_seguro_ext,
      vlSiscomex: row.vl_siscomex,
      vlTaxasCapatazia: row.vl_taxas_capatazia,
      vlTaxasDiversas: row.vl_taxas_diversas,
      vlAduaneiroBrl: row.vl_aduaneiro_brl,
      vlAduaneiroExt: row.vl_aduaneiro_ext,
      vlTaxaDolar: row.vl_taxa_dolar,
      vlIi: row.vl_ii,
      vlIpi: row.vl_ipi,
      vlPis: row.vl_pis,
      vlCofins: row.vl_cofins,
      ceMercante: row.ce_mercante,
      avaria: row.avaria,
    };
  }

  async getAdditions(sigraId: number): Promise<SigraAddition[]> {
    const rows = await this.db.query<{
      id: string;
      nome: string | null;
      pais: string | null;
      cidade: string | null;
      cep: string | null;
      logradouro: string | null;
      ncm: string | null;
      id_incoterms: string | null;
    }>(
      `SELECT id, nome, pais, cidade, cep, logradouro, ncm, id_incoterms
       FROM pinho.imp_adicao
       WHERE id_processo = $1
       ORDER BY id`,
      [sigraId],
    );

    return rows.map((row) => ({
      id: row.id,
      nome: row.nome,
      pais: row.pais,
      cidade: row.cidade,
      cep: row.cep,
      logradouro: row.logradouro,
      ncm: row.ncm,
      idIncoterms: row.id_incoterms,
    }));
  }

  async getItems(sigraId: number): Promise<SigraItem[]> {
    const rows = await this.db.query<{
      id_adicao: string;
      num_item: number | null;
      numero_invoice: string | null;
      part_number: string | null;
      denominacao: string | null;
      descricao: string | null;
      quantidade: string | null;
      vl_unitario: string | null;
      vl_total: string | null;
      peso_liquido: string | null;
      codigo_interno: string | null;
    }>(
      `SELECT id_adicao, num_item, numero_invoice, part_number, denominacao, descricao,
              quantidade, vl_unitario, vl_total, peso_liquido, codigo_interno
       FROM pinho.imp_adicao_item
       WHERE id_processo = $1
       ORDER BY id_adicao, num_item`,
      [sigraId],
    );

    return rows.map((row) => ({
      idAdicao: row.id_adicao,
      numItem: row.num_item,
      numeroInvoice: row.numero_invoice,
      partNumber: row.part_number,
      denominacao: row.denominacao,
      descricao: row.descricao,
      quantidade: row.quantidade,
      vlUnitario: row.vl_unitario,
      vlTotal: row.vl_total,
      pesoLiquido: row.peso_liquido,
      codigoInterno: row.codigo_interno,
    }));
  }

  async getContainers(sigraId: number): Promise<SigraContainer[]> {
    const rows = await this.db.query<{
      numero: string | null;
      tamanho: number | string | null;
      situacao: string | null;
      avarias: string | null;
      dt_desunitizacao: Date | null;
    }>(
      `SELECT numero, tamanho, situacao, avarias, dt_desunitizacao
       FROM pinho.imp_processo_container
       WHERE id_processo = $1
       ORDER BY numero`,
      [sigraId],
    );

    return rows.map((row) => ({
      numero: row.numero,
      tamanho: row.tamanho,
      situacao: row.situacao,
      avarias: row.avarias,
      dtDesunitizacao: row.dt_desunitizacao,
    }));
  }

  async getFullProcess(sigraId: number): Promise<SigraFullProcess> {
    const [summary, additions, items, containers] = await Promise.all([
      this.getSummary(sigraId),
      this.getAdditions(sigraId),
      this.getItems(sigraId),
      this.getContainers(sigraId),
    ]);

    return { summary, additions, items, containers };
  }
}
