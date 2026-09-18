---
title: "Banco de Dados SIGRA — Referência"
description: "Schemas, tabelas e campos do banco externo sigraweb (Pinho) acessado por pool pg dedicada e MCP"
last_updated: "2026-09-18"
relates_to:
  - "INTEGRATIONS.md"
  - "MODULES.md"
  - "BUSINESS_LOGIC.md"
tags: ["sigra", "database", "postgres", "integrations", "duimp"]
---

# Banco de Dados SIGRA — Referência

## Quick Reference
- Banco externo `sigraweb` (PostgreSQL 15.15, ~271 GB) hospedado em `34.95.156.249:5432` (Cloud SQL goog)
- Acesso requer TLS mútuo: CA + client cert + client key em `backend/certs/sigra/`
- 5 schemas relevantes: `pinho` (**467 tabelas** — confirmado via `pg_class` em 2026-09-18, ver [inventário completo](14-sigra-tabelas.md); a cifra "410" era estimativa antiga), `public` (411), `braxcom` (405), `audit` (437), `global` (95)
- Tabelas-chave do domínio Pinho: `pinho.imp_processo` (187K linhas), `pinho.imp_adicao`, `pinho.imp_adicao_item`, `pinho.processo` (supertipo de processos)
- `pinho.imp_processo` tem **222 colunas**; o SIGRA usa o mesmo registro para DI e DUIMP
- **Campo que distingue DI de DUIMP: `pinho.imp_processo.tipo_servico`** (`'DI'` / `'DUIMP'`), preenchido já na criação. O formato de `cd_di` só discrimina *depois* do registro — ver [DI vs DUIMP](#di-vs-duimp-tipo_servico)
- **Centro de custo do processo: `pinho.processo.unidade_organizacional`** (`varchar(100)`, texto livre, sem FK) — ver [Centro de custo](#centro-de-custo)
- **Data de "Registro" da planilha/UI do SIGRA**: `pinho.processo.dt_registro` (recebida pela API via campo `dtRegistro`)
- **Data oficial de autorização da Receita**: `pinho.imp_processo.dt_autorizacao_registro` (recebida via `dtAutorizacaoRegistro`, truncada em minutos)
- ⚠️ **Bug de fuso horário da API SIGRA**: `dtRegistro` recebido é interpretado como **BRT local**, mesmo com sufixo `Z` — enviar horário naive "colado" como UTC (ver seção [Bug de fuso horário](#bug-de-fuso-horário-da-api-sigra))
- Acesso leitura no backend deste projeto: módulo `backend/src/sigra` — pool `pg` dedicado (não
  Prisma, que é só para o banco próprio `seguros`), exposto pelo `SigraProcessService`
  (ver [Uso no Backend](#uso-no-backend))
- Acesso leitura via MCP: servidor `postgres-sigra` (read-only via `default_transaction_read_only=on`)
- Só os campos já confirmados linha a linha estão mapeados no backend (`imp_processo`, `processo`,
  `imp_adicao`, `imp_adicao_item`, `imp_processo_container`) — fração mínima do schema real
- **API pública SIGRA opera só por CNPJ** para despachante/importador — não aceita ID nem expõe ID no GET. Quando há múltiplas `sis_empresa` com o mesmo CNPJ (ex.: 5 da Pinho com `79608055000139`), o lookup escolhe arbitrariamente. Para forçar uma específica, use UPDATE direto (ver [Múltiplos CNPJ duplicados](#múltiplas-empresas-com-mesmo-cnpj-no-sigra)).
- **Escrita direta no DB SIGRA é possível em casos excepcionais**: user `pinho` tem permissão de `UPDATE` no schema `pinho`. O MCP é read-only só por config de sessão; a pool `pg` do backend reforça read-only na sessão (`default_transaction_read_only=on`) e recusa localmente qualquer SQL fora de SELECT/WITH, mas o privilégio de escrita do usuário `pinho` no banco continua existindo — nunca usar essa conexão para nada além dos métodos já expostos em `SigraProcessService`.
- ⚠️ **Nunca conectar nem rodar queries direto neste banco a partir do Claude Code** — mesmo com os certificados/credenciais disponíveis localmente. Toda investigação no SIGRA é feita fornecendo a query pronta para o usuário rodar e colar o resultado de volta (ver `CLAUDE.md` § Trabalho no banco do SIGRA).
- **Taxa cambial do processo**: `pinho.imp_processo.vl_taxa_dolar` — é a taxa de câmbio (PTAX + spread do câmbio contratado) usada no próprio DI/DUIMP, distinta da taxa oficial da corretora (abertura + 6%, ver tarefa 48). Confirmada exata contra dois processos reais em 2026-09-17 (ver [Valores e câmbio do processo](#valores-e-câmbio-do-processo)).
- **Muito mais dado estruturado do que o `imp_processo` sozinho sugere**: o schema `pinho` tem tabelas satélite dedicadas para BL (`imp_processo_bl*`), contêiner (`imp_processo_container`), fatura (`imp_fatura*`), CE Mercante (`ce_mercante*`, `ce_manifesto*`) e até documento/arquivo genérico (`op_processo_documento`, `sis_arquivo`) — ver [Tabelas satélite (levantamento inicial)](#tabelas-satélite-levantamento-inicial-2026-09-17).

## Conexão

### Backend (pool `pg` dedicado)
Configurada em `backend/src/sigra/sigra-connection.service.ts` (`SigraConnectionService`) — pool
`pg` própria, separada do Prisma (que só serve o banco `seguros` deste projeto). SSL habilitado
quando `DB_SIGRA_SSL_CA/CERT/KEY` estão presentes, com `rejectUnauthorized: true` e
`checkServerIdentity: () => undefined` (cert do servidor só tem DNS goog no SAN, não o IP).

Variáveis de ambiente (em `.env` / `.env.prod`):
```env
DB_SIGRA_HOST=34.95.156.249
DB_SIGRA_PORT=5432
DB_SIGRA_USERNAME=pinho
DB_SIGRA_PASSWORD=***
DB_SIGRA_DATABASE=sigraweb
DB_SIGRA_SSL_CA=certs/sigra/server-ca.pem
DB_SIGRA_SSL_CERT=certs/sigra/client-cert.pem
DB_SIGRA_SSL_KEY=certs/sigra/client-key.pem
```

Fallback seguro: se qualquer uma de `DB_SIGRA_HOST/PORT/USERNAME/PASSWORD/DATABASE` estiver ausente,
`SigraConnectionService.isConfigured()` retorna `false` e o pool nunca é aberto — sem erro no boot.

### MCP (Claude Code — read-only)
Entrada em `.mcp.json` (gitignored):
```json
"postgres-sigra": {
  "command": "npx.cmd",
  "args": ["-y", "mcp-postgres-query"],
  "env": {
    "DATABASE_URL": "postgresql://pinho:<senha>@34.95.156.249:5432/sigraweb?sslmode=no-verify&sslcert=C:/hubcodifica-ts/backend/certs/sigra/client-cert.pem&sslkey=C:/hubcodifica-ts/backend/certs/sigra/client-key.pem&options=-c%20default_transaction_read_only%3Don"
  }
}
```

Ferramentas MCP disponíveis: `mcp__postgres-sigra__query`, `list_tables` (só `public`), `describe_table`, `list_indexes`, `get_table_stats`, `explain_query`, `get_db_info`.

> ⚠️ `list_tables` do MCP só retorna o schema `public` — para tabelas do Pinho, faça:
> `SELECT table_name FROM information_schema.tables WHERE table_schema='pinho'`

## Schemas

| Schema | Tabelas | Conteúdo |
|---|---|---|
| `pinho` | 410 | Dados operacionais da Pinho (processos, adições, itens, DUIMPs, followup) — principal |
| `public` | 411 | Dados compartilhados do SIGRA multi-tenant + views `pg_stat_statements` |
| `braxcom` | 405 | Dados de outro tenant (Braxcom) — não usar |
| `audit` | 437 | Triggers de auditoria (histórico de alterações) |
| `global` | 95 | Tabelas de referência globais (ex.: `sx_moeda`, NCM, países) |

O backend consulta **apenas `pinho` e `global`** (ver `SxMoedaService` para `global.sx_moeda`).

## Tabelas Principais

### `pinho.processo`
Supertipo de processos (genérico, inclui importação, exportação, etc.). Relaciona-se 1:1 com `pinho.imp_processo` pelo `id` para processos de importação.

| Coluna | Tipo | Significado |
|---|---|---|
| `id` | bigint | PK (mesmo ID usado em `imp_processo`) |
| **`dt_registro`** | timestamp | **Data que aparece como "Registro" na UI/planilha exportada do SIGRA**. Recebida via campo `dtRegistro` da API de atualização. |

### `pinho.imp_processo`
Um registro por processo de importação SIGRA. **Mesmo registro representa DI ou DUIMP**, diferenciado por `cd_di`:
- DI tradicional: só dígitos (ex.: `2517891234`)
- DUIMP: prefixo `26BR` (ex.: `26BR00000724158`)

**Colunas-chave para DUIMP** (subset das 222 colunas):

| Coluna | Tipo | Significado |
|---|---|---|
| `id` | bigint | PK — é o "ID Sigra" que o Hub salva em `processes.pinho_reference` |
| `cd_di` | varchar | Código DI **ou** DUIMP (formato `26BR...` indica DUIMP) |
| `cd_duimp` | varchar | Quase sempre NULL — não usar como fonte de verdade |
| `chave_acesso_duimp` | varchar | Chave de acesso gerada após registro |
| `status_registro` | varchar | `EM_ELABORACAO`, `REGISTRADA_AGUARDANDO_CANAL`, `DESEMBARACADA_AGUARDANDO_ENTREGA_CARGA`, etc. |
| `versao_duimp` | varchar | Número de versão da DUIMP |
| `dt_envio_registro_duimp` | timestamp | Quando o SIGRA **enviou** a solicitação de registro à Receita (granularidade de milissegundos). API: `dtEnvioRegistroDuimp`. |
| `dt_ultimo_envio_duimp` | timestamp | Último envio (pode ser retransmissão). API: `dtUltimoEnvioDuimp`. |
| `dt_autorizacao_registro` | timestamp | **Data oficial em que a Receita autorizou o registro** — truncada em minutos (ex.: `22:55:00.000`). API: `dtAutorizacaoRegistro`. |
| `dt_liberacao` | timestamp | Desembaraço (liberação alfandegária) |
| `dt_parametrizacao` | timestamp | Recebimento do canal (verde/amarelo/vermelho) |

**Outros campos de data relevantes (55+ colunas `dt_*`)**:
- `dt_embarque`, `dt_chegada_brasil`, `dt_presenca_carga`, `dt_chegada_local_despacho`, `dt_entrada_recinto`
- `dt_liberacao_carregamento`, `dt_entrega_transportador`, `dt_chegada_cliente`, `dt_nfe`
- `dt_pre_alerta`, `dt_pre_custo`, `dt_vencimento`

**Três campos distintos de "registro" — não confundir**:

| Campo API | Coluna DB | O que é |
|---|---|---|
| `dtRegistro` | `pinho.processo.dt_registro` | Data exibida como "Registro" na UI e em planilhas exportadas. É a data que o operador preenche/edita. |
| `dtAutorizacaoRegistro` | `pinho.imp_processo.dt_autorizacao_registro` | Data oficial em que a Receita autorizou (truncada em minutos). |
| `dtEnvioRegistroDuimp` | `pinho.imp_processo.dt_envio_registro_duimp` | Quando o SIGRA transmitiu à Receita (pode ser ≠ autorização). |

Os três podem ter valores diferentes no mesmo processo. Validações empíricas:
- Enviar `{"dtRegistro": "..."}` via PUT **popula apenas** `pinho.processo.dt_registro`, não as colunas de `imp_processo`.
- `dt_autorizacao_registro` pode ser **anterior** a `dt_envio_registro_duimp` (ex.: processo 1789783 — autorização 16:00, envio 19:45).

### DI vs DUIMP (`tipo_servico`)

`pinho.imp_processo.tipo_servico` é o campo explícito do eixo DI/DUIMP — `varchar` com
`'DI'`, `'DUIMP'` ou NULL. Distribuição total: 232.294 `DI`, 21.650 `DUIMP`.

Ele existe **antes** do registro: 3.535 processos têm `tipo_servico='DUIMP'` com `cd_di`
ainda nulo (e 66.773 com `'DI'`). O formato de `cd_di` só discrimina *a posteriori*:

| valor de `cd_di` | significa |
|---|---|
| `26BR…` / `25BR…` / `24BR…` | DUIMP |
| `20/0914266-6` (formatado) ou dígitos puros | DI |

Colunas satélites só aparecem depois no ciclo de vida: `versao_duimp`,
`status_registro`, `chave_acesso`, `dt_envio_registro_duimp`. Em 350 processos criados na
UI em agosto/2026 ainda sem `cd_di`, `tipo_servico` é a **única** coluna do eixo
preenchida — todas as satélites zeradas.

**Não confundir com `id_tipo_declaracao`**, que é o **regime aduaneiro** e aponta para
`global.sx_tipo_declaracao` (28 linhas): id 25 = `CONSUMO` (código 01), id 2 =
`ADMISSAO TEMPORARIA`, id 1 = `ADMISSAO EM ENTREPOSTO ADUANEIRO`, etc. Não existe
entrada `DUIMP` nesse catálogo.

> ⚠️ `tipo_servico` **não é gravável pela API pública** — nem `tipoDeclaracao` nem
> `tipoServico` no payload o preenchem (ver
> [INTEGRATIONS.md § Campos que a API ignora](./INTEGRATIONS.md#campos-que-a-api-ignora-silenciosamente)).
> Em processos criados pelo hub ele nasce NULL (0 de 61 medidos); criados na UI, 26/26
> preenchidos. Escrita direta é tecnicamente possível (ver
> [Múltiplas empresas](#múltiplas-empresas-com-mesmo-cnpj-no-sigra) para o padrão de
> UPDATE, incluindo `dt_modificacao = NOW()`), mas a origem é o caminho saudável.

### Centro de custo

Três tabelas, sem nenhuma FK entre elas:

| papel | coluna |
|---|---|
| valor gravado no processo | `pinho.processo.unidade_organizacional` — `varchar(100)`, nullable, **texto livre, sem FK** |
| catálogo | `pinho.op_centro_custo` (`id`, `modulo`, `nome`, `id_empresa`, …) |
| vínculo centro ↔ cliente | `pinho.op_centro_parceiro` (`id_centro_custo`, `id_parceiro`) |
| importador do processo | `pinho.processo.id_parceiro` |

Apesar de ser texto livre, **a API só grava nomes que existam em
`op_centro_custo.nome`** — qualquer outro valor é descartado em silêncio (200 + eco no
body). Comprovado nos dois sentidos no processo 1897955 em 2026-08-11:
`"A. GWM/KYB"` → NULL; `"A. GWM"` → gravado.

O catálogo muda: o SIGRA aposentou `A. GWM/KYB` (usado 2023-12-01 → 2026-07-27) e hoje
tem `A. GWM` (id 73) e `A. KYB (ALPHA)` (id 390). Reconciliação dos 9 centros de custo
do hub que criam processo com auto-create ligado (agosto/2026): 7 batem exato
(`A. VOLKSWAGEN IMPO` 79, `A. BOSCH` 78, `A. BOSCH HC` 388, `A. HYUNDAI` 391,
`A. VALMET` 77, `A. ALPHA/BRAVO/CHARLIE` 17, `A. BRP` 392), só o GWM divergia.

Query de reconciliação:

```sql
SELECT h.nome AS nome_hub, cc.id AS id_sigra, cc.nome AS nome_sigra
FROM (VALUES ('A. GWM/KYB'), ('A. BOSCH'), ('A. VALMET')) AS h(nome)
LEFT JOIN pinho.op_centro_custo cc ON cc.nome = h.nome
ORDER BY (cc.id IS NULL) DESC;
```

### Valores e câmbio do processo

Confirmado em 2026-09-17 contra os processos reais **1901475** (sem impostos) e **1898813** (com
impostos, Farm Direct Food) — todos exatos, direto em `pinho.imp_processo`, sem tabela satélite:

| Coluna | Significado | Exemplo (1898813) |
|---|---|---|
| **`vl_taxa_dolar`** | **Taxa cambial USD do processo** (a que a tela de Valores do SIGRA mostra como "Taxa USD") | `5.1253` |
| `vl_fob` / `vl_fob_ext` | FOB em BRL / moeda estrangeira | `204499.52` / `39900.01` |
| `vl_frete` / `vl_frete_ext` | Frete total em BRL / moeda estrangeira | `33826.93` / `6599.99` |
| `vl_frete_prepaid_ext` | Frete pré-pago (preenchido só quando aplicável) | `6599.99` |
| `vl_frete_collect_ext` | Frete a pagar no destino (preenchido só quando aplicável) | `null` (era o caso do outro processo) |
| `vl_seguro` / `vl_seguro_ext` | Seguro em BRL / moeda estrangeira | `243.45` / `47.50` |
| `vl_siscomex` | Taxa Siscomex | `154.23` |
| `vl_taxas_capatazia` | Capatazia | `0` |
| `vl_taxas_diversas` | Taxas diversas | `0` |
| `vl_aduaneiro_brl` / `vl_aduaneiro_ext` | Valor aduaneiro em BRL / moeda estrangeira | `238569.90` / `46547.50` |
| `peso_bruto` / `peso_liquido` | Peso do processo (kg) | `26000` / `25000` |
| `doc_carga` | Número do BL/booking/conhecimento de carga | `SHP0120615` |
| `doc_carga_master` | BL master (quando o `doc_carga` é house) | `null` nos exemplos |
| `tipo_conhecimento` | Tipo de conhecimento (`HouseBL`, etc.) | `HouseBL` |
| `local_embarque` | Porto/local de embarque (texto livre, ex.: `"CNTAO - TSINGTAO"`) | — |
| `ce_mercante` | Número do CE Mercante (parece ser o "filhote"; master ainda não localizado) | `162605269687586` |
| `manifesto` | Número do manifesto — veio `null` nos dois exemplos testados | `null` |
| `avaria` | Descrição da avaria do contêiner (`null` = sem avaria) | `null` |
| `dt_inicio_desova` / `dt_fim_desova` | Datas de estufagem/desova em terminal | `null` nos exemplos (sem desova) |

`pinho.imp_adicao.nome` (+ `pais`/`cidade`/`cep`/`logradouro`) traz o **exportador/fornecedor** por
adição, e `pinho.imp_adicao.id_incoterms` o Incoterm (FK, catálogo não conferido ainda).
`pinho.imp_adicao_item.numero_invoice` traz o **número da invoice/fatura comercial** por item —
confirmado exato. Ver [13-sigra-campos-necessarios.md](13-sigra-campos-necessarios.md) para o
mapeamento completo campo a campo, com o que ainda falta confirmar em tabelas satélite.

### Tabelas satélite (levantamento inicial, 2026-09-17)

Consulta a `information_schema.tables` do schema `pinho` filtrando por nome (BL, documento, mercante,
manifesto, container, invoice/fatura) — colunas **ainda não levantadas**, só a existência confirmada:

| Grupo | Tabelas |
|---|---|
| BL / conhecimento (importação) | `imp_processo_bl`, `imp_processo_bl_container`, `imp_processo_bl_taxas` |
| BL / conhecimento (agenciamento) | `age_booking`, `age_conhecimento`, `age_conhecimento_hawb`, `age_conhecimento_mawb`, `age_documento_bl` |
| Contêiner | `imp_processo_container`, `exp_processo_container`, `age_processo_container`, `age_processo_container_situacao_especial`, `trk_embarque_container`, `wh_receipt_container` |
| CE Mercante | `ce_mercante`, `ce_mercante_componentes_frete`, `ce_mercante_doc_despacho`/`docs_despacho`, `ce_mercante_frete`, `ce_mercante_item`/`itens`, `ce_mercante_item_lacres`, `ce_mercante_item_ncm`, `ce_mercante_lacre`, `ce_mercante_manifesto`, `ce_mercante_transbordo`/`transbordos` |
| Manifesto | `ce_manifesto`, `ce_manifesto_escala`, `ce_manifesto_terminal`, `rem_manifesto`, `rod_manifesto` (+ várias `rod_manifesto_*` de transporte rodoviário) |
| Fatura (nível processo, distinta de `imp_adicao_item`) | `imp_fatura`, `imp_fatura_item`, `imp_fatura_item_lpco`, `exp_fatura`, `exp_fatura_item`, `coda_imp_fatura`, `coda_imp_fatura_item` |
| CCT | `cct_tela`, `cct_tela_aereo`, `cct_tela_maritimo`, `cct_tela_maritimo_embalagens`, `cct_tela_maritimo_fretes`, `cct_maritimo_frete`, `cct_maritimo_embalagem`, `cct_recepcao`, `cct_total_origem` |
| Documento/arquivo genérico | `op_processo_documento`, `op_documento`, `op_despacho_documento`, `op_documento_despacho_relacao`, `sis_arquivo`, `imp_adicao_documento_vinculado`, `rep_documento` |

⚠️ Não sabemos ainda se essas tabelas guardam **dados estruturados equivalentes** ao documento (datas,
números, valores) ou o **arquivo/PDF em si** (via `sis_arquivo`). Próxima rodada de queries vai colunar
essas tabelas e testar contra os processos 1901475/1898813 — ver
[13-sigra-campos-necessarios.md § Status e próximos passos](13-sigra-campos-necessarios.md#status-e-próximos-passos).

**Estrutura das tabelas satélite (colunas levantadas em 2026-09-17, ainda sem dado de linha testado):**

- **`pinho.imp_processo_bl`** — BL inteiro estruturado: `numero_bl`, `booking`, `invoice`, `due`,
  `nome_navio`, `viagem_navio`, `porto_origem`, `porto_destino`, `cubagem`, `peso_bruto_total`,
  `peso_liquido_total`, `qtde_container`, `qtde_volume`, `tipo_frete`, `embarcador_nome`/`cnpj`/
  `endereco`, `importador_nome`/`cnpj`/`endereco`, `local_emissao`/`entrega`/`recebimento`,
  `freetime`, `liberacao_bl`. **Não tem coluna `id_processo`** — hipótese a testar: compartilha o
  mesmo `id` do processo (mesmo padrão de `pinho.processo`/`imp_processo`).
  - `imp_processo_bl_container` (FK `imp_processo_bl_containers` → `imp_processo_bl.id`): contêiner
    detalhado do BL (`container`, `container_tipo`, `container_lacre`, pesos, cubagem).
  - `imp_processo_bl_taxas` (FK `imp_processo_bl_taxas` → `imp_processo_bl.id`): taxas/encargos
    nomeados do BL (`taxa_nome`, `taxa_valor`, `taxa_moeda`).
- **`pinho.imp_processo_container`** — **tem `id_processo` direto** (sem ambiguidade): `numero`,
  `tamanho`, `tipo`, `lacre`, `situacao`, `avarias`, datas de devolução/desunitização, custos
  (`vl_demurrage`, `vl_custo_total`).
- **`pinho.imp_fatura`** — cabeçalho de fatura com `id_processo` direto: `numero_fatura`,
  `dt_emissao`, `nome`+endereço (fornecedor), `valor_total`, `valor_frete`, `valor_seguro`,
  `peso_liquido`, `id_incoterms`, `id_moeda`/`id_moeda_frete`/`id_moeda_seguro`,
  `tipo_vinculo_fornecedor`, `id_cobertura_cambial`. `imp_fatura_item` (FK `id_fatura` + `id_processo`)
  tem os itens, com muitas colunas espelhando `imp_adicao_item` (`numero_invoice`, `ncm`, `part_number`,
  `quantidade`, `vl_total`, tributos).
- **`pinho.ce_mercante`** — cabeçalho do CE Mercante, vinculado por **chave de negócio**
  (`ce_mercante.numero = imp_processo.ce_mercante`), não por `id_processo`: `ce_mercante_master`,
  `situacao`, `dt_emissao`, `cubagem`, `peso_bruto`, `moeda_frete`, `valor_frete_basico`,
  `modalidade_frete`, `recolhimento_frete`, `porto_origem`, `porto_destino_final`,
  `razao_social_transportador`/`cnpj_transportador`, `razao_social_consignatario`/
  `cnpj_consignatario`, `tipo_conhecimento`, `nr_bl_conhecimento_original`, `id_ultimo_manifesto` (FK).
  - `ce_mercante_item` (FK `id_ce_mercante`): contêiner por item (`nr_container`, `tamanho`,
    `tipo_container`, `peso_bruto`, `tara`, `volume`), mercadoria perigosa.
  - `ce_mercante_frete` (FK `id_mercante`): linhas de frete nomeadas (`nome`, `valor`, `moeda`,
    `recolhimento`) — provável fonte do "frete total" (soma das linhas) vs. "frete básico" do
    cabeçalho.
  - `ce_mercante_lacre` (FK `id_ce_mercante_item`), `ce_mercante_transbordo` (FK `id_ce_mercante`),
    `ce_mercante_doc_despacho` (FK `id_ce_mercante`).
  - `ce_manifesto` (via `ce_mercante.id_ultimo_manifesto`): `numero` (número do manifesto),
    `agencia_navegacao`, `empresa_navegacao`, `embarcacao`, `porto_carregamento`/
    `porto_descarregamento`, `dt_emissao`.
    - `ce_manifesto_escala` (FK `id_manifesto`): `nome_navio`, `dt_atracacao`, `porto`, `cd_viagem`.
    - `ce_manifesto_terminal` (FK `id_manifesto`): `codigo`/`nome` do terminal.
- **Cadeia de documento/arquivo genérica**: `op_processo_documento` (`id_processo`, `id_documento`) →
  `op_documento` (`tipo`, `numero`, `dt_criacao`, coluna `arquivo` → FK) → `pinho.sis_arquivo` (`nome`,
  `url`, `tamanho`). A coluna **`sis_arquivo.url` sugere que o arquivo/PDF pode estar acessível
  diretamente**, não só o metadado — a confirmar rodando a query e checando se `arquivo_url` vem
  preenchida para os processos de exemplo.
  - `imp_adicao_documento_vinculado` (`id_processo`, `id_adicao`, `cd_documento`,
    `tipo_documento_vinculado`): referência de documento por adição (ex.: LI, DUE), não
    necessariamente um arquivo.

### `pinho.imp_adicao`
Adições de uma DI/DUIMP. FK em `id_processo`. Usada por `SigraDbService.countAdicionsByProcessoId`.

### `pinho.imp_adicao_item`
Itens dentro de cada adição. FK em `id_processo` e adição. Usada por `SigraDbService.getItensByProcessoId` para popular `item` no Hub. Campos principais:
- `num_item`, `id_adicao`, `id_moeda_fob`
- `vl_total`, `vl_cofins`, `vl_ii`, `vl_ipi`, `vl_pis`, `vl_icms`, `vl_seguro`, `vl_frete`

### `pinho.duimp_processo_transmissao`
Logs de transmissão DUIMP (tentativas). Colunas: `id`, `id_processo`, `cd_duimp`, `chave_acesso`, `situacao`, `status`, `versao`, `logs` (text), `analise` (boolean). **Não contém data** — para timestamps de registro, use `imp_processo`.

### `global.sx_moeda`
Catálogo de moedas (sigla/nome) referenciado por `id_moeda_fob`. Usada em `SxMoedaService.getSiglaById`.

## Uso no Backend

`SigraProcessService` (arquivo: `backend/src/sigra/sigra-process.service.ts`) expõe 4 métodos, cada
um um único `SELECT` parametrizado via `SigraConnectionService.query()`:

```typescript
// 1. Resumo do processo (BL/booking, datas, valores, câmbio, tributos)
getSummary(sigraId: number): Promise<SigraProcessSummary | null>

// 2. Adições (exportador/fornecedor, NCM, incoterm) — pinho.imp_adicao
getAdditions(sigraId: number): Promise<SigraAddition[]>

// 3. Itens de cada adição (invoice, part number, quantidade, valores) — pinho.imp_adicao_item
getItems(sigraId: number): Promise<SigraItem[]>

// 4. Contêineres do processo — pinho.imp_processo_container
getContainers(sigraId: number): Promise<SigraContainer[]>

// Atalho que roda os 4 em paralelo:
getFullProcess(sigraId: number): Promise<SigraFullProcess>
```

Tipos de retorno em `backend/src/sigra/sigra-process.types.ts`.

Consumidores:
- `GET /sigra/processes/:id` (`SigraController`, permissão `sigra:read`)
- `GET /quotes/:id/sigra` (`QuotesService.getSigraData`) — resolve o `idProcesso` SIGRA a partir do
  `ExternalReference` (`source: 'SIGRA'`) já cadastrado na cotação (tarefa 30); retorna `null` quando
  a cotação não tem referência SIGRA vinculada

> ⚠️ **Só os campos confirmados linha a linha estão mapeados** (`imp_processo`, `processo`,
> `imp_adicao`, `imp_adicao_item`, `imp_processo_container`) — ver
> [13-sigra-campos-necessarios.md](13-sigra-campos-necessarios.md). BL detalhado (`imp_processo_bl*`),
> CE Mercante (`ce_mercante*`/`ce_manifesto*`), fatura (`imp_fatura*`) e a cadeia de documento/arquivo
> (`op_processo_documento`/`sis_arquivo`) ainda **não** têm método correspondente — dependem da
> rodada 3 de queries da tarefa 47. Para consultar qualquer tabela ainda não mapeada, adicione um
> método novo em `SigraProcessService` (sempre um `SELECT` só, nunca acesso solto a outras tabelas).

## Exemplos

### Buscar data de registro da DUIMP por ID SIGRA
```sql
SELECT
  id,
  cd_di,
  status_registro,
  dt_autorizacao_registro AS data_registro,
  dt_envio_registro_duimp AS data_envio,
  dt_liberacao AS data_desembaraco
FROM pinho.imp_processo
WHERE id = 1789783;
```

### Listar DUIMPs recém-registradas
```sql
SELECT id, cd_di, dt_autorizacao_registro, status_registro
FROM pinho.imp_processo
WHERE cd_di LIKE '26BR%'
  AND dt_autorizacao_registro IS NOT NULL
ORDER BY dt_autorizacao_registro DESC
LIMIT 50;
```

### Cruzar planilha (ID Sigra → data de registro atual)
```sql
SELECT id, cd_di, dt_autorizacao_registro
FROM pinho.imp_processo
WHERE id IN (1761682, 1760962, 1760437);
```

### Total de DUIMPs por status
```sql
SELECT status_registro, COUNT(*) AS total
FROM pinho.imp_processo
WHERE cd_di LIKE '26BR%'
GROUP BY status_registro
ORDER BY total DESC;
```

## Bug de fuso horário da API SIGRA

A API `PUT /processo/:id/atualizar` **interpreta o valor de `dtRegistro` recebido como horário BRT local**, mesmo quando enviado com sufixo `Z`. Se converter BRT→UTC antes de enviar (o que `SigraProcessService.formatDtRegistroPlanilha` faz), o resultado gravado no DB fica **+3h adiantado**.

**Comportamento verificado** (testes em 2026-04-17):

| Enviado à API | Gravado em `pinho.processo.dt_registro` |
|---|---|
| `"2026-01-30T21:06:00.000Z"` (BRT 18:06 → UTC) | `2026-01-31T00:06:00Z` ❌ (= 21:06 BRT) |
| `"2026-01-30T18:06:00.000Z"` (naive colado) | `2026-01-30T21:06:00Z` ✅ (= 18:06 BRT) |

**Regra** ao atualizar `dtRegistro` via API: enviar o horário BRT da planilha "naive" colado como UTC, **sem** conversão de fuso.

Exemplo correto (TypeScript):
```typescript
// Planilha: "30/01/2026 18:06" (BRT)
// Extrair componentes e montar ISO preservando os valores:
const iso = `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}.000Z`;
// Enviar iso → Sigra grava 18:06 BRT (= 21:06Z) corretamente
```

Ver `backend/src/scripts/atualizar-dt-registro-duimp.ts` (função `formatNaiveAsUtcIso`) para implementação de referência. **Não usar `SigraProcessService.formatDtRegistroPlanilha` quando enviar `dtRegistro` — ela aplica a conversão BRT→UTC que causa o bug.**

## Múltiplas empresas com mesmo CNPJ no SIGRA

A `pinho.sis_empresa` permite múltiplos registros com mesmo CNPJ. Caso real da Pinho (CNPJ `79608055000139`, validado em 2026-05-21):

| id | nome | razão social |
|---|---|---|
| **101071** | Pinho | Pinho Comissária — matriz "real" |
| 102469 | PINHO SA | PINHO SA |
| 102573 | Pinho-(Clone) | Pinho Comissaria de Despachos S/A |
| 103774 | PINHO - Curitiba | PINHO INTERNATIONAL LOGISTICS |
| 103879 | Pinho | PINHO S/A |

**Comportamento da API SIGRA**: `PUT /processo/:id/atualizar` com `despachanteResponsavelCnpj` faz lookup por CNPJ e pode escolher qualquer uma das 5 (no caso testado pegou `102573 Clone`, não a `101071` matriz). Não há campo de ID aceito no payload — tentativas com `idDespachante`, `despachanteResponsavelId`, `despachantePontaId` retornaram 200 mas foram silenciosamente ignoradas.

**Workaround validado** — UPDATE direto via `DataSource('sigra')`:
```typescript
// dentro de uma transação
await runner.query(
  `UPDATE pinho.processo
   SET id_despachante = $1, id_despachante_ponta = $1, dt_modificacao = NOW()
   WHERE id = ANY($2::bigint[])`,
  [101071, [1860851, 1860840, /* ... */]],
);
```

Sempre setar `dt_modificacao = NOW()` no UPDATE direto — a API SIGRA faz isso automaticamente; o UPDATE cru não, e processos com `dt_modificacao` antigo podem não ser detectados por sincronizações/cache que escutam essa coluna.

> ⚠️ Antes de usar UPDATE direto: tentar resolver na origem (suporte SIGRA consolidar duplicatas) é o caminho saudável. UPDATE no DB de terceiro contorna validações de regra e pode dessincronizar cache do app SIGRA.

## Pendências e Cuidados

- **Escrita no SIGRA DB é feita via API HTTP** (`SigraProcessService` em `sigraweb.com/api/publico`), **não** diretamente por INSERT/UPDATE. Para atualizar campo no SIGRA use o endpoint `/processo/:id/atualizar`. **Exceção**: ver [Múltiplos CNPJ duplicados](#múltiplas-empresas-com-mesmo-cnpj-no-sigra) — quando a API não consegue desambiguar, UPDATE direto é o único caminho.
- O MCP `postgres-sigra` está em modo `default_transaction_read_only=on` — qualquer INSERT/UPDATE/DELETE falha por design.
- Três campos distintos de "registro" na API (`dtRegistro`, `dtAutorizacaoRegistro`, `dtEnvioRegistroDuimp`) — ver seção `pinho.imp_processo` acima.
- O cert do servidor SIGRA só tem DNS goog no SAN — TLS mútuo funciona mas hostname verification precisa ser desligado (`sslmode=no-verify` no MCP, `checkServerIdentity: () => undefined` no backend).
- Script batch para atualizar apenas `dtRegistro` a partir de planilha: `npm run atualizar:dt-registro-duimp -- "<planilha.xlsx>"` (colunas A=ID Sigra, H=Registro DD/MM/YYYY HH:mm BRT).

## Cross-References
- [INTEGRATIONS.md](./INTEGRATIONS.md) — API HTTP do SIGRA (`sigraweb.com/api/publico`) para criação/atualização de processos
- [MODULES.md](./MODULES.md) — módulo `sigra-process` (backend)
- [BUSINESS_LOGIC.md](./BUSINESS_LOGIC.md) — fluxos que consomem dados do SIGRA (populate-from-sigra, numerário)
- [DATA_MODELS.md](./DATA_MODELS.md) — modelo `processes.pinho_reference` que referencia `imp_processo.id`

_Atualizado em: 2026-09-18_
