import { Injectable } from '@nestjs/common';
import { SigraConnectionService } from './sigra-connection.service';
import type {
  SigraAddition, SigraAgencyProcess, SigraContainer, SigraDocument, SigraFullProcess, SigraItem,
  SigraProcessKind, SigraProcessSummary,
} from './sigra-process.types';

/**
 * As colunas `timestamp` do SIGRA vêm deslocadas (um embarque de 04/10 aparece
 * como `2026-10-04 04:00`). Para usar só a data, desconta-se 4 h antes de
 * truncar — docs/21, "Fuso horário das datas".
 */
const LOCAL_DATE = (column: string) => `to_char(${column} - interval '4 hours', 'YYYY-MM-DD')`;

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
      codigo: string | null;
      client_document: string | null;
      client_name: string | null;
      id_modal: string | null;
      currency_code: string | null;
      incoterm_code: string | null;
      invoice_number: string | null;
      arrival_date: string | null;
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
         p.ce_mercante, p.avaria,
         proc.codigo,
         cli.cnpj AS client_document, cli.razao_social AS client_name,
         p.id_modal,
         coalesce(fat.currency_code, mp.sigla) AS currency_code,
         fat.incoterm_code, fat.invoice_number,
         ${LOCAL_DATE('p.dt_chegada_brasil')} AS arrival_date
       FROM pinho.imp_processo p
       LEFT JOIN pinho.processo proc   ON proc.id = p.id
       LEFT JOIN pinho.sis_empresa cli ON cli.id = proc.id_parceiro
       LEFT JOIN global.sx_moeda mp    ON mp.id = p.id_moeda_fob
       LEFT JOIN LATERAL (
         SELECT m.sigla AS currency_code, inc.codigo AS incoterm_code, f.numero_fatura AS invoice_number
         FROM pinho.imp_fatura f
         LEFT JOIN global.sx_moeda m       ON m.id = f.id_moeda
         LEFT JOIN global.sx_incoterms inc ON inc.id = f.id_incoterms
         WHERE f.id_processo = p.id
         ORDER BY f.id
         LIMIT 1
       ) fat ON true
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
      codigo: row.codigo,
      clientDocument: row.client_document,
      clientName: row.client_name,
      modalId: row.id_modal === null ? null : String(row.id_modal),
      currencyCode: row.currency_code,
      incotermCode: row.incoterm_code,
      invoiceNumber: row.invoice_number,
      arrivalDate: row.arrival_date,
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

  /** Em qual módulo do SIGRA o processo está. `null` se o id não existe. */
  async getKind(sigraId: number): Promise<SigraProcessKind | null> {
    const rows = await this.db.query<{ imp: boolean; age: boolean; exp: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM pinho.imp_processo t WHERE t.id = p.id) AS imp,
              EXISTS (SELECT 1 FROM pinho.age_processo t WHERE t.id = p.id) AS age,
              EXISTS (SELECT 1 FROM pinho.exp_processo t WHERE t.id = p.id) AS exp
       FROM pinho.processo p
       WHERE p.id = $1`,
      [sigraId],
    );
    const row = rows[0];
    if (!row) return null;
    if (row.imp) return 'IMPORT';
    if (row.age) return 'EXPORT_AGENCY';
    if (row.exp) return 'EXPORT_CUSTOMS';
    return 'OTHER';
  }

  /**
   * Processo de agenciamento (exportação com seguro). Colunas conferidas contra 5
   * processos reais em 19/11/2026 (docs/21, rodada 11). O nome do navio vem de
   * `global.op_navio` por `to_jsonb(...)->>'nome'` porque a coluna não foi
   * conferida — se não existir, volta `null` em vez de quebrar a consulta.
   */
  async getAgencyProcess(sigraId: number): Promise<SigraAgencyProcess | null> {
    const rows = await this.db.query<{
      id: string;
      codigo: string | null;
      client_document: string | null;
      client_name: string | null;
      codigo_parceiro: string | null;
      incoterm_code: string | null;
      id_modal: string | null;
      tipo_carga: string | null;
      origem: string | null;
      destino: string | null;
      destino_final: string | null;
      vessel_name: string | null;
      viagem: string | null;
      voo: string | null;
      numero_documento: string | null;
      departure_date: string | null;
      arrival_date: string | null;
      cd_due: string | null;
    }>(
      `SELECT a.id, proc.codigo,
              cli.cnpj AS client_document, cli.razao_social AS client_name,
              a.codigo_parceiro, inc.codigo AS incoterm_code, a.id_modal, a.tipo_carga,
              a.origem, a.destino, a.destino_final,
              to_jsonb(n) ->> 'nome' AS vessel_name, a.viagem, a.voo, a.numero_documento,
              to_char(coalesce(a.dt_confirmacao_embarque, a.dt_previsao_embarque), 'YYYY-MM-DD') AS departure_date,
              to_char(coalesce(a.dt_confirmacao_chegada_porto_destino, a.dt_confirmacao_chegada_destino,
                               a.dt_previsao_chegada_porto_destino, a.dt_previsao_chegada_destino),
                      'YYYY-MM-DD') AS arrival_date,
              a.cd_due
       FROM pinho.age_processo a
       JOIN pinho.processo proc          ON proc.id = a.id
       LEFT JOIN pinho.sis_empresa cli   ON cli.id = proc.id_parceiro
       LEFT JOIN global.sx_incoterms inc ON inc.id = a.id_incoterms
       LEFT JOIN global.op_navio n       ON n.id = a.id_navio
       WHERE a.id = $1`,
      [sigraId],
    );
    const row = rows[0];
    if (!row) return null;

    return {
      id: String(row.id),
      codigo: row.codigo,
      clientDocument: row.client_document,
      clientName: row.client_name,
      clientReference: row.codigo_parceiro,
      incotermCode: row.incoterm_code,
      modalId: row.id_modal === null ? null : String(row.id_modal),
      cargoType: row.tipo_carga,
      origin: row.origem,
      destination: row.destino,
      finalDestination: row.destino_final,
      vesselName: row.vessel_name,
      voyage: row.viagem,
      flight: row.voo,
      documentNumber: row.numero_documento,
      departureDate: row.departure_date,
      arrivalDate: row.arrival_date,
      dueNumber: row.cd_due,
    };
  }

  /**
   * PDFs anexados ao processo (BL, invoice, packing list, TFA, DI/DUIMP, NFe…),
   * confirmados na rodada 3 (docs/13). Só links: nada é copiado.
   */
  async getDocuments(sigraId: number): Promise<SigraDocument[]> {
    const rows = await this.db.query<{
      tipo: string | null;
      numero: string | null;
      dt_criacao: Date | null;
      nome: string | null;
      url: string | null;
      tamanho: string | number | null;
    }>(
      `SELECT d.tipo, d.numero, d.dt_criacao, arq.nome, arq.url, arq.tamanho
       FROM pinho.op_processo_documento pd
       JOIN pinho.op_documento d     ON d.id = pd.id_documento
       JOIN pinho.sis_arquivo arq    ON arq.id = d.arquivo
       WHERE pd.id_processo = $1
       ORDER BY d.dt_criacao DESC NULLS LAST
       LIMIT 100`,
      [sigraId],
    );

    return rows
      .filter((row) => !!row.url && /^https?:\/\//i.test(row.url))
      .map((row) => ({
        type: row.tipo,
        number: row.numero,
        createdAt: row.dt_criacao,
        fileName: row.nome,
        url: row.url!,
        size: row.tamanho === null ? null : Number(row.tamanho),
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
