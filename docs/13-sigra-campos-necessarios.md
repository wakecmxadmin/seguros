# Campos do SIGRA a mapear

Levantamento dos campos que o projeto precisa puxar do SIGRA para automatizar a comunicação de
averbação (módulo `communications`, [tarefa 31](../novas_tarefas.md)) e a fatura de cobrança do
numerário (módulo `finance`). Ainda é uma lista de **campos por função** — a coluna "Tabela/coluna
SIGRA" fica em aberto até confirmarmos no banco (ver [Status e próximos passos](#status-e-próximos-passos)).

## Como chegamos nesses campos

A cliente (Lohana, Grupo Pinho) respondeu a duas perguntas com exemplos reais de e-mail, contrastando
dois tipos de processo:

| | Processo sem impostos | Processo com impostos |
|---|---|---|
| Referência SIGRA | **1901475** | **1898813** |
| PO / identificação | PO 260098 | CNA-022-26 |
| Cliente/Importador | Multi Mercantes Ltda (CNPJ 04.049.640/0001-47) | Farm Direct Food do Brasil Comercio Ltda |
| Fatura/Nota | WT-EM260415-22 | 6470 |
| Averbação | — | P 1954 / D 106647 |
| Documentos de exemplo | `docs/examples/` (BL, Invoice+Packing List, 2x consulta Marinha Mercante, consulta de presença de carga) | só o e-mail com o quadro de Valores (sem PDFs anexos ainda) |

