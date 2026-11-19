# Integração SIGRA → seguro (tarefas 43, 44 e 50)

Mapa do que o sistema de seguros precisa e de onde vem no SIGRA (`sigraweb`, schemas `pinho` e
`global`). Queries escritas aqui e **rodadas pelo usuário**, sempre só `SELECT`, de preferência dentro de
`BEGIN READ ONLY; … ROLLBACK;` — nunca conexão direta do Claude (ver `CLAUDE.md`). Complementa
`13-sigra-campos-necessarios.md` (rodadas 1–3, documentos), `14-sigra-tabelas.md` (inventário) e
`SIGRA_DB.md` (referência).

Legenda de status: ✅ confirmado com dado real · 🟡 estrutura conhecida, falta conferir com dado ·
❓ fonte ainda desconhecida.

## Resultado (19/11/2026) — mapeamento concluído

- **Chave de ligação:** o número de 7 dígitos na "Referência" do processo de seguro é o
  `pinho.processo.id` (90 % das importações recentes; exportações recentes também).
- **Importação** (`imp_processo`): cliente, moeda, incoterm, modal, valores, impostos, peso, NCM, itens,
  invoice, BL, origem, **chegada** (`dt_chegada_brasil`) e os PDFs — todos disponíveis. Navio: manual.
- **Exportação** (`age_processo`, agenciamento): cliente, incoterm, modal, destino, navio/voo, documento
  e datas — disponíveis. **Valor da mercadoria e frete segurado: manuais.**
- **Fora do SIGRA:** processos como FRESNOMAQ (sem dados), Cerro Azul e RBX (inexistentes) seguem
  manuais.
- **Gatilho automático:** `seguro_pelo_despachante` só existe na importação e não cobre todos os
  clientes.

## Implementação (19/11/2026)

| Item | Onde |
|---|---|
| Consultas (só `SELECT`): tipo do processo, importação com cliente/moeda/incoterm/modal/chegada, agenciamento, documentos | `backend/src/sigra/sigra-process.service.ts` (`getKind`, `getSummary`, `getAgencyProcess`, `getDocuments`) |
| De-para SIGRA → formulário (puro, testado com os casos reais) | `backend/src/quotes/sigra-draft-mapper.ts` + `.spec.ts` |
| Id do SIGRA na referência (`FRES0579/26  1927944` → `1927944`) | `extractSigraId` (backend e `SigraPullPanel`) |
| Rascunho para "Puxar do SIGRA" (importação e exportação) | `GET /quotes/sigra-draft/:sigraId` |
| Resumo da cotação vinculada (dados + PDFs + chegada) | `GET /quotes/:id/sigra/overview` |
| Tela: puxar ao criar, atalho pela referência | `SigraPullPanel` na etapa Identificação |
| Tela: cartão "Processo no SIGRA" com os PDFs | `SigraOverviewCard`, coluna lateral da cotação |
| Tela: sugestão de chegada e conhecimento na definitiva | `IssueFinalDialog` (`EndorsementDrawer.tsx`) |
| Incoterms DPU e OCV | migração `20261119120000_incoterm_dpu_ocv` |
| Smoke test (rodado pelo usuário) | `npm run sigra:test -- <id>` |

Cliente: casa pelo CNPJ completo e, na falta, pela raiz quando só um cliente a tiver. País de destino
(exportação) pelo nome depois do " - " em `destino`. O vínculo da cotação vale pela referência externa
`SIGRA` ou, sem ela, pelo id lido da referência livre.

## Necessidade × fonte

### Comum (supertipo `pinho.processo`, mesmo `id` de `imp_processo`/`exp_processo`)

| Necessidade no seguro | Fonte SIGRA | Status |
|---|---|---|
| Cliente (importador/exportador) | **`processo.id_parceiro`** → `pinho.sis_empresa` (`cnpj`, `razao_social`, `nome`) | 🟡 — rodada 6: `id_parceiro` traz Volvo, VW, Bosch, ASCENSUS…; em importação por conta e ordem o adquirente real (ex.: FRESNOMAQ, com ASCENSUS de trading) deve estar em outro campo — a localizar |
| Dono do registro (despachante) | `processo.id_empresa` → `sis_empresa` | ✅ rodada 6 — é a **Pinho Comissária** (CNPJ raiz 79608055) em 78.115 de 78.222 importações de 2026. **Não** é o cliente |
| Referência do cliente | `processo.codigo_cliente` | 🟡 |
| **Seguro contratado via Pinho?** | `processo.seguro_pelo_despachante` (boolean); também `sis_empresa.seguro_pelo_despachante` e `sis_empresa.seguro_compulsorio` (nível cliente) | 🟡 — 548 de 78.222 importações de 2026, **0** exportações (rodada 5); comparar com os clientes do legado |
| Situação / cancelamento | `processo.status_registro`, `cancelado`, `motivo_cancelamento` | 🟡 |
| Data de registro (DI/DUIMP/DUE) | `processo.dt_registro` | ✅ (rodada 3) |
| PDFs (BL, Invoice, Packing List, TFA…) | `op_processo_documento` → `op_documento` → `sis_arquivo.url` | ✅ (rodada 3) |

