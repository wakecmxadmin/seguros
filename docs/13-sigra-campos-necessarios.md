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

**Hipótese de trabalho** (a confirmar na [tarefa 47](../novas_tarefas.md)): os documentos em si (BL,
Invoice, Packing List, CE Mercante, TFA) são emitidos por terceiros — armador, fornecedor, Receita/
Marinha Mercante, terminal portuário — e **não existem como arquivo dentro do SIGRA**. O que o SIGRA
guarda são as datas e valores estruturados equivalentes, em `pinho.imp_processo` (ver
[SIGRA_DB.md](SIGRA_DB.md)). Se confirmado, os PDFs continuam entrando pelo módulo `communications` e
só os campos estruturados abaixo vêm do banco.

## 1. BL / AWB (Conhecimento de Embarque)

Documento do armador (marítimo) ou companhia aérea. Exemplo: `docs/examples/PO 260098 BL.pdf`.

| Campo | Exemplo (processo 1901475) | Tabela/coluna SIGRA |
|---|---|---|
| Número do BL/Booking | 22151988 | a confirmar |
| Shipper/Exportador | Waltrend Lighting Co. Limited | a confirmar |
| Consignatário | Multi Mercantes Ltda | `pinho.imp_processo.id_parceiro`? |
| Navio / bandeira | San Francisca 20W | a confirmar |
| Porto de carregamento / descarga | Yantian / Paranaguá | a confirmar |
| Contêiner(es) + tamanho | ZCSU6942448 / 40' High Cube | a confirmar |
| NCM | 9405 | a confirmar |
| Peso bruto / cubagem | 748,200 Kg / 8,195 Cbm | a confirmar |
| Data de embarque (on board date) | 23/07/2026 | `pinho.imp_processo.dt_embarque`? |
| Frete (prepaid/collect) | Freight Collect | `pinho.imp_processo.vl_frete`? |

## 2. Invoice (fatura comercial)

Documento do fornecedor. Exemplo: `docs/examples/PO 260098 PI-CI-PL WT-EMP260415-22 (Waltrend).pdf`
(página 1).

| Campo | Exemplo | Tabela/coluna SIGRA |
|---|---|---|
| Número da invoice | WT-EM260415-22 | a confirmar |
| Data | 2026-04-15 | a confirmar |
| Fornecedor / Importador | Waltrend / Multi Mercantes | a confirmar |
| Incoterm | FOB Zhongshan | a confirmar |
| Porto de carga / destino | Zhongshan / Paranaguá | a confirmar |
| Itens (código, NCM, descrição, qtd, valor unit., valor total) | ver tabela de itens no PDF | `pinho.imp_adicao_item` (já mapeada, ver SIGRA_DB.md) |
| Valor total (USD) | 8.820,00 | `pinho.imp_adicao_item.vl_total`? |
| Peso bruto/líquido, CBM | 748,20 / 594,00 Kg · 8,195 Cbm | a confirmar |

## 3. Packing List

Mesmo arquivo da invoice (página 2). Repete cabeçalho + detalha por item/lote: quantidade, peso bruto/
líquido, caixas por item, total de caixas, CBM. Provavelmente cobre os mesmos campos de
`pinho.imp_adicao_item` já usados pelo `ItemPopulationService` (ver SIGRA_DB.md § Uso no Backend) —
confirmar se falta algum campo (ex.: lote).

## 4. CE Mercante

Consulta ao Sistema Marinha Mercante do governo (não é gerado pelo SIGRA nem pelo armador). Exemplos:
`docs/examples/Sistema Marinha Mercante - 98.pdf` (dados gerais) e `-- 98.pdf` (itens de carga).

| Campo | Exemplo | Tabela/coluna SIGRA |
|---|---|---|
| Nº CE-Mercante (master) | 162605245940958 | a confirmar |
| Nº CE-Mercante (filhote) | 162605271802400 | a confirmar |
| Número do manifesto | 1626501394378 | a confirmar |
| Data de emissão | 23/07/2026 | a confirmar |
| Situação do master | Suspenso de pagamento | a confirmar |
| Agência desconsolidadora / NVOCC | Allink / ShipCo Transport (Shenzhen) | a confirmar |
| Valor do frete (total/básico) + moeda | 2.766,54 / 2.750,65 USD | a confirmar |

## 5. CCT (processos aéreos)

