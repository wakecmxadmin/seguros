# Inventário completo de tabelas do SIGRA (schema `pinho`)

Levantamento bruto de **todas as tabelas do schema `pinho`** (banco `sigraweb`), com tamanho em disco e linhas estimadas (`pg_class.reltuples`), rodado pelo usuário em 2026-09-18. Serve de índice para decidir **o que vale a pena abrir colunas** — não é o mapeamento fino campo a campo (isso fica em [`13-sigra-campos-necessarios.md`](13-sigra-campos-necessarios.md) e em [`SIGRA_DB.md`](SIGRA_DB.md)).

## Como ler

- **Tamanho** e **linhas estimadas** vêm de `pg_class` (via `pg_total_relation_size`/`reltuples`) — estimativa das estatísticas do Postgres, não `COUNT(*)` exato, mas suficiente pra priorizar.
- **`sem estatística`** (`reltuples = -1`) = tabela nunca analisada pelo Postgres — geralmente porque é nova ou raramente tocada, não necessariamente vazia.
- Total real: **467 tabelas** no schema `pinho` (a cifra de "410" em `SIGRA_DB.md` era uma estimativa antiga — atualizar).
- Tabelas agrupadas por **prefixo** (convenção de nomenclatura do SIGRA — cada módulo do sistema legado tem o seu: `imp_` importação, `exp_` exportação, `age_` agenciamento, etc.).

## Panorama por módulo (prefixo)

| Prefixo | Módulo provável | Tabelas | Relevância pro projeto de seguros |
|---|---|---|---|
| `soc_*` | Rede social interna do SIGRA (menções, notícias) | 4 | Sem relação com seguros — é a maior tabela do banco (`soc_mencao_usuario`, 45,7M linhas), mas é só feed social interno. Ignorar. |
| `op_*` | Operacional (documentos, tarefas, centro de custo) | 34 | Já mapeada a cadeia de documento/arquivo (`op_processo_documento`→`op_documento`→`sis_arquivo`). `op_processo_seguidor` pode interessar pro módulo communications. |
| `imp_*` | Importação (DI/DUIMP) | 55 | Núcleo do projeto — já mapeado em boa parte (`imp_processo`, `imp_adicao*`, `imp_fatura*`, `imp_processo_container`). Vale abrir as satélites de acréscimo/dedução/câmbio/volume ainda não vistas. |
| `fin_*` | Financeiro do próprio SIGRA (numerário, ordens, NFS, comissão) | 34 | Modulo financeiro interno da Pinho — pode ser a fonte oficial dos valores da fatura de cobrança (relevante pra tarefa 49). |
| `sis_*` | Sistema (usuários, empresas, parâmetros, catálogos) | 53 | Cadastros e configuração do SIGRA. `sis_parametro` é candidata forte (parâmetros de negócio). |
| `ce_*` | CE Mercante / Manifesto marítimo | 17 | Já investigado na tarefa 47 — confirmado que não é preenchido de forma confiável para todo processo. |
| `exp_*` | Exportação | 30 | Espelho do `imp_*` para processos de exportação (RE/DUE, fatura, nota, container). Ainda não mapeado — só relevante quando o módulo cobrir cotação de exportação de verdade. |
| `zfm_*` | Zona Franca de Manaus / SUFRAMA | 15 | Regime fiscal específico da ZFM — fora do escopo do seguro de transporte. |
| `processo_*` | Processo (supertipo genérico) | 2 | Já mapeada (`pinho.processo`, `processo_transmissao`). |
| `dci_*` | Drawback — componente importado | 10 | Regime aduaneiro específico (drawback) — fora do escopo. |
| `age_*` | Agenciamento (propostas de frete/booking) | 44 | Cotação e operação de frete (não é o processo de importação em si). Fora do escopo de seguros por enquanto. |
| `rod_*` | Rodoviário (CT-e, CIOT, frota) | 64 | Transporte rodoviário interno — fora do escopo (o seguro cobre a viagem internacional, não o trecho rodoviário nacional). |
| `cct_*` | CCT (Controle de Carga e Tránsito, aéreo/marítimo) | 9 | Equivalente aéreo do CE Mercante — ainda não investigado, útil quando aparecer um processo aéreo de exemplo. |
| `dcr_*` | Drawback — componente nacional | 5 | Mesmo regime de dci — fora do escopo. |
| `duimp_*` | DUIMP — transmissão/cálculo | 2 | Já referenciada em SIGRA_DB.md (`duimp_processo_transmissao`) como log, sem data útil. |
| `trk_*` | Tracking de embarque/contêiner | 9 | Possível fonte de eventos de rastreamento (não testado ainda) — pode complementar prazos (tarefa 35). |
| `coda_*` | "Coda" — parece motor de extração automática (IA) de documentos | 18 | Tabelas de staging com nomes espelhando `imp_processo_bl`/`imp_fatura` — candidatas a ter mais dado que as tabelas "oficiais" (ver achado da tarefa 47). |
| `lpco_*` | LPCO (licenças/permissões de importação) | 8 | Controle de licenciamento — fora do escopo direto do seguro. |
| `fix_*` | Scripts de correção pontual (migração) | 3 | Lixo técnico de manutenção, não é dado de domínio — ignorar. |
| `sv_*` | SUFRAMA Virtual (aquisição/enquadramento) — não é "seguro" | 7 | Apesar do prefixo parecido, é sobre SUFRAMA/ZFM, não sobre apólices de seguro. Fora do escopo. |
| `ie_*` | Inscrição Estadual (fila de processamento) | 3 | Fora do escopo do seguro. |
| `rem_*` | Remessa / protótipos (drawback) | 6 | Fora do escopo. |
| `sx_*` | Catálogos globais (CFOP, atributos NCM) | 2 | Catálogo de referência — baixa prioridade, só se precisar de CFOP/NCM. |
| `conta_*` | Autorização de conta de serviço | 1 | Configuração técnica — fora do escopo. |
| `wh_*` | Armazém (warehouse receipt) | 4 | Tabelas praticamente vazias (poucas linhas) — funcionalidade pouco usada, baixa prioridade. |
| `cleanup_*` | Scripts de limpeza pontual | 1 | Lixo técnico de manutenção — ignorar. |
| `api_*` | Integrações/API (chaves, PLI faturamento) | 9 | Configuração de integrações do SIGRA — fora do escopo. |
| `sg_*` | CRM/Leads comerciais internos da Pinho | 2 | Fora do escopo. |
| `com_*` | Desconhecido (1 tabela, "com_fq", vazia) | 1 | Não investigado, tabela vazia — baixa prioridade. |
| `teste_*` | Tabela de teste | 1 | Ignorar. |
| `persistent_*` | Sessões persistentes de login (Spring Security) | 1 | Infraestrutura de autenticação — fora do escopo. |
| `edx_*` | Log de embarque (EDI?) | 1 | Não investigado, tabela vazia (`edx_embarque_log`) — baixa prioridade. |
| `rep_*` | Regime especial (REP/ADE) — provável Recof/Repetro | 11 | Todas com `-1` (nunca analisadas/possivelmente vazias) — fora do escopo. |
| `samsung_*` | Integração específica do cliente Samsung | 1 | Curiosidade: evidencia integrações client-specific no banco — não relevante agora. |