### Importação (`pinho.imp_processo`, `imp_adicao`, `imp_fatura`)

| Necessidade | Fonte | Status |
|---|---|---|
| Custo, frete, seguro, impostos, peso, NCM, itens | `imp_processo`, `imp_adicao_item`, `imp_fatura_item` | ✅ (rodadas 1–3) |
| Moeda | `imp_fatura.id_moeda` (preferencial) / `imp_processo.id_moeda_fob` → `global.sx_moeda.sigla` | 🟡 — `id_moeda_fob` só em 23 % das importações de 2026; testar a fatura |
| Incoterm | `imp_fatura.id_incoterms` / `imp_adicao.id_incoterms` → `global.sx_incoterms` | 🟡 |
| Modal | `imp_processo.id_modal` → `global.sx_modal` | ✅ catálogo (96 % preenchido em 2026) |
| País de procedência | `imp_processo.id_pais_procedencia` → `global.sx_pais` | 🟡 |
| Porto/local de embarque | `imp_processo.local_embarque` (`"CNTAO - TSINGTAO"`) | ✅ |
| Recinto / URF de chegada (destino) | `id_recinto` → `global.sx_recinto`, `id_urf_chegada` → `global.sx_urf` | 🟡 |
| Exportador/fornecedor | `imp_adicao.nome`, `pais`, `cidade` | ✅ |
| Navio | `imp_processo.nome_veiculo`; `ce_manifesto_escala.nome_navio`; `trk_embarque.nome_navio` | ❌ rodada 9 — vazios nos processos conferidos; segue manual |
| **Data de chegada/atracação** (trava da definitiva, prazos de TFA) | **`imp_processo.dt_chegada_brasil`** (= `cct_tela_maritimo.dt_chegada`), como sugestão a confirmar pelo operador. Conferência por porto: `ce_mercante.numero` = `imp_processo.ce_mercante` → `ce_mercante_manifesto` → `ce_manifesto_escala.dt_atracacao`/`porto` | ✅ rodada 9 — 3/5 iguais ao legado, 2 com 1 dia de diferença (no legado é digitada à mão); preenchida em ~93 % dos processos com flag |

### Exportação

> **Rodada 10:** os processos de exportação com seguro da Pinho estão em **agenciamento
> (`pinho.age_processo`)**, não em `exp_processo` (que é o despacho aduaneiro).

#### `pinho.age_processo` — fonte da exportação (rodada 11, 5 processos conferidos com o legado)

| Necessidade | Fonte | Status |
|---|---|---|
| Cliente | `processo.id_parceiro` → `sis_empresa` | ✅ 5/5 |
| Ref. do cliente | `age_processo.codigo_parceiro` (`KLE116/2026`) — é a "fatura" do legado | ✅ |
| Incoterm | `id_incoterms` → `global.sx_incoterms` | ✅ 4/5 (Repro Set: SIGRA CIP × legado FCA) |
| Modal | `id_modal` → `global.sx_modal`; também `tipo_carga` (`Aéreo`, `FCL`) | ✅ 4/5 (Repro Set: SIGRA aéreo × legado marítimo) |
| Origem / destino | `origem`, `destino`, `destino_final` (texto); `id_pais_origem`; `id_pais_destino` vazio | ✅ destino 5/5 |
| Navio / voo | `id_navio` → `global.op_navio` (marítimo), `viagem`; `voo` (aéreo) | ✅ |
| Documento de carga | `numero_documento` (MAWB/MBL); `id_mawb`, `id_hawb` | ✅ |
| Embarque | `dt_confirmacao_embarque` (previsto: `dt_previsao_embarque`) | ✅ |
| Chegada | `dt_confirmacao_chegada_destino` (aéreo) / `dt_confirmacao_chegada_porto_destino` (marítimo) | ✅ |
| DUE | `cd_due` (quando houver) | 🟡 |
| **Valor da mercadoria** | **não existe** — `age_processo_invoice`, `_carga` e `_transporte` vazios | ❌ manual |
| **Frete segurado** | só o frete vendido pela Pinho (`vl_total_frete_venda`), diferente do segurado | ❌ manual |
| Flag de seguro | `processo.seguro_pelo_despachante` = 0 em 578 processos de 2026 | ❌ gatilho só pela referência |