Sem exemplo ainda — equivalente aéreo do CE Mercante (controle de carga no Siscomex/aeroporto). Pedir
um exemplo real de processo aéreo antes de fechar os campos.

## 6. TFA / Consulta de Presença de Carga

Quando não há avaria, o comprovante do terminal substitui o Termo de Faltas e Avarias propriamente
dito. Exemplo: `docs/examples/ConsultaPresencaCargaImportacao (3).pdf` (consulta feita no sistema do
terminal, TCP — Terminal de Contêineres de Paranaguá).

| Campo | Exemplo | Tabela/coluna SIGRA |
|---|---|---|
| CE | 162605271802400 | a confirmar |
| Contêiner | Carga Solta | a confirmar |
| Número original do BL | 22151988 | a confirmar |
| Data de presença | 30/08/2026 11:38 | `pinho.imp_processo.dt_presenca_carga` (já mapeada) |
| Data de descarga | 30/08/2026 10:48 | a confirmar |
| Avaria do contêiner | (vazio = sem avaria) | a confirmar — define se precisa gerar TFA de verdade |
| Data de estufagem/desova | 30/08/2026 10:48 | a confirmar |
| Status vistoria (SIGVIG) | Carga Solta | a confirmar |

Já existe uma tela de prazos calculados a partir da atracação ([tarefa 35](../novas_tarefas.md),
concluída) — os campos acima devem alimentar/confirmar aquele cálculo, não duplicar uma regra nova.

## 7. Valores financeiros e taxa cambial (fatura de cobrança / numerário)

Do quadro "Valores" do e-mail do processo **1898813** (cliente com impostos):

| Campo | Exemplo | Tabela/coluna SIGRA |
|---|---|---|
| FOB | 204.499,52125 BRL / 39.900,01000 USD | `pinho.imp_adicao_item`? (já mapeada parcialmente) |
| Frete Prepaid | 6.599,99000 | `vl_frete`? |
| Frete Total | 33.826,92875 BRL / 6.599,99000 USD | `vl_frete`? |
| Seguro | 0,05125 BRL / 0,01000 USD | `vl_seguro` (já mapeada) |
| Siscomex | 154,23 | a confirmar |
| Capatazia | 0,00 | a confirmar |
| Taxas diversas | 0,00000 | a confirmar |
| **Taxa USD (câmbio do processo)** | **5,12530** | **a confirmar — campo central da [tarefa 49](../novas_tarefas.md)** |
| Valor aduaneiro | 238.326,50125 BRL / 46.500,01000 USD | a confirmar |
| II | 21.449,38 | `vl_ii` (já mapeada) |
| IPI | 0,00 | `vl_ipi` (já mapeada) |
| PIS | 500,49 | `vl_pis` (já mapeada) |
| COFINS | 2.299,85 | `vl_cofins` (já mapeada) |

A maioria dos valores de tributo já está mapeada em `pinho.imp_adicao_item` (ver SIGRA_DB.md). O que
falta confirmar é justamente a **taxa cambial do processo** — é ela que a cliente usa na fatura de
cobrança em vez da taxa de abertura + 6% (ver tarefa 48) para clientes/processos como este.

## Status e próximos passos

1. **Tarefa 47** — rodar as queries no processo 1901475 e 1898813 e preencher as colunas "a confirmar"
   desta página com a tabela/coluna real do SIGRA (ou confirmar que não existe e o dado só vem do PDF).
2. **Tarefa 43** — consolidar o mapeamento final aqui e complementar `SIGRA_DB.md` com as tabelas
   novas que aparecerem (ex.: CE Mercante, manifesto, anexos, se existirem).
3. **Tarefa 44** — só depois do mapeamento fechado, desenhar o espelho no banco deste projeto
   (adaptando a estrutura existente — `ExternalReference`, `communications` — em vez de recriar do
   zero) e implementar a integração automática.
4. **Tarefa 49** — depende do campo "Taxa USD" acima para decidir se a exceção de câmbio é por cliente
   ou por tipo de processo.

## Cross-references
- [SIGRA_DB.md](SIGRA_DB.md) — schema e tabelas já confirmadas do SIGRA
- [12-reuniao-cliente.md](12-reuniao-cliente.md) — dores e regras de negócio da reunião
- `docs/examples/` — os PDFs e prints usados como referência nesta página
- `novas_tarefas.md` — tarefas 42, 43, 44, 46, 47, 48, 49