**Hipótese de trabalho inicial** (❌ **refutada em 2026-09-17**): imaginávamos que os documentos em si
(BL, Invoice, Packing List, CE Mercante, TFA) não existiam como dado estruturado no SIGRA, só as
datas/valores equivalentes em `pinho.imp_processo`. A estrutura do schema `pinho` mostrou o contrário:
existe uma tabela **`pinho.imp_processo_bl`** com o BL inteiro estruturado (navio, portos, cubagem,
embarcador, importador, contêineres, taxas), uma família **`ce_mercante_*`** igualmente rica (CE
master/filhote, contêiner, frete, manifesto), e uma cadeia genérica de **documento/arquivo**:
`op_processo_documento` (liga processo → documento) → `op_documento` (metadado + campo `arquivo`) →
`pinho.sis_arquivo` (**tem coluna `url`**). **Confirmado com dados reais em 2026-09-18**: os dois
processos de exemplo têm linhas nessa cadeia, com `sis_arquivo.url` apontando para PDFs reais
(Fatura Comercial, Packing List, Conhecimento de Carga/BL, Consulta de Presença de Carga/TFA, DI/DUIMP,
Nota Fiscal, etc.) hospedados em Google Cloud Storage — ver
[Status e próximos passos](#status-e-próximos-passos), rodada 3.

Já confirmado nos processos 1901475 e 1898813 (ver `pinho.imp_processo`, `pinho.imp_adicao` e
`pinho.imp_adicao_item`): número do BL/booking, exportador, NCM, peso, frete prepaid/collect, FOB,
Siscomex, capatazia, taxas diversas, valor aduaneiro, número da invoice e **a taxa cambial do processo**
— ver tabelas abaixo, campos marcados com ✅.

## 1. BL / AWB (Conhecimento de Embarque)

Documento do armador (marítimo) ou companhia aérea. Exemplo: `docs/examples/PO 260098 BL.pdf`.

| Campo | Exemplo (processo 1901475) | Tabela/coluna SIGRA |
|---|---|---|
| Número do BL/Booking | 22151988 | ✅ `pinho.imp_processo.doc_carga` (confirmado exato — 1898813 → `SHP0120615`, 1901475 → `22151988`). Master BL em `doc_carga_master` (veio `null` nos dois exemplos). Tabela dedicada `pinho.imp_processo_bl` **não tem linha para nenhum dos dois processos**, nem pelo `id` nem buscando por `numero_bl`/`booking` = `doc_carga` — ver nota abaixo |
| Shipper/Exportador | Waltrend Lighting Co. Limited | ✅ `pinho.imp_adicao.nome` (+ endereço) — por adição, confirmado. `imp_processo_bl.embarcador_*` não disponível (tabela sem linha para estes processos) |
| Consignatário | Multi Mercantes Ltda | `pinho.processo.id_parceiro` (FK). `imp_processo_bl.importador_*` não disponível (tabela sem linha para estes processos) |
| Navio / bandeira | San Francisca 20W | ❌ Não disponível estruturado para estes dois processos: `imp_processo_bl` sem linha, e a rota via CE Mercante (`ce_manifesto_escala.nome_navio`) também sem linha (ver seção 4) |
| Porto de carregamento / descarga | Yantian / Paranaguá | Carregamento: ✅ `pinho.imp_processo.local_embarque` (confirmado). Descarga estruturada (`imp_processo_bl.porto_destino`/`ce_manifesto.porto_descarregamento`): ❌ não disponível — tabelas satélite sem linha para estes processos |
| Contêiner(es) + tamanho | ZCSU6942448 / 40' High Cube | `numero` ✅ confirmado por linha (`pinho.imp_processo_container.numero`, `id_processo` direto, ex. `TGBU9229760` no processo 1898813). `tamanho` ⚠️ **linha testada, mas veio `0`** — não é o texto esperado (`"40"`/`"40' HC"`); pode ser FK numérica para catálogo de tamanhos, não usar em tela sem confirmar. 1901475 (carga solta/LCL) não tem nenhuma linha nessa tabela. `imp_processo_bl_container`/`ce_mercante_item` não disponíveis (tabelas-pai sem linha) |
| NCM | 9405 | ✅ `pinho.imp_adicao.ncm` (confirmado, por adição) |
| Peso bruto / cubagem | 748,200 Kg / 8,195 Cbm | Peso bruto: ✅ `pinho.imp_processo.peso_bruto` (confirmado). Cubagem (CBM): ❌ não disponível — `ce_mercante.cubagem`/`imp_processo_bl.cubagem` sem linha para estes processos |
| Data de embarque (on board date) | 23/07/2026 | ✅ `pinho.imp_processo.dt_embarque` (já confirmada) |
| Frete (prepaid/collect) | Freight Collect | ✅ `pinho.imp_processo.vl_frete_collect_ext` / `vl_frete_prepaid_ext` — confirmado exato |

**Nota (2026-09-18)**: `pinho.imp_processo_bl` não retornou nenhuma linha para 1901475/1898813 nem
pelo `id` do processo nem buscando pelo número do BL/booking (`doc_carga`) nas colunas `numero_bl`/
`booking`. Conclusão de trabalho: essa tabela satélite **não é preenchida para todo processo** — o
BL detalhado e estruturado (navio, portos, cubagem, embarcador/importador) não está disponível para
estes dois processos de referência, só o essencial em `imp_processo` (número do BL, embarque,
frete, peso). O **PDF do BL** continua acessível via `sis_arquivo.url` (ver seção "Status e próximos
passos"), então a lacuna aqui é só de dado estruturado adicional, não de documento.

## 2. Invoice (fatura comercial)

Documento do fornecedor. Exemplo: `docs/examples/PO 260098 PI-CI-PL WT-EMP260415-22 (Waltrend).pdf`
(página 1).

| Campo | Exemplo | Tabela/coluna SIGRA |
|---|---|---|
| Número da invoice | WT-EM260415-22 | ✅ `pinho.imp_adicao_item.numero_invoice` e ✅ `pinho.imp_fatura.numero_fatura` (`id_processo` direto) — ambos confirmados por linha |
| Data | 2026-04-15 | ✅ `pinho.imp_fatura.dt_emissao` — confirmado por linha |
| Fornecedor / Importador | Waltrend / Multi Mercantes | Fornecedor: ✅ `pinho.imp_adicao.nome`+endereço e ✅ `pinho.imp_fatura.nome`+endereço — confirmados, batem entre si. Importador: `pinho.processo.id_parceiro` (FK) |
| Incoterm | FOB Zhongshan | ✅ `pinho.imp_adicao.id_incoterms` e ✅ `pinho.imp_fatura.id_incoterms` (FK) — ambos confirmados por linha, catálogo do incoterm ainda não conferido por join |
| Porto de carga / destino | Zhongshan / Paranaguá | `pinho.imp_processo.local_embarque` para carga; 🔎 `pinho.imp_processo_bl.porto_origem`/`porto_destino` tem os dois lados — a confirmar por linha |
| Itens (código, NCM, descrição, qtd, valor unit., valor total) | ver tabela de itens no PDF | ✅ `pinho.imp_adicao_item` — confirmado com campos reais: `part_number`, `denominacao`, `descricao`, `quantidade`, `vl_unitario`, `vl_total`, `codigo_interno`, mais `ncm` via `pinho.imp_adicao`. Também ✅ `pinho.imp_fatura_item` (via `id_fatura`) — mesmos campos, **mais** alíquotas de II/IPI/PIS/COFINS por item |
| Valor total (USD) | 8.820,00 | ✅ soma de `pinho.imp_adicao_item.vl_total` dos itens do processo (3300+3120+2400 = 8.820,00, confirmado) |
| Peso bruto/líquido, CBM | 748,20 / 594,00 Kg · 8,195 Cbm | Peso bruto/líquido do **processo**: ✅ `pinho.imp_processo.peso_bruto`/`peso_liquido` (confirmado exato). Peso líquido por **item**: ✅ `imp_adicao_item.peso_liquido`. CBM: a confirmar |

## 3. Packing List

Mesmo arquivo da invoice (página 2). Repete cabeçalho + detalha por item/lote: quantidade, peso bruto/
líquido, caixas por item, total de caixas, CBM. Cobre majoritariamente os mesmos campos de
`pinho.imp_adicao_item` já usados pelo `ItemPopulationService` (ver SIGRA_DB.md § Uso no Backend).
O **lote** aparece embutido como texto livre dentro de `imp_adicao_item.descricao_complementar`
(ex.: `"LOTE 3700/0884126501. DATA DE FABRICAÇÃO: ... DATA DE VALIDADE: ..."`) — não há coluna
própria `lote` confirmada ainda; **caixas por item** e **CBM** também ficam a confirmar.

## 4. CE Mercante

Consulta ao Sistema Marinha Mercante do governo (não é gerado pelo SIGRA nem pelo armador). Exemplos:
`docs/examples/Sistema Marinha Mercante - 98.pdf` (dados gerais) e `-- 98.pdf` (itens de carga).

| Campo | Exemplo | Tabela/coluna SIGRA |
|---|---|---|
| Nº CE-Mercante (master) | 162605245940958 | ❌ não disponível — `ce_mercante` sem linha para estes dois processos (ver nota) |
| Nº CE-Mercante (filhote) | 162605271802400 | ✅ `pinho.imp_processo.ce_mercante` (confirmado exato — 1898813 → `162605269687586`, 1901475 → `162605271802400`). Continua sendo a **única** informação de CE Mercante disponível para estes dois processos |
| Número do manifesto | 1626501394378 | ❌ não disponível — depende de `ce_mercante`, que não tem linha. `imp_processo.manifesto` veio `null` |
| Data de emissão | 23/07/2026 | ❌ não disponível |
| Situação do master | Suspenso de pagamento | ❌ não disponível |
| Agência desconsolidadora / NVOCC | Allink / ShipCo Transport (Shenzhen) | ❌ não disponível |
| Valor do frete (total/básico) + moeda | 2.766,54 / 2.750,65 USD | ❌ não disponível — `imp_processo` já tem o frete "oficial" do processo (`vl_frete*`, seção 7); este seria só o detalhe do CE, que não está preenchido para estes processos |

**Nota (2026-09-18)**: com o número do CE Mercante confirmado em `imp_processo.ce_mercante`
(query direta), buscar por ele em `ce_mercante.numero` (com `::text` dos dois lados, descartando
problema de tipo) **veio vazio** para os dois processos. Conclusão de trabalho: a tabela
`ce_mercante` **não é preenchida automaticamente para todo processo** — parece depender de uma
consulta manual à Marinha Mercante ter sido feita e registrada no sistema, o que não aconteceu (ou
não foi sincronizado) para 1901475/1898813. O número do CE em si (suficiente para o operador
consultar manualmente, se precisar) está garantido em `imp_processo.ce_mercante`; o detalhe
estruturado (navio, situação, frete, manifesto) não está disponível para estes dois processos de
referência, e o PDF da consulta à Marinha Mercante também não apareceu na cadeia de documentos
anexados (seção "Status e próximos passos") para nenhum dos dois.

## 5. CCT (processos aéreos)

Sem exemplo ainda — equivalente aéreo do CE Mercante (controle de carga no Siscomex/aeroporto). Pedir
um exemplo real de processo aéreo antes de fechar os campos. Tabelas já localizadas no schema `pinho`
(colunas ainda não conferidas): `cct_tela_aereo`, `cct_recepcao`, `cct_tela`, e a família marítima
`cct_maritimo_frete`/`cct_maritimo_embalagem`/`cct_tela_maritimo*` (esta última provavelmente é a fonte
real de "Frete" e "Embalagens" do CCT marítimo, distinta do `imp_processo.vl_frete*`).

## 6. TFA / Consulta de Presença de Carga

Quando não há avaria, o comprovante do terminal substitui o Termo de Faltas e Avarias propriamente
dito. Exemplo: `docs/examples/ConsultaPresencaCargaImportacao (3).pdf` (consulta feita no sistema do
terminal, TCP — Terminal de Contêineres de Paranaguá).

| Campo | Exemplo | Tabela/coluna SIGRA |
|---|---|---|
| CE | 162605271802400 | ✅ mesma coluna `pinho.imp_processo.ce_mercante` |
| Contêiner | Carga Solta | ✅ estrutura: `pinho.imp_processo_container.numero`/`tamanho` (`id_processo` direto) — falta testar linha |
| Número original do BL | 22151988 | ✅ mesma coluna `pinho.imp_processo.doc_carga` |
| Data de presença | 30/08/2026 11:38 | ✅ `pinho.imp_processo.dt_presenca_carga` (já mapeada) |
| Data de descarga | 30/08/2026 10:48 | a confirmar — candidata `pinho.ce_mercante.dt_chegada_brasil`/`dt_chegada_local_despacho`, ainda não testada; `imp_processo.dt_chegada_brasil` tem semântica diferente (chegada ao país, não descarga do navio) |
| Avaria do contêiner | (vazio = sem avaria) | ✅ **por contêiner**: `pinho.imp_processo_container.avarias` (mais granular). Também existe `pinho.imp_processo.avaria` a nível de processo — ambos confirmados como colunas, valor por linha a testar |
| Data de estufagem/desova | 30/08/2026 10:48 | `pinho.imp_processo.dt_inicio_desova`/`dt_fim_desova` (vieram `null` nos exemplos). Também `pinho.imp_processo_container.dt_desunitizacao` — candidato mais específico de contêiner, a confirmar |
| Status vistoria (SIGVIG) | Carga Solta | a confirmar — nenhuma coluna com "sigvig" encontrada em nenhuma tabela levantada até agora; pode não existir como campo estruturado no SIGRA |

Já existe uma tela de prazos calculados a partir da atracação ([tarefa 35](../novas_tarefas.md),
concluída) — os campos acima devem alimentar/confirmar aquele cálculo, não duplicar uma regra nova.

**Confirmado em 2026-09-18**: o próprio comprovante ("ConsultaPresencaCargaImportacao") existe como
PDF anexado no processo, via `op_documento.tipo = 'Documentos - Outros'` → `sis_arquivo.url` — não
precisa ser re-anexado manualmente pelo operador, pode ser puxado direto do SIGRA (ver
[Status e próximos passos](#status-e-próximos-passos)).

## 7. Valores financeiros e taxa cambial (fatura de cobrança / numerário)

Do quadro "Valores" do e-mail do processo **1898813** (cliente com impostos):

| Campo | Exemplo | Tabela/coluna SIGRA |
|---|---|---|
| FOB | 204.499,52125 BRL / 39.900,01000 USD | ✅ `pinho.imp_processo.vl_fob` (BRL) / `vl_fob_ext` (USD) — confirmado exato |
| Frete Prepaid | 6.599,99000 | ✅ `pinho.imp_processo.vl_frete_prepaid_ext` — confirmado exato |
| Frete Total | 33.826,92875 BRL / 6.599,99000 USD | ✅ `pinho.imp_processo.vl_frete` (BRL) / `vl_frete_ext` (USD) — confirmado exato |
| Seguro | 243,45175 BRL / 47,50000 USD | ✅ `vl_seguro` / `vl_seguro_ext` (já mapeada, reconfirmada exata) |
| Siscomex | 154,23 | ✅ `pinho.imp_processo.vl_siscomex` — confirmado exato |
| Capatazia | 0,00 | ✅ `pinho.imp_processo.vl_taxas_capatazia` — confirmado exato |
| Taxas diversas | 0,00000 | ✅ `pinho.imp_processo.vl_taxas_diversas` — confirmado exato |
| **Taxa USD (câmbio do processo)** | **5,12530** | **✅ `pinho.imp_processo.vl_taxa_dolar` — confirmado exato nos dois processos (1898813 → 5,1253 / 1901475 → 5,2005). Resolve o bloqueio da [tarefa 49](../novas_tarefas.md).** |
| Valor aduaneiro | 238.569,90050 BRL / 46.547,49976 USD | ✅ `pinho.imp_processo.vl_aduaneiro_brl` / `vl_aduaneiro_ext` — confirmado exato |
| II | 21.471,29 | `vl_ii` (já mapeada) |
| IPI | 0,00 | `vl_ipi` (já mapeada) |
| PIS | 501,00 | `vl_pis` (já mapeada) |
| COFINS | 2.302,20 | `vl_cofins` (já mapeada) |

**Toda a seção de Valores está confirmada** direto em `pinho.imp_processo`, sem precisar de nenhuma
tabela satélite — inclusive a **taxa cambial do processo** (`vl_taxa_dolar`), que é o dado que faltava
para destravar a [tarefa 49](../novas_tarefas.md). Falta só a decisão de negócio (é uma exceção por
cliente ou por tipo de processo?), não mais o dado técnico.

## Status e próximos passos

1. **Tarefa 47 (fechada em 2026-09-18)** — três rodadas de queries:
   - **Rodada 1**: confirmou por linha a maioria dos campos das seções 1, 2, 6 e 7 acima (ver ✅) em
     `pinho.imp_processo`/`processo`/`imp_adicao`/`imp_adicao_item`, incluindo a taxa cambial da
     tarefa 49.
   - **Rodada 2**: levantou a **estrutura** (colunas, sem dados ainda) das tabelas satélite
     `imp_processo_bl`/`imp_processo_bl_container`/`imp_processo_bl_taxas`, `imp_processo_container`,
     `imp_fatura`/`imp_fatura_item`, toda a família `ce_mercante_*`/`ce_manifesto_*`, e a cadeia de
     documento/arquivo `op_processo_documento`→`op_documento`→`sis_arquivo`. Resultado: quase todos os
     campos que faltavam têm **coluna candidata identificada** (🔎 nas tabelas acima) — falta só testar
     contra os processos 1901475/1898813 com dados reais (**rodada 3**, ver query abaixo).
   - Descoberta importante: `imp_processo_bl` e `ce_mercante` **não têm FK `id_processo` direta**. O
     vínculo de `imp_processo_bl` é uma hipótese a testar (mesmo `id` de `imp_processo`, seguindo o
     padrão já visto em `pinho.processo`); o de `ce_mercante` é confirmado por chave de negócio
     (`ce_mercante.numero = imp_processo.ce_mercante`).
   - **Rodada 3 (parcial, 2026-09-18)** — via `backend/src/sigra` (`SigraProcessService`) e o
     script `npm run sigra:test -- <id>`, rodado pelo usuário contra os dois processos reais:
     - `pinho.imp_processo` + `pinho.processo` (join `dt_registro`): **todos os valores batem
       exatos** com o que a rodada 1 já tinha confirmado manualmente, inclusive `vl_taxa_dolar`
       (1901475 → `5.20050`, 1898813 → `5.12530`) e os demais valores financeiros da seção 7.
     - `pinho.imp_adicao`: confirmado por linha (exportador, endereço, NCM, `id_incoterms`) —
       1901475 tem 3 adições (mesmo exportador, 3 NCMs), 1898813 tem 1.
     - `pinho.imp_adicao_item`: confirmado por linha (`numero_invoice`, `part_number`,
       `denominacao`, `descricao`, `quantidade`, `vl_unitario`, `vl_total`, `peso_liquido`,
       `codigo_interno`).
     - `pinho.imp_processo_container`: confirmado por linha, com uma ressalva — 1901475 voltou
       **0 linhas** (provável carga solta/LCL, compatível com o exemplo "Carga Solta" da seção 6)
       e 1898813 voltou 1 linha com `numero: "TGBU9229760"` correto, mas **`tamanho: 0`**, não o
       formato esperado (`"40"`/`"40' HC"` como no exemplo do BL). Hipótese a confirmar: `tamanho`
       pode ser FK numérica para uma tabela de catálogo (não o texto pronto), ou o dado
       simplesmente não é preenchido para esse processo — **não sabemos ainda, não usar esse campo
       em tela sem confirmar**.
     - Ainda **não testado**: `imp_processo_bl*`, `imp_fatura*`, toda a família `ce_mercante_*`/
       `ce_manifesto_*`, e a cadeia `op_processo_documento`→`op_documento`→`sis_arquivo`.
   - **Rodada 3 — continuação (2026-09-18, tarde)**:
     - `pinho.imp_fatura` e `pinho.imp_fatura_item`: **confirmados por linha** para os dois
       processos. `imp_fatura` traz o cabeçalho completo da invoice (fornecedor, endereço, Incoterm,
       moeda, peso líquido, valor de frete, valor total) com `id_processo` direto — bate com o que já
       se via em `imp_adicao`. `imp_fatura_item` traz os itens com `id_fatura` (FK para
       `imp_fatura.id`) **e** `id_processo`, incluindo NCM, part number, denominação, quantidade,
       valores e — dado novo — **alíquotas de II/IPI/PIS/COFINS por item** (`imp_adicao_item` não
       tinha isso). Fecha a seção 2 (Invoice) e reforça a 3 (Packing List).
     - `pinho.imp_processo_bl` **por `id` = id do processo**: veio **vazio** para os dois processos.
       **Hipótese refutada** — o vínculo não é o mesmo `id` de `imp_processo`. A chave real ainda
       precisa ser descoberta (ver query de diagnóstico abaixo, por número de BL). Isso também deixa
       `imp_processo_bl_container`/`imp_processo_bl_taxas` bloqueados (dependiam do `id` do BL).
     - **Achado grande**: a cadeia `op_processo_documento` → `op_documento` → `sis_arquivo` **retornou
       dados reais para os dois processos**, com PDF acessível por URL (Google Cloud Storage). Isso
       **refuta de vez** a hipótese original da tarefa 47 — não é verdade que BL/Invoice/Packing
       List/TFA só existem como PDF de terceiro fora do SIGRA. Documentos confirmados nos dois
       processos: **Fatura Comercial**, **Romaneio de Carga (packing list)**, **Conhecimento de Carga**
       (BL, inclusive "draft HBL"), **Documentos - Outros** (COA, descrição de produtos, e também o
       **"ConsultaPresencaCargaImportacao"**, que é o próprio TFA/comprovante de presença de carga da
       seção 6), além de **DI/DUIMP** (extrato), **ICMS** (resumo DI), **Nota Fiscal Eletrônica** e
       **Prestação de Contas**. Ou seja: para automatizar o módulo `communications` (tarefa 31) **não
       precisamos re-anexar manualmente** esses PDFs — dá para puxar direto de `sis_arquivo.url` pelo
       tipo do documento (`op_documento.tipo`).
     - `ce_mercante` e toda a família (`ce_mercante_item`, `ce_mercante_frete`, `ce_manifesto`,
       `ce_manifesto_escala`) e `imp_adicao_documento_vinculado`: **vieram vazios** para os dois
       processos. Não sabemos ainda se é porque o `ce_mercante` desses dois processos específicos não
       tem consulta feita, ou se o join `cm.numero = p.ce_mercante` está falhando por tipo/formato —
       precisa de diagnóstico (ver query abaixo) antes de repetir a rodada.

   - **Rodada 3 — diagnóstico final (2026-09-18, fim de tarde)**:
     - Item 1: `doc_carga` confirmado bruto (1898813 → `SHP0120615`, 1901475 → `22151988`).
     - Item 2: buscar `imp_processo_bl` pelo número do BL (`numero_bl`/`booking` = `doc_carga`)
       **veio vazio também**. Conclusão fechada: `imp_processo_bl` não tem linha para nenhum dos
       dois processos, nem por `id` nem por número — a tabela **não é preenchida para todo
       processo** (ver nota na seção 1 acima).
     - Item 3: `imp_processo.ce_mercante` confirmado bruto e não-nulo nos dois processos
       (1898813 → `162605269687586`, 1901475 → `162605271802400`), mas buscar esse valor em
       `ce_mercante.numero` (com `::text` dos dois lados) **veio vazio**. Como o valor de origem
       existe e o cast elimina problema de tipo, a explicação é ausência de linha mesmo: a tabela
       `ce_mercante` não foi populada para estes dois números (provável dependência de consulta
       manual à Marinha Mercante feita e sincronizada no sistema, o que não ocorreu aqui).
   - **Conclusão da tarefa 47**: as tabelas satélite `imp_processo_bl` e `ce_mercante` existem no
     schema e têm estrutura rica, mas **não são preenchidas de forma confiável para todo processo**
     — não dá para depender delas como fonte garantida de dado estruturado adicional (navio, portos,
     cubagem, situação do CE, frete detalhado). O que **é** garantido e confirmado para qualquer
     processo: os campos essenciais em `imp_processo`/`imp_adicao`/`imp_adicao_item`/`imp_fatura*`
     (seções 1, 2, 3, 7 acima) e — achado principal desta rodada — **os PDFs dos documentos em si**
     (BL, Invoice, Packing List, TFA/comprovante de presença de carga, DI/DUIMP, NFe) via
     `op_processo_documento`→`op_documento`→`sis_arquivo.url`. A hipótese original (documentos só
     como PDF de terceiro, fora do SIGRA) está **refutada**: os PDFs estão dentro do SIGRA e
     acessíveis por URL. **Tarefa 47 fechada** com esse resultado — os itens de detalhe estruturado
     de BL/CE Mercante que não vieram ficam registrados como limitação conhecida, não como pendência
     de query.
2. **Tarefa 43** — consolidar o mapeamento final aqui (✅ feito nesta rodada) e complementar
   `SIGRA_DB.md` com as tabelas novas confirmadas (`imp_fatura`, `imp_fatura_item`,
   `op_processo_documento`, `op_documento`, `sis_arquivo`) e a observação sobre `imp_processo_bl`/
   `ce_mercante` não serem confiáveis.
3. **Tarefa 44** — desenhar o espelho no banco deste projeto (adaptando a estrutura existente —
   `ExternalReference`, `communications` — em vez de recriar do zero), incluindo a ingestão dos
   documentos via `sis_arquivo.url` para o módulo `communications`, e implementar a integração
   automática.
4. **Tarefa 49** — o campo técnico já está confirmado (`vl_taxa_dolar`); falta só a decisão de negócio
   (exceção por cliente específico ou por tipo de processo com impostos).

## Cross-references
- [SIGRA_DB.md](SIGRA_DB.md) — schema e tabelas já confirmadas do SIGRA
- [12-reuniao-cliente.md](12-reuniao-cliente.md) — dores e regras de negócio da reunião
- `docs/examples/` — os PDFs e prints usados como referência nesta página
- `novas_tarefas.md` — tarefas 42, 43, 44, 46, 47, 48, 49