#### `pinho.exp_processo`, `exp_fatura` — despacho aduaneiro (referência)

| Necessidade | Fonte | Status |
|---|---|---|
| Exportador (cliente) | `processo.id_parceiro` → `sis_empresa` | 🟡 |
| Comprador / consignatário | `exp_processo.id_comprador` → `exp_comprador_cadastro`; `consignatario_nome`, `_pais`, `_cidade` | 🟡 |
| Valores | `vl_fob`, `vl_frete`, `vl_seguro`, `vl_seguro_ext`, `vl_total`, `vl_fob_reais` | 🟡 |
| Moeda | `id_moeda_fob`/`_frete`/`_seguro` → `global.sx_moeda`; `exp_fatura.id_moeda_fob` | 🟡 |
| Incoterm (decide o prêmio cobrado) | `exp_fatura.id_incoterms` → `global.sx_incoterms` | 🟡 |
| Modal | `id_modal` → `global.sx_modal` | 🟡 |
| Embarque e destino | `local_embarque`, `local_destino`, `local_transbordo` | 🟡 |
| Navio / viagem | `nome_veiculo`, `nr_veiculo`, `cd_viagem`, `nome_transportador` | 🟡 |
| Documento de carga | `doc_carga`, `doc_carga_master`, `tipo_conhecimento`, `booking` | 🟡 |
| Datas | `dt_embarque`, `dt_etd`, `dt_eta`, `dt_confirmacao_embarque`, `dt_averbacao`, `dt_desembaraco` | 🟡 |
| Peso / cubagem | `peso_bruto`, `peso_liquido`, `cubagem` | 🟡 |
| DUE | `cd_registro`, `chave_acesso`, `versao_due` | 🟡 |

## Fuso horário das datas

As colunas `timestamp` do SIGRA vêm deslocadas: um embarque de 04/10 aparece como `2026-10-04 04:00`.
Para usar só a data, **subtrair 4 horas antes de truncar** (`(ts - interval '4 hours')::date`). Ver também
"Bug de fuso horário da API SIGRA" em `SIGRA_DB.md`, que trata da escrita (não usada aqui).

## Catálogos em `global`

**`sx_incoterms`** (rodada 5) — `codigo` + flags `frete_embutido`/`seguro_embutido`, que coincidem
com a regra de prêmio cobrado da exportação (doc 04 §9) e passaram a ser citadas no motor:

| id | Código | Frete embutido | Seguro embutido | Prêmio cobrado |
|---|---|---|---|---|
| 1 | FCA | não | não | custo |
| 2 | FOB | não | não | custo |
| 3 | DDU | sim | não | custo + frete |
| 4 | CFR | sim | não | custo + frete |
| 5 | CIF | sim | sim | total |
| 6 | CPT | sim | não | custo + frete |
| 7 | CIP | sim | sim | total |
| 8 | DDP | sim | sim | total |
| 9 | EXW | não | não | custo |
| 10 | DAP | sim | sim | total |
| 11 | DAT | sim | sim | total |
| 13 | FAS | não | não | custo |
| 14 | DPU | sim | sim | total — **não existe no nosso enum `Incoterm`** |
| 15 | OCV ("outra condição") | não | não | custo — **não existe no nosso enum** |

**`sx_modal`** — `id` → nosso `Modal`: 1 Marítimo → `SEA`, 3 Aéreo → `AIR`, 2 Rodoviário → `ROAD`,
7 Ferroviário → `RAIL`, 5 Meios próprios → sem equivalente.

**`sx_moeda`** — casar pelo campo `sigla` (ISO: USD, EUR, BRL…) com `Currency.code`. Mais usadas:
USD (id 43, ~113 mil processos), EUR (49), BRL (93), CNY (63), JPY (62), GBP (70), MXN (86), CHF (57).

