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
`pinho.sis_arquivo` (**tem coluna `url`** — ou seja, o PDF em si parece estar acessível por URL, não só
o metadado). Falta confirmar com dados reais se essas tabelas realmente têm linha preenchida para os
nossos dois processos de exemplo, e se `sis_arquivo.url` aponta para BL/Invoice/Packing List de fato —
é o que a próxima rodada de queries (seção [Status e próximos passos](#status-e-próximos-passos)) testa.

Já confirmado nos processos 1901475 e 1898813 (ver `pinho.imp_processo`, `pinho.imp_adicao` e
`pinho.imp_adicao_item`): número do BL/booking, exportador, NCM, peso, frete prepaid/collect, FOB,
Siscomex, capatazia, taxas diversas, valor aduaneiro, número da invoice e **a taxa cambial do processo**
— ver tabelas abaixo, campos marcados com ✅.

## 1. BL / AWB (Conhecimento de Embarque)

Documento do armador (marítimo) ou companhia aérea. Exemplo: `docs/examples/PO 260098 BL.pdf`.

| Campo | Exemplo (processo 1901475) | Tabela/coluna SIGRA |
|---|---|---|
| Número do BL/Booking | 22151988 | ✅ `pinho.imp_processo.doc_carga` (confirmado exato). Master BL em `doc_carga_master`. Tabela dedicada **`pinho.imp_processo_bl`** também tem `numero_bl` e `booking` — provavelmente compartilha o `id` com `imp_processo` (mesmo padrão de `pinho.processo`/`imp_processo`), a confirmar por linha |
| Shipper/Exportador | Waltrend Lighting Co. Limited | ✅ `pinho.imp_adicao.nome` (+ endereço) — por adição, confirmado. `imp_processo_bl.embarcador_nome`/`embarcador_cnpj`/`embarcador_endereco` também existem — provável duplicata mais detalhada, a confirmar |
| Consignatário | Multi Mercantes Ltda | `pinho.processo.id_parceiro` (FK). `imp_processo_bl.importador_nome`/`importador_cnpj`/`importador_endereco` são candidatos diretos com o nome já pronto — a confirmar por linha |
| Navio / bandeira | San Francisca 20W | 🔎 Candidatas (colunas existem, ainda não testadas por linha): `pinho.imp_processo_bl.nome_navio`/`viagem_navio`; e via CE Mercante, `pinho.ce_manifesto_escala.nome_navio` (join `imp_processo.ce_mercante` → `ce_mercante.numero` → `ce_mercante.id_ultimo_manifesto` → `ce_manifesto.id` → `ce_manifesto_escala.id_manifesto`) |
| Porto de carregamento / descarga | Yantian / Paranaguá | Carregamento: ✅ `pinho.imp_processo.local_embarque` (confirmado). 🔎 `imp_processo_bl.porto_origem`/`porto_destino` e `ce_manifesto.porto_carregamento`/`porto_descarregamento` são candidatos mais estruturados (com destino!), ainda não testados por linha |
| Contêiner(es) + tamanho | ZCSU6942448 / 40' High Cube | ✅ estrutura confirmada: `pinho.imp_processo_container.numero`/`tamanho` (tem `id_processo` direto, FK sem ambiguidade) — falta só testar a linha. Também existe `imp_processo_bl_container` (ligado ao BL) e `ce_mercante_item.nr_container`/`tamanho`/`tipo_container` (ligado ao CE Mercante) — mesma informação em 3 lugares possíveis |
| NCM | 9405 | ✅ `pinho.imp_adicao.ncm` (confirmado, por adição) |
| Peso bruto / cubagem | 748,200 Kg / 8,195 Cbm | Peso bruto: ✅ `pinho.imp_processo.peso_bruto` (confirmado). Cubagem (CBM): 🔎 `pinho.ce_mercante.cubagem` ou `imp_processo_bl.cubagem` — colunas existem, não testadas por linha |
| Data de embarque (on board date) | 23/07/2026 | ✅ `pinho.imp_processo.dt_embarque` (já confirmada) |
| Frete (prepaid/collect) | Freight Collect | ✅ `pinho.imp_processo.vl_frete_collect_ext` / `vl_frete_prepaid_ext` — confirmado exato |

## 2. Invoice (fatura comercial)

Documento do fornecedor. Exemplo: `docs/examples/PO 260098 PI-CI-PL WT-EMP260415-22 (Waltrend).pdf`
(página 1).

| Campo | Exemplo | Tabela/coluna SIGRA |
|---|---|---|
| Número da invoice | WT-EM260415-22 | ✅ `pinho.imp_adicao_item.numero_invoice` (confirmado exato). Também existe `pinho.imp_fatura.numero_fatura` — tabela dedicada com `id_processo` direto, tem cabeçalho completo (data, fornecedor, incoterm, valores) — a confirmar por linha |
| Data | 2026-04-15 | 🔎 `pinho.imp_fatura.dt_emissao` (`id_processo` direto, não ambíguo) — coluna existe, falta testar por linha |
| Fornecedor / Importador | Waltrend / Multi Mercantes | Fornecedor: ✅ `pinho.imp_adicao.nome`+endereço, e também `pinho.imp_fatura.nome`+endereço (`id_processo` direto) — a confirmar qual bate. Importador: `pinho.processo.id_parceiro` (FK) |
| Incoterm | FOB Zhongshan | ✅ `pinho.imp_adicao.id_incoterms` (FK). Também `pinho.imp_fatura.id_incoterms` no cabeçalho da fatura — catálogo ainda não conferido por join |
| Porto de carga / destino | Zhongshan / Paranaguá | `pinho.imp_processo.local_embarque` para carga; 🔎 `pinho.imp_processo_bl.porto_origem`/`porto_destino` tem os dois lados — a confirmar por linha |
| Itens (código, NCM, descrição, qtd, valor unit., valor total) | ver tabela de itens no PDF | ✅ `pinho.imp_adicao_item` — confirmado com campos reais: `part_number`, `denominacao`, `descricao`, `quantidade`, `vl_unitario`, `vl_total`, `codigo_interno`, mais `ncm` via `pinho.imp_adicao` |
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
| Nº CE-Mercante (master) | 162605245940958 | 🔎 `pinho.ce_mercante.ce_mercante_master` — coluna confirmada na estrutura, falta testar por linha. Link: `ce_mercante.numero = imp_processo.ce_mercante` (chave de negócio, sem FK por id) |
| Nº CE-Mercante (filhote) | 162605271802400 | ✅ `pinho.imp_processo.ce_mercante` (confirmado exato) — equivale a `ce_mercante.numero` |
| Número do manifesto | 1626501394378 | 🔎 `pinho.ce_manifesto.numero` — join `ce_mercante.id_ultimo_manifesto = ce_manifesto.id`. `imp_processo.manifesto` veio `null` nos exemplos, não usar |
| Data de emissão | 23/07/2026 | 🔎 `pinho.ce_mercante.dt_emissao` |
| Situação do master | Suspenso de pagamento | 🔎 `pinho.ce_mercante.situacao` |
| Agência desconsolidadora / NVOCC | Allink / ShipCo Transport (Shenzhen) | 🔎 candidato mais próximo: `pinho.ce_mercante.razao_social_transportador`/`cnpj_transportador`, ou `ce_manifesto.agencia_navegacao`/`empresa_navegacao` — ainda não confirmado qual corresponde a "agência desconsolidadora" |
| Valor do frete (total/básico) + moeda | 2.766,54 / 2.750,65 USD | 🔎 `pinho.ce_mercante.valor_frete_basico`/`moeda_frete` (básico, no cabeçalho) e `pinho.ce_mercante_frete.valor`/`moeda`/`nome` (linhas detalhadas, ligadas por `id_mercante`) — provavelmente o "total" é a soma das linhas de `ce_mercante_frete` |

✅ Estrutura mapeada em 2026-09-17 — a família `ce_mercante_*` não tem FK direta por `id_processo`;
o vínculo é pelo **número do CE Mercante** (`ce_mercante.numero = imp_processo.ce_mercante`). A partir
daí: `ce_mercante_item` (contêiner/embalagem, via `id_ce_mercante`), `ce_mercante_frete` (linhas de
frete, via `id_mercante`), `ce_manifesto`/`ce_manifesto_escala`/`ce_manifesto_terminal` (via
`ce_mercante.id_ultimo_manifesto`). Falta só confirmar os valores linha a linha — ver
[Status e próximos passos](#status-e-próximos-passos).

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

1. **Tarefa 47 (em andamento, 2026-09-17)** — duas rodadas concluídas:
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

   **Rodada 3 (queries de linha, pendente de execução pelo usuário)**:
   ```sql
   -- Contêiner do processo (FK direta, sem ambiguidade)
   SELECT * FROM pinho.imp_processo_container WHERE id_processo IN (1901475, 1898813);

   -- Fatura por processo (cabeçalho + itens)
   SELECT * FROM pinho.imp_fatura WHERE id_processo IN (1901475, 1898813);
   SELECT * FROM pinho.imp_fatura_item WHERE id_processo IN (1901475, 1898813);

   -- BL detalhado — testando a hipótese de mesmo id do processo
   SELECT * FROM pinho.imp_processo_bl WHERE id IN (1901475, 1898813);
   -- se vier vazio, avisar — a chave de vínculo real ainda precisa ser descoberta

   -- Contêineres e taxas do BL (dependem do id encontrado acima)
   SELECT c.* FROM pinho.imp_processo_bl_container c WHERE c.imp_processo_bl_containers IN (1901475, 1898813);
   SELECT t.* FROM pinho.imp_processo_bl_taxas t WHERE t.imp_processo_bl_taxas IN (1901475, 1898813);

   -- CE Mercante (via número, não por id_processo)
   SELECT cm.*
   FROM pinho.imp_processo p
   JOIN pinho.ce_mercante cm ON cm.numero = p.ce_mercante
   WHERE p.id IN (1901475, 1898813);

   SELECT ci.*
   FROM pinho.imp_processo p
   JOIN pinho.ce_mercante cm ON cm.numero = p.ce_mercante
   JOIN pinho.ce_mercante_item ci ON ci.id_ce_mercante = cm.id
   WHERE p.id IN (1901475, 1898813);

   SELECT cf.*
   FROM pinho.imp_processo p
   JOIN pinho.ce_mercante cm ON cm.numero = p.ce_mercante
   JOIN pinho.ce_mercante_frete cf ON cf.id_mercante = cm.id
   WHERE p.id IN (1901475, 1898813);

   SELECT man.*
   FROM pinho.imp_processo p
   JOIN pinho.ce_mercante cm ON cm.numero = p.ce_mercante
   JOIN pinho.ce_manifesto man ON man.id = cm.id_ultimo_manifesto
   WHERE p.id IN (1901475, 1898813);

   SELECT esc.*
   FROM pinho.imp_processo p
   JOIN pinho.ce_mercante cm ON cm.numero = p.ce_mercante
   JOIN pinho.ce_manifesto man ON man.id = cm.id_ultimo_manifesto
   JOIN pinho.ce_manifesto_escala esc ON esc.id_manifesto = man.id
   WHERE p.id IN (1901475, 1898813);

   -- Documentos/arquivos anexados ao processo (testa se o PDF em si está acessível)
   SELECT d.*, a.nome AS arquivo_nome, a.url AS arquivo_url, a.tamanho AS arquivo_tamanho
   FROM pinho.op_processo_documento pd
   JOIN pinho.op_documento d ON d.id = pd.id_documento
   LEFT JOIN pinho.sis_arquivo a ON a.id = d.arquivo
   WHERE pd.id_processo IN (1901475, 1898813);

   SELECT * FROM pinho.imp_adicao_documento_vinculado WHERE id_processo IN (1901475, 1898813);
   ```
2. **Tarefa 43** — consolidar o mapeamento final aqui e complementar `SIGRA_DB.md` com as tabelas
   novas confirmadas na segunda rodada.
3. **Tarefa 44** — só depois do mapeamento fechado, desenhar o espelho no banco deste projeto
   (adaptando a estrutura existente — `ExternalReference`, `communications` — em vez de recriar do
   zero) e implementar a integração automática.
4. **Tarefa 49** — o campo técnico já está confirmado (`vl_taxa_dolar`); falta só a decisão de negócio
   (exceção por cliente específico ou por tipo de processo com impostos).

## Cross-references
- [SIGRA_DB.md](SIGRA_DB.md) — schema e tabelas já confirmadas do SIGRA
- [12-reuniao-cliente.md](12-reuniao-cliente.md) — dores e regras de negócio da reunião
- `docs/examples/` — os PDFs e prints usados como referência nesta página
- `novas_tarefas.md` — tarefas 42, 43, 44, 46, 47, 48, 49