## Candidatas — colunas já levantadas (2026-09-18)

Estrutura confirmada para as 10 candidatas. Falta rodar contra os processos reais
(1901475/1898813) para confirmar dado de linha — ver [próxima rodada](#próxima-rodada-de-queries-2026-09-18).

- **`sis_parametro`** (280.314 linhas) — tabela chave/valor genérica: `id`, `nome`, `tipo`, `valor`
  (todos `varchar`), `id_empresa`, `logs`. Pra achar o agravo/prazo/IRRF é preciso **buscar por
  nome** (`WHERE nome ILIKE '%agravo%'` etc.), não dá pra saber pelo schema sozinho.
- **`imp_processo_cambio`** (876 linhas) — **achado forte**: é um **contrato de câmbio**
  (`banco`, `numero_contrato`, `dt_fechamento`, `dt_limite`, `valor_taxa_dolar`, `valor_brl`,
  `valor_ext`, `valor_usd`, `id_moeda`, `id_processo`). Mais rico que o campo único
  `imp_processo.vl_taxa_dolar` — pode ser exatamente a taxa contratada que explica a exceção da
  tarefa 49 (e a "taxa de abertura" da tarefa 48).
- **`fin_numerario_detalhe` / `fin_extrato` / `fin_movimentacao`** — **rebaixadas de prioridade**:
  nenhuma das três tem `id_processo`. São livro-caixa da empresa (banco, conta, valor, titular),
  não do processo — `fin_numerario_detalhe.id_numerario` aponta pra uma tabela `fin_numerario` que
  **não existe** na lista de 467 (pode estar dentro de `fin_ordem`, ainda não verificado). Não
  parecem ser a fonte da fatura de cobrança por processo — precisa investigar `fin_ordem` antes de
  insistir aqui.
- **`imp_processo_volume`** (151.685 linhas) — `id`, `quantidade`, `id_empresa`, `id_processo`,
  `id_tipo_volume` (FK catálogo), `peso_bruto`. Confirma volumes por processo, mas **sem CBM** —
  não fecha sozinho a lacuna da seção 3 (Packing List).
- **`imp_*_acrescimo` / `imp_*_deducao`** (adição/item/processo) — estrutura genérica e repetida:
  `vl_brl`, `vl_moeda`, `id_moeda`, `id_acrescimo`/`id_deducao` (FK pra catálogo do **tipo** de
  acréscimo/dedução — catálogo ainda não identificado/consultado), `lancamento_individual`. Pra
  saber se algum é o "agravo" da tarefa 1, precisa do catálogo por trás de `id_acrescimo`.
- **`coda_imp_processo_bl` / `coda_imp_fatura`** — confirmado: são tabelas de **extração
  automática por IA** de documento (achado importante). Cada campo do documento tem 5 colunas:
  `<campo>_coda` (leitura bruta da IA), `_coda_correto` (bool, foi validado), `_coda_modificado`
  (bool, teve correção manual), `_sugestao` e `_valor` (valor final usado). `coda_imp_fatura` tem
  **`id_processo` direto** (bigint) — dá pra testar direto. `coda_imp_processo_bl` só tem
  `id_processo_valor` como **texto** (não FK) mais `id_documento`/`id_embarque` (bigint, este
  último aponta pra `trk_embarque` — ver abaixo). Como veio vazio pra `imp_processo_bl` "oficial"
  na tarefa 47, essa é a melhor aposta pra achar dado de BL real desses dois processos.
- **`trk_embarque` / `trk_embarque_evento` / `trk_situacao_canonica`** — **achado forte**:
  `trk_embarque` é um rastreamento rico (provável integração com API de terceiro — tem
  `dt_ultima_consulta`, `erro_ultima_consulta`, `requer_atualizacao`), com `nome_navio`,
  `viagem`, `porto_origem`, `porto_destino_final`, `cubagem`, `peso_bruto`, `frete_collect`/
  `prepaid`, `moeda_frete`, `situacao`, `situacao_aduaneira`, campos aéreos (`aeroporto_*`,
  `cia_aerea`, `dt_partida_voo`) — bem mais completo que `ce_mercante`/`imp_processo_bl`, que
  vieram vazios na tarefa 47. **Vínculo é por `numero_conhecimento`** (número do BL/AWB —
  business key, igual ao padrão do CE Mercante), **não por `id_processo`**. `trk_embarque_evento`
  é o histórico de mudanças de campo (auditoria/timeline). `trk_situacao_canonica` é só um catálogo
  de rótulos de situação.
- **`sis_recinto`** (903 linhas) — confirmado: `id`, `nome`, `sigla`, `cidade`, `id_pais`,
  flags `aeroporto`/`porto`. Catálogo simples, pronto pra usar.
- **`op_processo_seguidor`** (11.286.855 linhas ⚠️ enorme) — confirmado: só `id_processo` +
  `id_usuario`. Simples, mas **sempre filtrar por `id_processo`** — nunca rodar sem `WHERE` numa
  tabela desse tamanho.

### Próxima rodada de queries (2026-09-18)

```sql
-- 1) contrato de câmbio do processo (tarefas 48/49)
SELECT * FROM pinho.imp_processo_cambio WHERE id_processo IN (1901475, 1898813);

-- 2) extração automática (IA) da fatura — pode ter mais/outro dado que imp_fatura
SELECT * FROM pinho.coda_imp_fatura WHERE id_processo IN (1901475, 1898813);

-- 3) extração automática (IA) do BL — id_processo aqui é TEXTO, não bigint
SELECT * FROM pinho.coda_imp_processo_bl
WHERE id_processo_valor IN ('1901475', '1898813');

-- 4) tracking de embarque — vínculo pelo número do BL/AWB, não pelo id do processo
SELECT * FROM pinho.trk_embarque
WHERE numero_conhecimento IN (
  SELECT doc_carga FROM pinho.imp_processo WHERE id IN (1901475, 1898813)
);

-- 5) volumes do processo
SELECT * FROM pinho.imp_processo_volume WHERE id_processo IN (1901475, 1898813);

-- 6) quem segue os dois processos (útil pro módulo communications)
SELECT * FROM pinho.op_processo_seguidor WHERE id_processo IN (1901475, 1898813);

-- 7) buscar parâmetros de negócio por nome (agravo, prazo, IRRF)
SELECT * FROM pinho.sis_parametro
WHERE nome ILIKE '%agravo%' OR nome ILIKE '%tfa%' OR nome ILIKE '%irrf%' OR nome ILIKE '%prazo%';

-- 8) acréscimos/deduções do processo (não por adição/item, pra simplificar)
SELECT * FROM pinho.imp_processo_acrescimo WHERE id_processo IN (1901475, 1898813);
SELECT * FROM pinho.imp_processo_deducao WHERE id_processo IN (1901475, 1898813);

-- 9) investigar de onde vem "numerário" — checar se fin_ordem tem id_processo
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'pinho' AND table_name = 'fin_ordem'
ORDER BY ordinal_position;
```

### Resultado da rodada (2026-09-18, tarde)

- **`imp_processo_cambio`, `coda_imp_fatura`, `coda_imp_processo_bl`, `trk_embarque`**: **vazios**
  para os dois processos de teste. Mesmo padrão de `imp_processo_bl`/`ce_mercante` na tarefa 47 —
  são tabelas satélite/enriquecimento que **não são preenchidas para todo processo**. Ficam como
  fonte **oportunista** (pega se tiver, não depende delas) numa futura integração, não como
  dependência garantida.
- **`imp_processo_volume`**: **confirmado por linha** — 1898813: `quantidade` 0 (carga a granel,
  compatível com "alho desidratado em pó"), `peso_bruto` 26.000 kg (bate exato com o já confirmado
  em `imp_processo.peso_bruto`); 1901475: `quantidade` 90, `peso_bruto` 748,20 kg (bate com o BL).
  `id_tipo_volume` é FK de catálogo (67/76, ainda não identificado) — resolve parcialmente a seção 3
  (Packing List), mas ainda sem CBM.
- **`op_processo_seguidor`**: **confirmado por linha** — 1898813 tem 3 seguidores (usuários 1617,
  4188, 4192), 1901475 tem 4 (1309, 1617, 4188, 4192). Estrutura simples e funcional — candidato
  real pra alimentar quem notificar automaticamente no módulo `communications` (tarefa 31).
- **`sis_parametro`**: busca por nome (`agravo`/`tfa`/`irrf`/`prazo`) veio **vazia** nas 280 mil
  linhas — **descartada** como fonte dos parâmetros de negócio das tarefas 1/4/35. Ou os nomes
  usam outra convenção (inglês, sigla diferente) ou a tabela guarda outro tipo de parâmetro
  (configuração técnica, não regra de negócio).
- **`imp_processo_acrescimo`/`imp_processo_deducao`**: vazios pros dois processos — sem
  acréscimo/dedução lançado a nível de processo nesses dois exemplos.
- **`fin_ordem`** — **confirmado por linha (2026-09-18)**: é o **livro-razão detalhado da
  cobrança/numerário por processo**, com `tipo` discriminando `Numerário` (a solicitação em si,
  com a memória de cálculo em texto livre em `observacao`), `Pagamento` (cada linha paga —
  impostos, armazenagem, Marinha Mercante, taxa de seguro, taxas no destino) e `Acerto`
  (reconciliação que compensa os pagamentos contra o numerário solicitado). Todas ligadas por
  `id_processo`.
  - **Confirma valores já mapeados, batendo exato**: `IMPOSTO DE IMPORTACAO` = `vl_ii`,
    `PISPASEP IMPORTACAO` = `vl_pis`, `COFINS IMPORTACAO` = `vl_cofins`,
    `TAXA DE UTILIZAÇÃO DO SISCOMEX` = `vl_siscomex`, **`TAXA SEGURO` = `vl_seguro`** (243,45 pro
    1898813, 55,91 pro 1901475) — reconciliação cruzada entre `fin_ordem` e `imp_processo`.
  - **Achado curioso**: o pagamento de `TAXA SEGURO` é feito para o fornecedor **"Coomex Hub"**
    (CNPJ `67020194000168`, chave PIX igual) — o nome do sistema legado que este projeto substitui
    é literalmente uma parte interessada na cadeia de pagamento do prêmio de seguro no SIGRA hoje.
  - **`tx_dolar`/`tx_ptax` NÃO são a fonte da tarefa 49**: vieram `0`/`null` em todas as linhas dos
    dois processos — parecem só ser usados quando `valor_ext` está preenchido (pagamento em moeda
    estrangeira), o que não é o caso de nenhuma cobrança desses dois exemplos (tudo em BRL). A
    tarefa 49 já estava resolvida via `imp_processo.vl_taxa_dolar` (rodada 1) — este achado não
    muda isso, só descarta `fin_ordem` como fonte alternativa pra essa tarefa específica.
  - **Valor pra outra frente**: é uma fonte de reconciliação útil pro módulo `finance` — numerário
    (tarefa 38, já concluída) — dá pra cruzar os valores calculados no projeto contra o extrato real
    do SIGRA por processo, se algum dia for preciso auditar.

## Fora de escopo (não investigar por enquanto)

Domínios inteiros que não têm relação com o seguro de transporte — listados aqui só pra não perder tempo reinvestigando: **`age_*`** (propostas de frete/agenciamento — cotação de frete, não o processo em si), **`rod_*`** (transporte rodoviário nacional — CT-e, CIOT, frota), **`zfm_*`** (Zona Franca de Manaus/SUFRAMA), **`dci_*`/`dcr_*`** (regime de drawback), **`lpco_*`** (licenças de importação), **`sv_*`** (SUFRAMA Virtual — apesar do nome parecido, não é "seguro"), **`ie_*`** (fila de Inscrição Estadual), **`sg_*`** (CRM/leads comerciais), **`api_pli_*`** (faturamento de plataforma), **`rep_*`** (regime especial tipo Recof/Repetro, todas sem estatística), **`soc_*`** (rede social interna do SIGRA — `soc_mencao_usuario` é a **maior tabela do banco** com 45,7 milhões de linhas, e não tem nenhuma relação com seguros), e as tabelas `fix_*`/`cleanup_*`/`teste` (scripts de manutenção pontual, lixo técnico).

## Lista completa por módulo

<details>
<summary>Clique para expandir a lista completa das 467 tabelas, agrupadas por prefixo</summary>

### `soc_*` — Rede social interna do SIGRA (menções, notícias) (4 tabelas)

| Tabela | Tamanho | Linhas estimadas |
|---|---|---|
| `soc_mencao_usuario` | 7183 MB | 45.690.508 |
| `soc_noticia` | 794 MB | 2.085.988 |
| `soc_noticia_usuario` | 160 MB | 1.383.401 |
| `soc_comentario` | 456 kB | 1.847 |

### `op_*` — Operacional (documentos, tarefas, centro de custo) (34 tabelas)

| Tabela | Tamanho | Linhas estimadas |
|---|---|---|
| `op_processo_seguidor` | 1049 MB | 11.286.855 |
| `op_documento` | 997 MB | 2.629.851 |
| `op_processo_documento` | 317 MB | 2.356.432 |
| `op_processo_documento_instrucao` | 92 MB | 563.919 |
| `op_operador_produto_empresa` | 22 MB | 168.785 |
| `op_processo_documento_trace` | 33 MB | 119.652 |
| `op_catalogo_produto` | 68 MB | 102.452 |
| `op_operador_estrangeiro` | 11 MB | 51.270 |
| `op_documento_despacho_relacao` | 2832 kB | 37.578 |
| `op_despacho_documento` | 3208 kB | 10.861 |
| `op_empresa_documento` | 1080 kB | 6.872 |
| `op_tarefa_responsavel` | 512 kB | 4.818 |
| `op_tarefa` | 1736 kB | 4.683 |
| `op_proposta_documento` | 368 kB | 4.034 |
| `op_acao_execucao` | 808 kB | 3.376 |
| `op_ocorrencia` | 624 kB | 1.775 |
| `op_processo_documento_bkp_vazamento` | 504 kB | 1.702 |
| `op_dossie_documento` | 2088 kB | 1.544 |
| `op_centro_parceiro` | 176 kB | 1.350 |
| `op_inscricao_estadual` | 320 kB | 881 |
| `op_processo_vinculado` | 184 kB | 652 |
| `op_dossie` | 136 kB | 357 |
| `op_catalogo_empresa` | 96 kB | 186 |
| `op_transportador_nacional` | 80 kB | 91 |
| `op_centro_custo` | 48 kB | 56 |
| `op_lpco_documento` | 40 kB | 32 |
| `op_acao_tabela_config` | 32 kB | 1 |
| `op_acao` | 32 kB | 0 |
| `op_processo_problema` | 16 kB | 0 |
| `op_natureza_operacao_nfe` | 16 kB | 0 |
| `op_natureza_operacao_cfop` | 8192 bytes | 0 |
| `op_acao_coluna_config` | 16 kB | 0 |
| `op_extracao_agendamento` | 16 kB | 0 |
| `op_processo_receita` | 16 kB | 0 |

### `imp_*` — Importação (DI/DUIMP) (55 tabelas)

| Tabela | Tamanho | Linhas estimadas |
|---|---|---|
| `imp_adicao_item` | 2535 MB | 2.751.477 |
| `imp_processo_transmissao_critica` | 488 MB | 1.978.051 |
| `imp_adicao` | 1114 MB | 1.121.297 |
| `imp_fatura_item` | 827 MB | 1.038.007 |
| `imp_processo_receita` | 78 MB | 558.227 |
| `imp_adicao_acrescimo` | 73 MB | 476.657 |
| `imp_processo_transmissao` | 102 MB | 470.708 |
| `imp_processo_situacao_despacho` | 366 MB | 413.448 |
| `imp_processo` | 773 MB | 268.726 |
| `imp_item_cadastro` | 84 MB | 183.165 |
| `imp_processo_volume` | 21 MB | 151.685 |
| `imp_processo_armazem` | 20 MB | 140.971 |
| `imp_processo_container` | 21 MB | 124.864 |
| `imp_fatura` | 43 MB | 111.898 |
| `imp_item_acrescimo` | 17 MB | 106.626 |
| `imp_adicao_acompanhamento_anuencia` | 24 MB | 95.062 |
| `imp_tela_mantra` | 85 MB | 68.034 |
| `imp_processo_acrescimo` | 10 MB | 67.282 |
| `imp_fornecedor_cadastro` | 11 MB | 39.678 |
| `imp_processo_situacao_pendencia_frete` | 4464 kB | 21.766 |
| `imp_po_item` | 5336 kB | 8.030 |
| `imp_po` | 1952 kB | 7.059 |
| `imp_processo_ato` | 1016 kB | 7.021 |
| `imp_adicao_item_lpco` | 752 kB | 6.795 |
| `imp_fatura_item_lpco` | 840 kB | 6.753 |
| `imp_processo_declaracao_exportacao` | 968 kB | 5.391 |
| `imp_adicao_documento_vinculado` | 200 kB | 1.069 |
| `imp_processo_cambio` | 328 kB | 876 |
| `imp_processo_viabilidade_servico` | 192 kB | 829 |
| `imp_adicao_deducao` | 216 kB | 723 |
| `imp_processo_deducao` | 200 kB | 707 |
| `imp_processo_fatura_item_viabilidade` | 224 kB | 319 |
| `imp_processo_fatura_viabilidade` | 88 kB | 158 |
| `imp_processo_viabilidade` | 96 kB | 153 |
| `imp_item_duimp_declaracao_vinculada` | 64 kB | 41 |
| `imp_adicao_anuencia` | 32 kB | 39 |
| `imp_processo_viabilidade_acrescimo` | 64 kB | 26 |
| `imp_ato_legal` | 80 kB | 26 |
| `imp_agente` | 32 kB | 4 |
| `imp_item_certificado_mercosul` | 32 kB | 3 |
| `imp_dispositivo_legal_icms` | 32 kB | 2 |
| `imp_complementar_cadastro` | 32 kB | 1 |
| `imp_processo_bl_taxas` | 16 kB | 0 |
| `imp_processo_processo_auxiliar_complementar` | 16 kB | 0 |
| `imp_processo_bl` | 16 kB | 0 |
| `imp_adicao_item_po` | 8192 bytes | 0 |
| `imp_item_deducao` | 32 kB | 0 |
| `imp_processo_auxiliar` | 16 kB | 0 |
| `imp_processo_awb` | 16 kB | 0 |
| `imp_processo_bl_container` | 16 kB | 0 |
| `imp_ato_legal_ncm` | 16 kB | 0 |
| `imp_nota_fiscal_entrada` | 32 kB | sem estatística |
| `imp_po_item_lpco` | 16 kB | sem estatística |
| `imp_nota_fiscal_entrada_evento` | 24 kB | sem estatística |
| `imp_processo_carga_referenciada` | 16 kB | sem estatística |

### `fin_*` — Financeiro do próprio SIGRA (numerário, ordens, NFS, comissão) (34 tabelas)

| Tabela | Tamanho | Linhas estimadas |
|---|---|---|
| `fin_ordem` | 8740 MB | 2.282.383 |
| `fin_fatura_imposto` | 152 MB | 1.119.376 |
| `fin_nfs_imposto` | 139 MB | 1.093.805 |
| `fin_movimentacao` | 386 MB | 728.368 |
| `fin_numerario_detalhe` | 140 MB | 651.927 |
| `fin_extrato` | 307 MB | 573.148 |
| `fin_nfs` | 1718 MB | 278.525 |
| `fin_ordem_pagamentos` | 7192 kB | 51.494 |
| `fin_total_bank_webhook_evento` | 13 MB | 29.501 |
| `fin_boleto` | 10 MB | 25.211 |
| `fin_imposto` | 4344 kB | 20.602 |
| `fin_fornecedor` | 2352 kB | 9.511 |
| `fin_balanco` | 2304 kB | 5.427 |
| `fin_categoria` | 712 kB | 4.487 |
| `fin_contrato` | 4272 kB | 4.130 |
| `fin_pre_custo_detalhe` | 312 kB | 2.205 |
| `fin_conta_empresa` | 888 kB | 583 |
| `fin_ordem_faturas` | 112 kB | 353 |
| `fin_ordem_acertos` | 88 kB | 336 |
| `fin_comissao_regra_perfil` | 88 kB | 167 |
| `fin_comissao_regra_servico` | 64 kB | 62 |
| `fin_comissao_regra_parceiro` | 56 kB | 62 |
| `fin_comissao_regra` | 80 kB | 62 |
| `fin_comissao_regra_tipo_ordem` | 56 kB | 62 |
| `fin_grupo` | 80 kB | 47 |
| `fin_finalidade_ted_registro` | 48 kB | 43 |
| `fin_finalidade_doc_registro` | 32 kB | 14 |
| `fin_comissao_gestor` | 32 kB | 4 |
| `fin_convenio_total_bank` | 64 kB | 4 |
| `fin_tipo_item_servico` | 32 kB | 4 |
| `fin_integracao_total_bank` | 64 kB | 1 |
| `fin_conta_contabil` | 16 kB | 0 |
| `fin_comissao` | 40 kB | 0 |
| `fin_comissao_grupo` | 32 kB | 0 |

### `sis_*` — Sistema (usuários, empresas, parâmetros, catálogos) (53 tabelas)

| Tabela | Tamanho | Linhas estimadas |
|---|---|---|
| `sis_arquivo` | 1838 MB | 4.849.642 |
| `sis_parametro` | 67 MB | 280.314 |
| `sis_item_fatura` | 35 MB | 114.131 |
| `sis_notificacao_usuario` | 7416 kB | 62.612 |
| `sis_coda_coin_utilizada` | 11 MB | 57.841 |
| `sis_controle_documento_financeiro` | 1256 kB | 13.285 |
| `sis_novidade_usuario` | 872 kB | 7.693 |
| `sis_grupo_parceiro` | 504 kB | 4.477 |
| `sis_empresa` | 2088 kB | 4.169 |
| `sis_grupo_usuario_empresa` | 512 kB | 2.712 |
| `sis_usuario` | 3352 kB | 1.774 |
| `sis_coda_coin` | 304 kB | 1.046 |
| `sis_recinto` | 136 kB | 903 |
| `sis_grupo_usuario` | 128 kB | 874 |
| `sis_grupo_empresa` | 192 kB | 767 |
| `sis_relatorio` | 160 kB | 341 |
| `sis_empresa_seguidor` | 144 kB | 304 |
| `sis_usuario_coin` | 64 kB | 155 |
| `sis_coda_coin_compra` | 72 kB | 57 |
| `sis_relatorio_coluna_config` | 80 kB | 43 |
| `sis_relatorio_agendamento` | 160 kB | 39 |
| `sis_mensagem_ie` | 40 kB | 34 |
| `sis_fila_tarefa` | 48 kB | 34 |
| `sis_novidade` | 72 kB | 30 |
| `sis_notificacao_mobile` | 224 kB | 21 |
| `sis_solicitacao_vinculo_empresa` | 64 kB | 18 |
| `sis_conta_servico_rotas` | 24 kB | 10 |
| `sis_local` | 72 kB | 9 |
| `sis_parceiro_comissao` | 32 kB | 3 |
| `sis_conta_servico` | 48 kB | 2 |
| `sis_relatorio_template` | 64 kB | 2 |
| `sis_conta_servico_grupos` | 24 kB | 2 |
| `sis_relatorio_filtro` | 48 kB | 2 |
| `sis_relatorio_grupo` | 24 kB | 1 |
| `sis_agente_email` | 304 kB | 1 |
| `sis_representante_autorizado` | 16 kB | 0 |
| `sis_usuario_cliente_acesso` | 24 kB | 0 |
| `sis_coda_instrucao` | 16 kB | 0 |
| `sis_feriado` | 16 kB | 0 |
| `sis_email_empresa` | 16 kB | 0 |
| `sis_relatorio_tabela_config` | 24 kB | 0 |
| `sis_relatorio_template_grupo_empresa` | 8192 bytes | 0 |
| `sis_relatorio_agendamentos` | 16 kB | 0 |
| `sis_empresa_complementares` | 8192 bytes | 0 |
| `sis_coda_prompt` | 16 kB | 0 |
| `sis_contato` | 16 kB | 0 |
| `sis_empresa_integracao_config` | 64 kB | 0 |
| `sis_integracao_mapeamento` | 32 kB | 0 |
| `sis_painel_controle_revisao` | 16 kB | sem estatística |
| `sis_painel_controle` | 16 kB | sem estatística |
| `sis_painel_controle_grupo_empresa` | 8192 bytes | sem estatística |
| `sis_relatorio_template_agendamento` | 16 kB | sem estatística |
| `sis_empresa_integracao_config_usuario` | 32 kB | sem estatística |

### `ce_*` — CE Mercante / Manifesto marítimo (17 tabelas)

| Tabela | Tamanho | Linhas estimadas |
|---|---|---|
| `ce_mercante_item_ncm` | 119 MB | 690.119 |
| `ce_mercante_item` | 47 MB | 186.740 |
| `ce_mercante_itens` | 198 MB | 186.739 |
| `ce_mercante_item_lacres` | 56 MB | 183.652 |
| `ce_mercante_lacre` | 39 MB | 183.652 |
| `ce_mercante_componentes_frete` | 215 MB | 178.028 |
| `ce_mercante_frete` | 137 MB | 178.028 |
| `ce_mercante` | 92 MB | 109.942 |
| `ce_manifesto_escala` | 64 MB | 84.289 |
| `ce_mercante_manifesto` | 98 MB | 83.217 |
| `ce_mercante_transbordos` | 47 MB | 39.521 |
| `ce_mercante_transbordo` | 30 MB | 39.521 |
| `ce_manifesto` | 25 MB | 35.683 |
| `ce_manifesto_terminal` | 34 MB | 34.199 |
| `ce_mercante_doc_despacho` | 7296 kB | 8.112 |
| `ce_viagem` | 16 kB | 0 |
| `ce_mercante_docs_despacho` | 24 kB | 0 |

### `exp_*` — Exportação (30 tabelas)

| Tabela | Tamanho | Linhas estimadas |
|---|---|---|
| `exp_processo_situacao_despacho` | 102 MB | 598.105 |
| `exp_re_item` | 156 MB | 185.954 |
| `exp_re` | 195 MB | 185.762 |
| `exp_nota_item` | 122 MB | 181.757 |
| `exp_processo` | 34 MB | 50.211 |
| `exp_nota` | 22 MB | 45.569 |
| `exp_fatura` | 12 MB | 34.073 |
| `exp_processo_transmissao` | 5528 kB | 33.335 |
| `exp_fatura_item` | 20 MB | 27.468 |
| `exp_atributo_destaque_ncm` | 1696 kB | 16.453 |
| `exp_processo_volume` | 2368 kB | 14.376 |
| `exp_item_due_ato_concessorio` | 1432 kB | 6.832 |
| `exp_item_cadastro` | 2648 kB | 6.099 |
| `exp_comprador_cadastro` | 1032 kB | 4.654 |
| `exp_processo_container` | 760 kB | 4.092 |
| `exp_processo_transmissao_critica` | 1240 kB | 4.074 |
| `exp_item_due_nota_referenciada` | 528 kB | 2.484 |
| `exp_item_due_justificativa` | 280 kB | 1.457 |
| `exp_re_lote` | 192 kB | 992 |
| `exp_item_due_documento_vinculado` | 120 kB | 735 |
| `exp_fatura_item_nota_referenciada` | 80 kB | 175 |
| `exp_nota_item_nota_referenciada` | 88 kB | 151 |
| `exp_processo_situacao_carga` | 104 kB | 79 |
| `exp_processo_justificativa_tipo` | 32 kB | 11 |
| `exp_processo_justificativa` | 32 kB | 6 |
| `exp_processo_exigencia` | 32 kB | 0 |
| `exp_item_due_ato_concessorio_documento` | 16 kB | 0 |
| `exp_item_due_ato_concessorionf` | 16 kB | 0 |
| `exp_adicao_item_lpco` | 16 kB | 0 |
| `exp_fatura_item_lpco` | 16 kB | 0 |

### `zfm_*` — Zona Franca de Manaus / SUFRAMA (15 tabelas)

| Tabela | Tamanho | Linhas estimadas |
|---|---|---|
| `zfm_pli_item` | 731 MB | 511.658 |
| `zfm_produto_suframa_item` | 24 MB | 109.257 |
| `zfm_pli` | 197 MB | 107.620 |
| `zfm_produto_empresa_modelo_item` | 19 MB | 107.321 |
| `zfm_detalhe_ncm` | 6184 kB | 38.356 |
| `zfm_pli_lote` | 7720 kB | 33.587 |
| `zfm_produto_suframa_ncm` | 3664 kB | 27.723 |
| `zfm_tipo_produto` | 1000 kB | 6.696 |
| `zfm_produto_suframa` | 384 kB | 2.299 |
| `zfm_matriz_tributacao` | 200 kB | 200 |
| `zfm_produto_empresa` | 88 kB | 170 |
| `zfm_produto_empresa_modelo` | 88 kB | 152 |
| `zfm_empresa_item_controlado` | 16 kB | 0 |
| `zfm_pli_anuencia` | 24 kB | 0 |
| `zfm_linha_montagem` | 40 kB | 0 |

### `processo_*` — Processo (supertipo genérico) (2 tabelas)

| Tabela | Tamanho | Linhas estimadas |
|---|---|---|
| `processo` | 1053 MB | 713.547 |
| `processo_transmissao` | 46 MB | 36.601 |

### `dci_*` — Drawback — componente importado (10 tabelas)

| Tabela | Tamanho | Linhas estimadas |
|---|---|---|
| `dci_produto_com_ppb` | 35 MB | 138.175 |
| `dci_nota_item` | 16 MB | 54.991 |
| `dci_produto_nacional` | 7856 kB | 30.957 |
| `dci_produto_insumo` | 6160 kB | 17.743 |
| `dci_processo` | 3248 kB | 15.361 |
| `dci_nota` | 5568 kB | 14.179 |
| `dci_produto_estrangeiro` | 4856 kB | 12.966 |
| `dci_produto_sem_ppb` | 360 kB | 918 |
| `dci_item_retificacao` | 48 kB | 45 |
| `dci_mandado_judicial` | 32 kB | 0 |

### `age_*` — Agenciamento (propostas de frete/booking) (44 tabelas)

| Tabela | Tamanho | Linhas estimadas |
|---|---|---|
| `age_proposta_seguidor` | 5912 kB | 78.776 |
| `age_proposta_taxa` | 24 MB | 56.781 |
| `age_empresa_financeiro` | 2040 kB | 28.192 |
| `age_processo_custo` | 7576 kB | 23.727 |
| `age_proposta_comissao` | 5224 kB | 18.835 |
| `age_proposta` | 15 MB | 7.598 |
| `age_proposta_carga` | 2312 kB | 7.146 |
| `age_proposta_rotas` | 576 kB | 4.121 |
| `age_processo_comissao` | 600 kB | 3.045 |
| `age_processo` | 12 MB | 2.749 |
| `age_conhecimento` | 408 kB | 2.680 |
| `age_conhecimento_hawb` | 512 kB | 2.623 |
| `age_conhecimento_mawb` | 800 kB | 2.616 |
| `age_processo_volume` | 544 kB | 2.586 |
| `age_master_fornecedor` | 352 kB | 2.566 |
| `age_taxa_padrao` | 600 kB | 2.325 |
| `age_proposta_equipamento` | 640 kB | 2.252 |
| `age_processo_container` | 264 kB | 1.286 |
| `age_proposta_ofertas` | 120 kB | 960 |
| `age_taxa` | 200 kB | 700 |
| `age_fornecedor` | 152 kB | 493 |
| `age_processo_transbordo` | 88 kB | 282 |
| `age_followup_fase` | 88 kB | 102 |
| `age_tipo_equipamento` | 48 kB | 34 |
| `age_booking` | 48 kB | 29 |
| `age_documento_bl` | 80 kB | 29 |
| `age_tipo_calculo` | 32 kB | 16 |
| `age_processo_transporte` | 32 kB | 7 |
| `age_motivo_reprovacao_proposta` | 32 kB | 7 |
| `age_tipo_comissao` | 32 kB | 4 |
| `age_situacao_especial` | 48 kB | 3 |
| `age_proposta_equipamento_situacao` | 24 kB | 2 |
| `age_banco_dados` | 32 kB | 2 |
| `age_categoria_reprovacao_proposta` | 32 kB | 1 |
| `age_conta_fornecedor` | 64 kB | 1 |
| `age_servico_processo` | 32 kB | 1 |
| `age_servico` | 32 kB | 1 |
| `age_processo_container_situacao_especial` | 24 kB | 1 |
| `age_fornecedor_contas` | 40 kB | 1 |
| `age_processo_volume_situacao_especial` | 8192 bytes | 0 |
| `age_proposta_carga_situacao` | 8192 bytes | 0 |
| `age_processo_equipamento` | 16 kB | 0 |
| `age_taxa_composicao` | 8192 bytes | 0 |
| `age_processo_carga` | 16 kB | 0 |

### `rod_*` — Rodoviário (CT-e, CIOT, frota) (64 tabelas)

| Tabela | Tamanho | Linhas estimadas |
|---|---|---|
| `rod_processo_endereco` | 25 MB | 79.499 |
| `rod_processo_servico` | 15 MB | 49.398 |
| `rod_processo` | 16 MB | 25.975 |
| `rod_processo_carga` | 7360 kB | 23.045 |
| `rod_proposta_servico` | 7400 kB | 15.205 |
| `rod_municipio_coordenada` | 960 kB | 5.571 |
| `rod_proposta` | 24 MB | 5.338 |
| `rod_cte` | 20 MB | 4.636 |
| `rod_cte_servico` | 728 kB | 4.538 |
| `rod_proposta_carga` | 1472 kB | 4.136 |
| `rod_conhecimento` | 912 kB | 2.526 |
| `rod_nota` | 112 kB | 99 |
| `rod_nota_item` | 96 kB | 76 |
| `rod_ciot_participante` | 72 kB | 46 |
| `rod_destino` | 72 kB | 44 |
| `rod_cte_averbacao` | 592 kB | 37 |
| `rod_ciot_transmissao` | 248 kB | 37 |
| `rod_servico_cadastro` | 64 kB | 34 |
| `rod_tipo_veiculo` | 72 kB | 31 |
| `rod_frota` | 72 kB | 29 |
| `rod_ciot_pagamento` | 72 kB | 28 |
| `rod_ciot_veiculo` | 56 kB | 27 |
| `rod_rota` | 72 kB | 25 |
| `rod_ciot_viagem` | 72 kB | 23 |
| `rod_fornecedor` | 72 kB | 22 |
| `rod_ciot` | 88 kB | 18 |
| `rod_manifesto_seguro` | 80 kB | 12 |
| `rod_processo_fornecedor` | 56 kB | 12 |
| `rod_processo_motorista` | 56 kB | 12 |
| `rod_motorista` | 72 kB | 11 |
| `rod_processo_frota` | 56 kB | 11 |
| `rod_manifesto_transmissao` | 200 kB | 7 |
| `rod_frota_efrete` | 80 kB | 6 |
| `rod_manifesto` | 64 kB | 6 |
| `rod_ciot_teto_inss` | 48 kB | 4 |
| `rod_manifesto_pagamento` | 24 kB | 3 |
| `rod_manifesto_carga` | 32 kB | 3 |
| `rod_manifesto_veiculo` | 32 kB | 3 |
| `rod_fornecedor_efrete` | 80 kB | 3 |
| `rod_manifesto_fornecedor` | 24 kB | 3 |
| `rod_manifesto_motorista` | 24 kB | 2 |
| `rod_contrato` | 112 kB | 2 |
| `rod_motorista_efrete` | 80 kB | 2 |
| `rod_fornecedor_rota` | 24 kB | 1 |
| `rod_declaracao_importacao` | 32 kB | 1 |
| `rod_categoria_reprovacao_proposta` | 32 kB | 1 |
| `rod_motivo_reprovacao_proposta` | 32 kB | 1 |
| `rod_declaracao_transito` | 32 kB | 1 |
| `rod_manifesto_ciot` | 24 kB | 0 |
| `rod_cte_componente_valor` | 24 kB | 0 |
| `rod_contrato_servico` | 16 kB | 0 |
| `rod_valor_rota` | 16 kB | 0 |
| `rod_manifesto_pagamento_comp` | 24 kB | 0 |
| `rod_fornecedor_documento` | 16 kB | 0 |
| `rod_empresa_seguro_config_aud` | 16 kB | 0 |
| `rod_empresa_seguro_config` | 80 kB | 0 |
| `rod_manifesto_vale_pedagio` | 24 kB | 0 |
| `rod_manifesto_percurso` | 24 kB | 0 |
| `rod_manifesto_cte` | 24 kB | 0 |
| `rod_ciot_viagem_ponto` | 16 kB | 0 |
| `rod_ciot_quebra` | 16 kB | 0 |
| `rod_ciot_operacao_log` | 48 kB | 0 |
| `rod_ciot_contratante_fracionado` | 16 kB | 0 |
| `rod_distancia_municipio_cache` | 64 kB | 0 |

### `cct_*` — CCT (Controle de Carga e Tránsito, aéreo/marítimo) (9 tabelas)

| Tabela | Tamanho | Linhas estimadas |
|---|---|---|
| `cct_total_origem` | 5264 kB | 41.310 |
| `cct_recepcao` | 8632 kB | 16.484 |
| `cct_tela` | 11 MB | 15.766 |
| `cct_maritimo_frete` | 2312 kB | 14.551 |
| `cct_tela_maritimo_fretes` | 2120 kB | 14.551 |
| `cct_maritimo_embalagem` | 1696 kB | 8.784 |
| `cct_tela_maritimo_embalagens` | 1352 kB | 8.784 |
| `cct_tela_maritimo` | 1704 kB | 3.781 |
| `cct_tela_aereo` | 88 kB | 10 |

### `dcr_*` — Drawback — componente nacional (5 tabelas)

| Tabela | Tamanho | Linhas estimadas |
|---|---|---|
| `dcr_componente_importado` | 21 MB | 79.405 |
| `dcr_produto_nacional` | 8136 kB | 27.363 |
| `dcr_modelo` | 632 kB | 3.743 |
| `dcr_processo` | 584 kB | 2.556 |
| `dcr_sub_componente_importado` | 32 kB | 0 |

### `duimp_*` — DUIMP — transmissão/cálculo (2 tabelas)

| Tabela | Tamanho | Linhas estimadas |
|---|---|---|
| `duimp_processo_transmissao` | 9184 kB | 65.281 |
| `duimp_calculo_transmissao` | 112 kB | 386 |

### `trk_*` — Tracking de embarque/contêiner (9 tabelas)

| Tabela | Tamanho | Linhas estimadas |
|---|---|---|
| `trk_embarque_evento` | 3264 kB | 12.222 |
| `trk_embarque_movimento` | 664 kB | 1.586 |
| `trk_embarque_container` | 336 kB | 985 |
| `trk_embarque` | 800 kB | 659 |
| `trk_embarque_escala` | 200 kB | 610 |
| `trk_local_alias` | 80 kB | 52 |
| `trk_empresa_monitorada` | 80 kB | 25 |
| `trk_situacao_alias` | 80 kB | 9 |
| `trk_situacao_canonica` | 64 kB | 8 |

### `coda_*` — "Coda" — parece motor de extração automática (IA) de documentos (18 tabelas)

| Tabela | Tamanho | Linhas estimadas |
|---|---|---|
| `coda_imp_fatura_item` | 4112 kB | 4.413 |
| `coda_imp_fatura` | 1800 kB | 1.708 |
| `coda_exp_fatura_item` | 256 kB | 484 |
| `coda_imp_processo_bl_container` | 80 kB | 356 |
| `coda_exp_fatura` | 112 kB | 137 |
| `coda_imp_embarque` | 192 kB | 137 |
| `coda_imp_processo_fila_documento` | 232 kB | 131 |
| `coda_processo_bl_taxas` | 48 kB | 68 |
| `coda_imp_processo_bl` | 208 kB | 28 |
| `coda_imp_processo_fila` | 144 kB | 26 |
| `coda_imp_processo_awb` | 240 kB | 15 |
| `coda_imp_processo_crt` | 32 kB | 9 |
| `coda_fin_pagamento` | 32 kB | 7 |
| `coda_exp_nota` | 16 kB | 0 |
| `coda_exp_nota_item` | 16 kB | 0 |
| `coda_ia_rodada` | 96 kB | sem estatística |
| `coda_imp_conferencia_divergencia` | 16 kB | sem estatística |
| `coda_imp_conferencia` | 16 kB | sem estatística |

### `lpco_*` — LPCO (licenças/permissões de importação) (8 tabelas)

| Tabela | Tamanho | Linhas estimadas |
|---|---|---|
| `lpco_pedido_seguidor` | 104 kB | 746 |
| `lpco_modelo` | 9376 kB | 204 |
| `lpco_item_importacao` | 280 kB | 175 |
| `lpco_pedido_transmissao_critica` | 72 kB | 84 |
| `lpco_pedido_transmissao` | 64 kB | 46 |
| `lpco_pedido` | 2208 kB | 29 |
| `lpco_item_exportacao` | 32 kB | 2 |
| `lpco_pedido_exigencia` | 16 kB | 0 |

### `fix_*` — Scripts de correção pontual (migração) (3 tabelas)

| Tabela | Tamanho | Linhas estimadas |
|---|---|---|
| `fix_dt_criacao_api_hub_2026_06_25` | 96 kB | 1.010 |
| `fix_despachante_clone_2026_06_23` | 8192 bytes | 66 |
| `fix_dt_criacao_valmet_2026_06_25` | 8192 bytes | 16 |

### `sv_*` — SUFRAMA Virtual (aquisição/enquadramento) — não é "seguro" (7 tabelas)

| Tabela | Tamanho | Linhas estimadas |
|---|---|---|
| `sv_nbs` | 272 kB | 883 |
| `sv_aquisicao_item` | 192 kB | 3 |
| `sv_aquisicao_item_pagamento` | 96 kB | 3 |
| `sv_lote_envio` | 48 kB | 2 |
| `sv_aquisicao` | 64 kB | 1 |
| `sv_aquisicao_item_enquadramento` | 8192 bytes | 0 |
| `sv_enquadramento` | 16 kB | 0 |

### `ie_*` — Inscrição Estadual (fila de processamento) (3 tabelas)

| Tabela | Tamanho | Linhas estimadas |
|---|---|---|
| `ie_item_fila` | 720 kB | 541 |
| `ie_paag_pedido` | 64 kB | 48 |
| `ie_fila` | 32 kB | 2 |

### `rem_*` — Remessa / protótipos (drawback) (6 tabelas)

| Tabela | Tamanho | Linhas estimadas |
|---|---|---|
| `rem_produto_prototipo` | 80 kB | 160 |
| `rem_compra_prototipo` | 64 kB | 75 |
| `rem_embarque_prototipo` | 64 kB | 35 |
| `rem_remessa` | 16 kB | 0 |
| `rem_manifesto` | 16 kB | 0 |
| `rem_processo` | 8192 bytes | 0 |

### `sx_*` — Catálogos globais (CFOP, atributos NCM) (2 tabelas)

| Tabela | Tamanho | Linhas estimadas |
|---|---|---|
| `sx_cfop` | 48 kB | 63 |
| `sx_atributo_ncm_fonte_cache` | 16 kB | 0 |

### `conta_*` — Autorização de conta de serviço (1 tabelas)

| Tabela | Tamanho | Linhas estimadas |
|---|---|---|
| `conta_servico_authorities` | 40 kB | 21 |

### `wh_*` — Armazém (warehouse receipt) (4 tabelas)

| Tabela | Tamanho | Linhas estimadas |
|---|---|---|
| `wh_receipt_volume` | 48 kB | 11 |
| `wh_receipt` | 64 kB | 8 |
| `wh_armazem` | 32 kB | 1 |
| `wh_receipt_container` | 16 kB | 0 |

### `cleanup_*` — Scripts de limpeza pontual (1 tabelas)

| Tabela | Tamanho | Linhas estimadas |
|---|---|---|
| `cleanup_doc_invertidos_2026_06_19` | 8192 bytes | 3 |

### `api_*` — Integrações/API (chaves, PLI faturamento) (9 tabelas)

| Tabela | Tamanho | Linhas estimadas |
|---|---|---|
| `api_key` | 88 kB | 3 |
| `api_pli_webhook_log` | 40 kB | 0 |
| `api_pli_webhook_config` | 24 kB | 0 |
| `api_pli_plano_faturamento` | 40 kB | 0 |
| `api_pli_faturamento_mensal` | 48 kB | 0 |
| `api_pli_conta_config` | 32 kB | 0 |
| `api_pli_resposta` | 48 kB | 0 |
| `api_pli_lote` | 72 kB | 0 |
| `api_pli_item` | 40 kB | sem estatística |

### `sg_*` — CRM/Leads comerciais internos da Pinho (2 tabelas)

| Tabela | Tamanho | Linhas estimadas |
|---|---|---|
| `sg_evento` | 16 kB | 0 |
| `sg_lead` | 16 kB | 0 |

### `com_*` — Desconhecido (1 tabela, "com_fq", vazia) (1 tabelas)

| Tabela | Tamanho | Linhas estimadas |
|---|---|---|
| `com_fq` | 16 kB | 0 |

### `teste_*` — Tabela de teste (1 tabelas)

| Tabela | Tamanho | Linhas estimadas |
|---|---|---|
| `teste` | 16 kB | 0 |

### `persistent_*` — Sessões persistentes de login (Spring Security) (1 tabelas)

| Tabela | Tamanho | Linhas estimadas |
|---|---|---|
| `persistent_logins` | 24 kB | 0 |

### `edx_*` — Log de embarque (EDI?) (1 tabelas)

| Tabela | Tamanho | Linhas estimadas |
|---|---|---|
| `edx_embarque_log` | 32 kB | 0 |

### `rep_*` — Regime especial (REP/ADE) — provável Recof/Repetro (11 tabelas)

| Tabela | Tamanho | Linhas estimadas |
|---|---|---|
| `rep_contrato` | 16 kB | sem estatística |
| `rep_item` | 16 kB | sem estatística |
| `rep_documento` | 16 kB | sem estatística |
| `rep_item_saldo` | 16 kB | sem estatística |
| `rep_mov_lote_nota` | 0 bytes | sem estatística |
| `rep_movimentacao_lote` | 16 kB | sem estatística |
| `rep_processo` | 16 kB | sem estatística |
| `rep_local` | 16 kB | sem estatística |
| `rep_movimentacao` | 16 kB | sem estatística |
| `rep_ade` | 16 kB | sem estatística |
| `rep_ade_habilitado` | 8192 bytes | sem estatística |

### `samsung_*` — Integração específica do cliente Samsung (1 tabelas)

| Tabela | Tamanho | Linhas estimadas |
|---|---|---|
| `samsung_retorno` | 24 kB | sem estatística |

</details>

## Próximo passo

Escolher entre as **candidatas** acima (ou outra que chamar atenção na lista completa) e rodar a query de colunas:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'pinho' AND table_name = '<nome_da_tabela>'
ORDER BY ordinal_position;
```

_Levantamento em: 2026-09-18_