Demais confirmados por chave estrangeira (rodada 4): `sx_pais`, `sx_recinto`, `sx_setor_recinto`,
`sx_urf`, `sx_cidade`, `sx_estado`, `sx_tipo_container`, `sx_tipo_volume`, `sx_ncm`; também `op_navio`,
`op_cia_aerea`.

## Tabelas que vieram vazias na rodada 3 (tarefa 50)

| Tabela | Linhas no banco (rodada 5) | Conclusão |
|---|---|---|
| `imp_processo_bl` | **0** | tabela morta — descartar |
| `ce_mercante` | 112.444 | populada; os exemplos 1901475/1898813 eram exceção |
| `ce_manifesto_escala` | 85.942 | populada — candidata à data de atracação |
| `cct_tela_maritimo` | 4.727 | parcial |
| `trk_embarque` | 1.490 | parcial (módulo de tracking pouco usado) |
| `imp_processo_cambio` | 986 | parcial |

## Volume (processos criados em 2026, rodada 5)

| Tipo | Total | Seguro pelo despachante | Com ref. do cliente | Cancelados | Com modal | Com moeda (processo) |
|---|---|---|---|---|---|---|
| Importação | 78.222 | 548 | 4.965 | 1.384 | 74.977 | 17.932 |
| Exportação | 11.528 | 0 | 1.999 | 214 | 11.179 | 2.074 |
| Outros | 44.675 | 0 | 447 | 1.815 | — | — |


Confirmados por chave estrangeira: `sx_moeda`, `sx_incoterms`, `sx_modal`, `sx_pais`, `sx_recinto`,
`sx_setor_recinto`, `sx_urf`, `sx_cidade`, `sx_estado`, `sx_tipo_container`, `sx_tipo_volume`,
`sx_ncm`. Outros relevantes listados: `op_navio`, `op_cia_aerea`.

## Histórico de rodadas

- **Rodada 11 — 19/11/2026 (agenciamento):** chaves de `age_processo` (incoterm, moeda, modal, navio,
  países, exportador/importador, conhecimento) e os 5 processos completos. Logística completa e
  conferida; sem valor de mercadoria. Encerra o mapeamento.
- **Rodada 10 — 19/11/2026 (exportação e CE):**
  - ✅ **As exportações com seguro estão no agenciamento**: os 5 IDs ligados pelo legado existem em
    `processo` e em **`age_processo`**, não em `exp_processo`. `processo.codigo` no formato `Pi/2231/26`;
    cliente em `processo.id_parceiro` (Ecofibra, Repro Set, Kalay) — bate com o legado.
  - Importação marítima com flag em 2026: 437 processos, 431 com número de CE, **só 112** com o CE no
    cadastro `ce_mercante`, **403 (92 %) com `dt_chegada_brasil`** → a chegada vem de `dt_chegada_brasil`;
    o CE/escalas ficam como conferência opcional.
- **Rodada 9 — 19/11/2026 (datas e exportação):**
  - Chegada: `dt_chegada_brasil` bate com a data do legado em 3/5 processos ligados e difere 1 dia nos
    outros dois; `cct_tela_maritimo.dt_chegada` é idêntica. As escalas via `ce_mercante_manifesto` dão
    a atracação por porto (Santos, Paranaguá, Rio Grande, Itajaí), sem nome de navio.
  - CE: formato de 15 dígitos com zeros à esquerda dos dois lados (`072605348153895`).
  - Exportação: os 5 IDs ligados pelo legado (Kalay, Repro Set, Ecofibra) **não estão em `exp_processo`**
    — a investigar em agenciamento (`age_processo`).
- **Rodada 8 — 19/11/2026 (ligação legado ↔ SIGRA):**
  - ✅ **Chave de ligação confirmada: o número de 7 dígitos na "Referência" do processo de seguro é o
    `pinho.processo.id`.** Nos 5 processos com dados, BL (`doc_carga`) e invoice (`numero_fatura`) bateram
    exatamente com o legado. `processo.codigo` é o código do processo na Pinho (`FRES0351/26`, `BV-03`,
    `NL-10-A`, `260174`), a outra metade da referência.
  - Cobertura da chave nas amostras do legado: 358/400 importações recentes; exportações recentes também
    (`KLE 116/2026  1925212`), as antigas não.
  - O cliente pode divergir (legado "PDA" × SIGRA "Ghelplus" nos processos 1888740/1928859) — ligar pelo
    ID, não pelo CNPJ.
  - FRESNOMAQ existe no SIGRA mas **sem BL, fatura nem flag**; Cerro Azul e RBX não estão no SIGRA (busca
    pelo BL vazia). Para esses o preenchimento segue manual.
  - Todos os processos conferidos são `tipo_consignatario = ImportacaoPropria` e sem adquirente.
  - Atracação: `ce_mercante.id_ultimo_manifesto` **nunca** é preenchido; o caminho é
    `ce_mercante_manifesto` (107 manifestos para 135 CEs encontrados de 460 marítimos com flag).
- **Rodada 7 — 19/11/2026 (o universo do seguro):**
  - **O flag `seguro_pelo_despachante` marca clientes reais do seguro**: Multi Mercantes (142), Farm
    Direct (87), PDA (67), Santa Maria (58), Kalay, CRV, Papirus, Heavy Duty, Industrilas, MVL, Mytec,
    Vollo, Dacar, PM3, Magnum, Exotic… — vários batem com os numerários do legado.
  - **Mas não cobre tudo**: a FRESNOMAQ tem 2.162 importações em 2026 no SIGRA e **0** com o flag, e no
    legado ela é um dos maiores clientes de seguro (via ASCENSUS). Cerro Azul e RBX não aparecem como
    `id_parceiro` em 2026. Conclusão parcial: o flag sozinho não serve de gatilho.
  - **Cobertura nos 548 processos com flag**: CE ~100 % dos marítimos, chegada ao Brasil ~93 %, fatura
    com moeda 100 %, presença de carga parcial, navio (`nome_veiculo`) baixo.
  - **Atracação**: a cadeia declarada é `ce_mercante.id_ultimo_manifesto` → `ce_manifesto.id` ←
    `ce_manifesto_escala.id_manifesto` (também N:N por `ce_mercante_manifesto`); na rodada 6 deu 0 —
    diagnóstico na rodada 8.
  - **Importação por conta e ordem**: `imp_processo.cd_documento_adquirente` e `tipo_consignatario`
    (também em `imp_adicao` e `imp_fatura`).
  - **Achado no legado**: a "Referência" do processo de seguro carrega o **ID do processo no SIGRA**
    (ex.: `1935396`, `1932784`, `FRES0579/26  1927944`) — candidato a chave de ligação, a confirmar.
- **Rodada 6 — 19/11/2026 (cobertura e significado):**
  - **Cliente = `id_parceiro`, não `id_empresa`.** `id_empresa` é a Pinho em quase todos os processos.
    Top parceiros de 2026: Volvo (20.959), VW (12.171), Maersk Logistics, Kuehne + Nagel, Volvo CE,
    Fiorde, Bosch, ASCENSUS (4.139), Great Wall, Recofarma.
  - **Atracação:** de 52.280 importações marítimas de 2026, 13.737 têm número de CE, 5.390 acham o CE
    em `ce_mercante` e **0** chegam a `ce_manifesto_escala` por `id_ultimo_manifesto` — a ligação é
    outra.
  - Preenchimento no universo todo: navio 5.442, chegada ao Brasil 8.079, presença de carga 4.401.
  - **Fatura:** 14.242 importações com fatura (moeda e incoterm em ~100 % delas) e 6.284 exportações.
  - Universo total pouco preenchido porque inclui os grandes clientes com fluxo próprio; o que importa é
    a cobertura nos processos com seguro (rodada 7).
- **Rodada 5 — 19/11/2026 (catálogos e uso):** `sx_incoterms`, `sx_modal`, moedas usadas, colunas de
  `sis_empresa`, colunas de navio/chegada, contagem das tabelas satélite, preenchimento dos campos-chave
  em 2026. Ajuste no código: DDU passou a "custo + frete" pelas flags do catálogo.

- **Rodada 4 — 19/11/2026 (estrutura, só metadados):** colunas de `processo` (77) e `exp_processo`
  (~150), colunas de importação por padrão de nome, todas as chaves estrangeiras de `processo`,
  `imp_processo`, `imp_adicao`, `imp_fatura`, `exp_processo`, `exp_fatura`, e as 79 tabelas de
  `global`. Achados: cliente e parceiro vêm de `processo` → `sis_empresa`; moeda, incoterm e modal têm
  catálogo declarado em `global`; exportação tem navio, viagem e destino em texto; a importação **não**
  tem coluna de navio nem de atracação; existe o flag `processo.seguro_pelo_despachante`.
