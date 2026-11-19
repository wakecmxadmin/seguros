# Tarefas

`***************-----` **74%**

**Total:** 69  ·  **Pendentes:** 18  ·  **Feitas (aguardando fechamento):** 17  ·  **Concluídas:** 34

---

## Pendentes

### Decisões pendentes com o cliente

- [x] **53.** **Descobrir o que é "Importação Fresno".** — 03/11/2026, **resolvido**: é o cliente
  **FRESNOMAQ Indústria de Máquinas S/A** (códigos 723, 2720 e 2779 no legado — matriz e duas
  filiais, CNPJ raiz `06337280`, ~1.017 processos, todos de importação, parceiro ASCENSUS). Não é
  apólice (busca por "FRESNO" no Cadastro de Apólices veio vazia) nem tipo de operação (o legado só
  tem Importação/Exportação/Prorrogada). **Também não existe tela "Parâmetros" no Coomex Hub** —
  conferido no menu Sistema, no Cadastro de Clientes (só Geral/Contatos/Dados Cobrança) e no de
  Apólices; a "aba Parâmetros" que o cliente citou é de uma planilha dele, o que explica o slot
  dedicado a um único cliente. Modelado como **agravo por cliente**
  (`Company.payableDiscountPercent`, opcional): quando preenchido vence o parâmetro do ramo, quando
  vazio vale o do ramo. Sai a flag manual `fresno` e sai o parâmetro
  `insurance.payable_discount_import_fresno_percent`. **Ao migrar os clientes (tarefa 51), lançar
  25 % de agravo próprio nos três cadastros da FRESNOMAQ** — hoje o valor coincide com o do ramo,
  então nada sai errado no meio-tempo, mas a exceção precisa existir para quando divergirem.
  Não foi possível validar o agravo contra dado real: a *Planilha Produção* do legado (único lugar
  onde a coluna aparece) voltou vazia em todos os filtros tentados.

- [ ] **3.** Confirmar se as regras **`fl*NaoCliente`** ainda são usadas (verba que entra na base da
  seguradora mas não é repassada ao cliente). Existem no modelo legado, mas não aparecem em nenhuma
  tela. → `docs/11-dicionario-dados.md`

- [ ] **4.** Confirmar a regra de **retenção de IRRF** com faturamento mínimo acumulado
  (`vlFatMinimoRetencaoIrrf`, `vlFatAcumuladoRetencao`, `pcIrrfRetencao`) — existe no modelo, sem tela.

- [ ] **5.** Definir escopo de **Sinistros** e **Cartas de Protesto**. Têm endpoints e telas completas
  no legado, mas estão fora do menu. Aparentam ser relevantes para o negócio. — 18/11/2026: as
  **cartas de protesto estão em uso** (aba da definitiva; catálogos com 74 avarias marítimas, 16 aéreas e
  ~120 destinatários, salvos em `backend/prisma/data/legacy-cartas-protesto-catalogos.json`). Sinistros
  seguem inalcançáveis pela UI do legado. → `docs/19` rodada 2

- [ ] **7.** Obter o **prêmio mínimo por apólice**. O cálculo o aplica (conferido: 20,41 → 30,00), mas
  o campo não aparece na tela de Apólices. Descobrir onde está configurado hoje.

- [ ] **49.** **Exceção de taxa de câmbio na fatura de cobrança.** Para o cliente Farm Direct Food
  (processo SIGRA 1898813, averbação P1954/D106647) **não** se usa a taxa de abertura + 6% do dia —
  usa-se a taxa cambial do próprio processo de importação (a do DI/DUIMP no SIGRA, no exemplo enviado:
  `5,1253`). Falta confirmar com o cliente: essa exceção é **por cliente específico** ou vale para
  **todo processo com impostos (DI)** — o outro exemplo (processo 1901475) foi descrito como "cliente
  sem impostos" e não teve essa ressalva. Sem essa resposta não dá pra saber se é uma flag no cadastro
  do parceiro (`partners`) ou uma regra automática por tipo de processo.

### Próximos passos

- [ ] **36.** Persistir o **prêmio mínimo** na cotação. Hoje ele vem da apólice; se o operador digitar
  um valor sem selecionar apólice, o processo salva com o piso aplicado mas ao reabrir recalcula sem
  ele (divergência observada: salvo 30,00, reaberto 20,41).

- [ ] **15.** Configurar SMTP no `backend/.env`. Hoje os e-mails de convite e recuperação são apenas
  escritos no log do servidor.

- [ ] **41.** **Clonar o banco de dados de produção do projeto (`seguros`) para um ambiente local.**
  Permite testar mudanças de schema e rodar queries pesadas sem impactar produção.

- [ ] **42.** **Clonar o banco do SIGRA (`sigraweb`) para um ambiente local.** Só clonar as tabelas
  confirmadas como necessárias pela tarefa 47, não o banco inteiro (410 tabelas no schema `pinho`,
  muitas colunas cada). Usar os certificados em `backend/certs/sigra/` e as credenciais já configuradas
  no `.env` (ver `docs/SIGRA_DB.md`).

- [x] **43.** **Mapear o banco do SIGRA e identificar quais dados são úteis para este projeto.**
  Depende da tarefa 47 — só depois de saber quais campos dos documentos padrão (BL, Invoice, Packing
  List, CE Mercante, CCT, TFA) existem como coluna em `pinho.imp_processo` (ou tabela satélite) dá para
  fechar esse mapeamento e complementar `docs/SIGRA_DB.md`.
  — 19/11/2026: **concluído** em 8 rodadas (4–11) de queries rodadas pelo usuário — `docs/21-sigra-integracao-seguro.md`.
  Chave de ligação: o ID de 7 dígitos na referência do processo de seguro é o `processo.id` do SIGRA.
  Importação via `imp_processo` (inclui chegada por `dt_chegada_brasil`); exportação via agenciamento
  (`age_processo`), sem valor de mercadoria. Cliente = `processo.id_parceiro` (não `id_empresa`).

- [ ] **44.** **Fazer a integração de dados com o SIGRA**, a partir do mapeamento da tarefa 43 — trazer
  os campos úteis (datas do processo, valores, itens) para dentro do sistema de seguros. —
  18/09/2026: criado o módulo `backend/src/sigra` — conexão dedicada só leitura ao `sigraweb`
  (pool `pg` próprio, reforço de read-only em duas camadas, desliga sozinho sem `DB_SIGRA_*`) e
  `SigraProcessService` com os campos já confirmados linha a linha (`imp_processo`, `processo`,
  `imp_adicao`, `imp_adicao_item`, `imp_processo_container`). Exposto em `GET /sigra/processes/:id`
  e em `GET /quotes/:id/sigra` (resolve pelo `ExternalReference` da tarefa 30). Ainda **não** inclui
  BL detalhado, CE Mercante, fatura nem documento/arquivo — essas tabelas satélite dependem da
  rodada 3 da tarefa 47. — 18/09/2026 (2): botão **"Puxar do SIGRA"** na tela de Nova Cotação
  (importação) — operador digita o nº do processo, `GET /quotes/sigra-draft/:sigraId`
  (`sigra-draft-mapper.ts`) traduz os dados do SIGRA em sugestões (peso, NCM, invoice, descrição,
  custo/frete/impostos) e preenche o formulário; nada é gravado até o operador salvar. Ao criar a
  cotação, a `ExternalReference` (source `SIGRA`) é criada automaticamente. **De propósito, não
  preenche moeda, cliente nem câmbio** — sem mapeamento confiável de moeda por processo ainda, e a
  taxa de câmbio do processo (`vl_taxa_dolar`) só é mostrada como informação, nunca aplicada (ver
  tarefa 49, decisão de negócio pendente). Só aparece na criação (não na edição) e só pra
  importação (não há dado de exportação mapeado). Falta ainda: mesma coisa pra averbação, e o
  fluxo automático em lote (ficou como opção B descartada por enquanto). — 18/09/2026 (3): também
  preenche **país e porto de origem** (aba Rota) — `local_embarque` do SIGRA vem como
  `"<UN/LOCODE> - <nome>"` (ex. `"CNTAO - TSINGTAO"`); o prefixo bate com o `code` do nosso catálogo
  de portos (confirmado: `CNTAO` já existe cadastrado, Porto de Qingdao). Quando o porto específico
  não está nos 44 cadastrados, ainda assim preenche o país pelo prefixo de 2 letras. Concluí (com o
  usuário) que Identificação (data, apólice, parceiro) e Financeiro (incoterm, moeda, condições
  comerciais, comissões) não têm equivalente confiável no SIGRA hoje — incoterm e moeda existem só
  como FK numérica (`id_incoterms`/`id_moeda` em `imp_fatura`), catálogo ainda não resolvido.
  — 19/11/2026: **integração refeita com o mapeamento da tarefa 43** (`docs/21`, seção Implementação):
  importação e **exportação** (agenciamento) no "Puxar do SIGRA", com cliente (CNPJ), moeda, incoterm,
  modal, país de destino e referência no formato do legado; atalho quando a referência já contém o id;
  cartão **Processo no SIGRA** na cotação com os PDFs; sugestão de **chegada** e conhecimento na emissão
  da definitiva; incoterms DPU/OCV (migração `20261119120000_incoterm_dpu_ocv`). 118 testes passam.
  **Falta:** rodar `npm run sigra:test -- 1935396` e `-- 1921824` (só o usuário) para validar as
  consultas novas contra o SIGRA real; aplicar as migrações no deploy. Fila de processos com flag de
  seguro sem cotação ficou de fora (item 6, não aprovado).

- [x] **54.** **Inserir "Cadastro de Seguradora"** (demanda do cliente, 03/11/2026). — Cadastros →
  Seguro → **Seguradoras**, que abre o cadastro unificado de Empresas restrito ao papel Seguradora,
  com o papel já marcado ao criar. **De propósito não é um cadastro separado**: foi exatamente isso
  que duplicou empresas no legado (a Fidcargo existia duas vezes, ver tarefa 23). Uma seguradora que
  também seja parceira continua sendo um registro só, e aparece nas duas listagens.

- [x] **55.** **Cadastro de apólice só com os dados da apólice** (demanda do cliente, 03/11/2026):
  número, descrição, importância segurada, corretor, tipo (impo/expo), seguradora e situação —
  sem taxas de cliente. — a tela já ficou assim (formulário e listagem), e o texto de apoio aponta
  onde as taxas vivem agora: Coberturas e Taxas por cliente. **Resíduo consciente:**
  `Policy.baseRateClient`, `baseRateInsurer` e `minimumPremium` seguem no banco, no DTO e como
  último fallback do motor de cálculo — não são mais editáveis em tela, então apólices novas nascem
  com zero e esse fallback nunca dispara. Não foram removidos porque **conflitam com a tarefa 51**,
  que planeja migrar as apólices do legado extraindo justamente a taxa escondida no nome
  (`AKAD - 0.10% - PROBEXA`) para campo estruturado. **Confirmar com o cliente** antes da migração:
  se a taxa sai da apólice de vez, aquele `0,10 %` precisa ir para Coberturas ou Taxas por cliente,
  e aí as três colunas podem ser removidas.

- [x] **45.** **Subir o projeto na VM e colocar para rodar em produção.**

- [x] **50.** **Testar contra mais processos reais as tabelas do SIGRA que vieram vazias só pros
  dois exemplos (1901475/1898813).** Pode ser que essas tabelas simplesmente não sejam preenchidas
  pra todo processo (padrão já visto), ou pode ser que os dois exemplos escolhidos sejam atípicos
  (ambos sem CE Mercante consultado, sem BL detalhado, sem câmbio contratado). Tabelas/queries a
  repetir com outros IDs de processo: `imp_processo_bl` (+ `_container`/`_taxas`), `ce_mercante`
  (+ família `ce_mercante_*`/`ce_manifesto_*`), `imp_processo_cambio`, `coda_imp_fatura`,
  `coda_imp_processo_bl`, `trk_embarque` (por `numero_conhecimento`), `imp_processo_acrescimo`/
  `imp_processo_deducao`. Ver queries prontas em `docs/14-sigra-tabelas.md` e
  `docs/13-sigra-campos-necessarios.md`. Escolher processos variados (marítimo FCL, aéreo, com e
  sem impostos) pra não repetir o viés dos dois exemplos atuais.
  — 19/11/2026: `imp_processo_bl` tem **0 linhas** no banco (descartada); `ce_mercante` (112 mil) e
  `ce_manifesto_escala` (86 mil) são populadas, mas só 112 de 431 CEs dos processos com seguro estão no
  cadastro — a chegada vem de `dt_chegada_brasil` (92 %). `trk_embarque` e `cct_tela_maritimo` parciais.

- [x] **51.** **Migrar os cadastros do legado para o nosso banco.** Escopo fechado com o usuário
  (30/10/2026): **só cadastros**, sem histórico de transações — o histórico continua consultável no
  legado. Entidades a trazer, na ordem: **Clientes** (`#/ClientesSelecao/Menu`, ~75 registros,
  mesma estrutura de Parceiros), **Seguradoras** (9, com "Bradesco" duplicado a resolver),
  **Apólices** (a taxa está escondida no nome — `AKAD - 0.10% - PROBEXA` — e precisa virar campo
  estruturado, ver tarefa 24), **Coberturas**, **Funcionários** (4), **Mercadorias** (2),
  **Navios**, **Transportadoras**, **Vistoriadores** e **Modelos de Proposta** (arquivos .docx por
  Tipo × Cobertura). Catálogos de localização, moedas e embalagens **não** entram: já temos seed
  limpo (tarefa 19) e o do legado está sujo/duplicado. Método de extração definido: **leitura pelas
  telas no navegador** (nunca chamada direta à API do legado, ver `CLAUDE.md`), capturando as
  respostas JSON e salvando em `backend/prisma/data/` (não commitado — contém CNPJ/endereço reais),
  como já foi feito com `docs/legado-parceiros.json`. Hoje só os **parceiros** foram migrados
  (275 `companies` com papel PARTNER). Pré-requisito de schema: nenhuma entidade guarda o código do
  legado — sem isso o import não é idempotente nem permite correlacionar depois. Adicionar
  `legacyCode` em `Company`, `Policy` e `Employee` antes de rodar.

  **Concluída em 04/11/2026.** Importados: Clientes (2.790), Parceiros (275), Seguradoras (9),
  Apólices (65), Coberturas (10), Funcionários (4), Mercadorias (11), Navios (1.357) e
  **Modelos de Proposta** (63 versões, 4 vigentes com o `.docx` no S3). Duas entidades do
  escopo original não existiam como dado: **Transportadoras** — cadastro existe no legado mas
  está vazio (`qtRegistros: 0`), importador pronto caso passem a usá-lo — e **Vistoriadores**,
  que **não existe** no legado (rota `#/VistoriadoresSelecao/Menu` inválida); o importador foi
  removido e `docs/01-mapa-navegacao.md` corrigido. Novo model `ProposalTemplate`
  (migration `20261104120000_proposal_templates`) + `prisma/legacy/templates.ts`, idempotente:
  rerodar só completa o que falta. O campo **IMO de navios não veio do legado** porque lá não
  existe — o cadastro só tem nome e código; `imo` e `buildYear` são campos novos nossos,
  a preencher manualmente.

### Paridade com o legado

Objetivo (16/11/2026): mapear **tudo** que existe no legado — telas, fluxos, botões, cálculos,
números, contas e tabelas — e reproduzir no sistema novo. Mapeamento antes de implementação.

- [x] **56.** **Mapear as rotas fora do menu que nunca foram acessadas**: `AverbacaoProvisoria`,
  `AverbacaoDefinitiva`, `Certificado`, `Recibo`, `Seguro`, `Cobertura`, `Processo`, `PlanilhaIrb`,
  `IrbEmitida`, `IrbEmitidaSelecao`, `EmissaoRme`, `ProcessosProrrogacoes`, `NumerarioImpressao`,
  `ObservacaoSelecao`, `EmpresaSelecao`, Sinistros e Cartas de Protesto. Campos, filtros, colunas e
  ações de cada uma. Só leitura.
  — 18/11/2026: as 79 rotas do bundle atual estão descritas (docs 15–18 e 20); as 16 de ERP foram
  listadas por nome em `docs/01`. `IrbEmitidaSelecao` acessada: **0 IRBs emitidos**. Sinistros não
  têm caminho na UI.

- [x] **57.** **Inventariar os botões e ações de cada linha/tela já conhecida** — listagens de
  Novas, Em Aberto, Provisórias/Definitivas, telas de cotação, financeiro e relatórios: o que cada
  ícone/botão faz, que modal abre, que endpoint chamaria (pelo bundle, sem disparar).
  — 18/11/2026: `docs/20-legado-inventario-acoes.md` — 81 telas, 549 ações, 150 endpoints (~81 de
  escrita). Novidades: o "×" dos modais das cartas de protesto grava; IRB e comissão emitidos não podem
  ser excluídos; o "Gerar" da provisória só volta; o "Gerar" da Emissão NF usa nome de leitura
  (`obterTodasNf`) para algo que provavelmente grava.

- [x] **58.** **Mapear cálculos, totais e tabelas** de cada tela fora da cotação (já coberta em
  `docs/04-regras-calculo.md`): numerário, intermediação, IRB/RME, NF, rankings, Relatório/Planilha
  de Produção, saldo e percentual de provisórias. Fórmulas conferidas contra valores reais
  exibidos no legado, colunas e ordenação padrão de cada tabela.
  — 18/11/2026: `docs/19` rodada 2 — 324 numerários de exportação e 400 de importação conferidos
  fórmula a fórmula; saldo e % da provisória; distribuição real de status × posição (11.116 linhas);
  IRB/RME, NF e comissões medidos (praticamente sem uso). O que só fecha clicando em ação de escrita
  ou endpoint fora da allowlist foi para a tarefa 72.

- [ ] **59.** **Gerar proposta e certificado** a partir dos Modelos de Proposta já importados
  (`ProposalTemplate`, `.docx` no S3) — merge com os dados do processo, saída em PDF/DOCX.
  — 17/11/2026: módulo `backend/src/documents`. **Proposta .docx**: botão "Proposta" na cotação
  calculada; escolhe a versão vigente de Tipo × Cobertura, faz o merge `[campo]` com a mesma
  sintaxe do legado (os 4 modelos de 2026 conferidos: nenhum marcador sobra) e calcula os seis
  cenários `fobFr*` da estimativa com a regra do motor (impostos entram na I.S. sem prêmio; piso só
  se a cotação aplicou mínimo). Marcador desconhecido não quebra: volta como aviso na tela e fica
  na auditoria (`proposal_generated`). Marcador partido entre runs pelo Word é reconstituído.
  **Certificado** (importação) e **Solicitação de cobertura** (exportação): botão na definitiva
  abre `/print/endorsements/:id`, página de impressão (imprimir / salvar PDF pelo navegador, como
  no legado), com os valores do domínio — corrigidos o ano da provisória, o "FOB+Frete" fixo e o
  BL omitido no marítimo. Helper de **valor por extenso** pronto (`amount-in-words.ts`, testado).
  25 testes. **Falta:** saída em **PDF da proposta** (precisa de conversor DOCX→PDF no servidor —
  LibreOffice na VM ou serviço externo; decidir); **verso do certificado** (texto jurídico de 7
  itens — copiar literal do legado, não redigir); **recibo** (bloqueado pela tarefa 68).

- [x] **60.** **Impressão e Arquivo de Provisórias/Definitivas** (`ImpressaoProvisoria/Definitiva`,
  `ArquivoProvisoria/Definitiva`).
  — 17/11/2026: botão **Impressão e arquivo** em Averbações, com os filtros do legado (provisórias
  ou definitivas, seguradora, faixa de averbação) + ramo e período. **Imprimir relação** abre
  `/print/endorsement-selection` (A4 paisagem, totais por moeda, imprimir/salvar PDF);
  **Gerar arquivo** baixa o CSV de remessa no mesmo layout do lote mensal (montagem extraída para
  `endorsement-csv.ts`, compartilhada). Faixa pela parte numérica ("D-106493" = "106493"),
  canceladas fora, teto de 2.000 linhas. ⚠️ O layout do PDF/CSV do legado vinha pronto do servidor
  e não foi visto; o do CSV segue pendente de validação com as seguradoras (tarefa 28).

- [ ] **61.** **Relatórios**: Relatório de Produção / Planilha Produção e Rankings por Apólice,
  Cliente, Estado e Parceiro, com os mesmos números do legado e exportação para Excel.
  — 17/11/2026: módulo `backend/src/reports` + tela **Financeiro → Relatórios** (`/reports`), com
  abas Produção / Por cliente / Por parceiro / Por apólice / Por estado e exportação `.xlsx`
  (`exceljs`, números como número — o legado mandava texto formatado). Base: definitivas não
  canceladas do período. Fórmulas de `docs/19` em `production-math.ts` com 9 testes (agravo,
  diferença, resultado com o caso real FRESNOMAQ 2720 = 946,58, arredondamento US$ → R$,
  conversão de moeda ≠ USD). Total separado das linhas (no legado era o "último registro").
  **Falta:** tipo *Prorrogada* (depende da 64); **IRB de importação** — o legado cobra US$ 10 por
  processo e o nosso só tem `irbValue` na exportação (entra no bloco IRB/RME, tarefa 63);
  conferir números contra o legado assim que houver definitivas no banco (hoje há zero).

- [ ] **62.** **Emissão de NF e NF's Emitidas** (`Nf`, `NfEmitida`).

- [ ] **63.** **Emissão IRB e RME** (resseguro) — `NumerariosChequeIRB`, `PlanilhaIrb`,
  `IrbEmitida`, `EmissaoRme`.

- [x] **64.** **Definitivas em Prorrogação** (`ProcessosProrrogacoes`) — o legado tem o tipo de
  operação "Prorrogada", sem equivalente no sistema novo.
  — 17/11/2026: model `EndorsementExtension` (várias por definitiva, `PRG-1`, `PRG-2`…, como o
  `nuProrrogacao`), migration `20261117120000_contacts_emails_extensions`. Botão **Prorrogar** no
  drawer da definitiva: data, "cobertura até" opcional, percentual (vazio = Parâmetro
  **Prorrogação**, 20 %, regra conferida em 35 numerários) — cobra o % sobre os prêmios do cliente
  e da seguradora, câmbio do dia. Cancelar exige motivo; ambos auditados. Listagem ganhou o filtro
  **Em prorrogação** e o selo PRG. **Certificado/cobertura da prorrogação** com "PRG-n", prêmio e
  data da prorrogação e o selo vermelho "PRORROGAÇÃO DE SEGURO". **Planilha Produção** ganhou o tipo
  **Prorrogadas** (como o `cdTipo=2`; "Todos" segue só com definitivas): I.S. zerada, sem IRB,
  comissão de parceiro pelo % da cotação. ⚠️ **Premissas a confirmar:** o lado da seguradora usar o
  mesmo % (`vlProrrogadaSeguradoraDolar` não tinha fórmula visível) e a prorrogação não gerar
  comissão nem numerário próprios (o numerário depende da tarefa 68).

- [x] **65.** **Cadastros que faltam tela**: E-mails (destinatários por cobertura) e
  Transportadoras.
  — 17/11/2026: **Transportadoras** em Cadastros → Pessoas, sobre o cadastro único de Empresas
  filtrado pelo papel (como Seguradoras). Novo model `CompanyContact` com a seção **Contatos**
  (nome, setor, telefone, e-mail) no diálogo de qualquer empresa — a aba "Contatos Gerais" do
  legado. **E-mails por cobertura** em Cadastros → Seguro (catálogo genérico, model
  `CoverageEmail`): cobertura vem do cadastro (no legado era texto livre), e-mail validado e
  normalizado, mesmo e-mail pode servir a várias coberturas. Como no legado, nenhuma outra tela
  consome esses e-mails ainda.

- [x] **66.** **Alertas/notificações** (módulo `notifications` de `docs/07-modulos.md`): pendência
  vencendo, provisória sem definitiva, cotação parada, apólice a vencer.
  — 17/11/2026: tela **Pendências** (`/alerts`, primeiro item de Operação, com contador no menu):
  prazos de TFA/averbação vencidos ou vencendo, provisórias sem definitiva, cotações paradas
  (em aberto/aprovadas sem alteração) e apólices a vencer. Calculadas na hora (sem tabela),
  cada grupo respeita a permissão de leitura e o escopo do usuário; cada linha abre o registro
  (a averbação abre direto no drawer). Limites em Parâmetros → **Pendências** (3, 30, 7 e 30 dias).
  Sem e-mail/push por enquanto — depende do SMTP (tarefa 15).

- [ ] **67.** **Decidir com o cliente** as três telas que no legado apontam para `#/emContrucao`:
  Pagamento de Intermediação de Funcionário, Relatório de Saldo de Provisórias e Mapa.

- [ ] **68.** **Rever o significado do Numerário** (achado em 17/11/2026 ao mapear o recibo). No
  legado, numerário é a **cobrança ao cliente/parceiro** do prêmio do cliente em R$ ("Solicitamos
  nos enviar o valor de R$ …"), com taxa do dólar do dia, valor recebido, diferença cambial
  (versão 2+ abate o pagamento anterior), comissão Direta × Nota Fiscal e carta 1/2/3
  (`docs/17` § 2). O pagamento à **seguradora** é outro fluxo (IRB/RME, "A pagar c/ agravo"). O
  nosso `CashRequest` (tarefa 38) foi modelado como *valor devido à seguradora já com agravo*.
  Decidir com o usuário: renomear o atual para "Pagamento à seguradora" e criar o numerário de
  cobrança, ou reaproveitar. Bloqueia o **recibo** (59) e a **carta de numerário**.


- [x] **69.** **Agravo da exportação: 25 %, não 30 %.** Em 324/324 numerários de exportação pagos do
  legado, `vlDolarAPagarAgravo20 = vlDolarAPagar × 0,75`. O cliente tinha informado "0,30" para
  exportação (tarefa 1). Confirmar com o cliente e, se for o caso, trocar o default de
  `insurance.payable_discount_export_percent` (hoje 30) e rodar o ajuste nas cotações salvas. → `docs/19` rodada 2
  — 18/11/2026: default passou a 25 %; a migração `20261118120000_legacy_calc_parity` troca o parâmetro
  (só se ainda estiver em 30) e as cotações de exportação em aberto que congelaram 30 %. A confirmação
  com o cliente foi para a pauta da tarefa 73.

- [x] **70.** **Motor de exportação diverge do legado.** No legado: (a) **I.S. = (custo + frete) ÷
  (1 − taxa)** — prêmio sobre prêmio, 323/324; o nosso soma uma linha "Valor CIF"; (b) o **prêmio
  cobrado no numerário depende do incoterm** (CIF/CIP/DAP/DDP = total; CFR/CPT = custo + frete; EXW/FCA/FOB
  = só custo), enquanto a NF sai com o total; (c) na exportação o **IRB entra** na diferença, no
  resultado e no prêmio líquido. Rever `quote-calculator.ts` com testes contra os casos salvos em
  `backend/prisma/data/mapeamento/num-pagos-exp.json`.
  — 18/11/2026: motor reescrito e conferido centavo a centavo contra o legado — exportação 314/315 e
  importação 385/385 em US$ (I.S., prêmios, a pagar c/ agravo, diferença, comissão e resultado).
  Novo `Quote.premiumCharged` (prêmio cobrado por incoterm) e "Valor CIF" calculado, não mais digitado.
  A conferência revelou mais três erros, também corrigidos: **impostos geram prêmio** (com taxa própria,
  campos novos `taxRateClient`/`taxRateInsurer`), **lucros incidem sobre custo + frete + despesas**, e o
  **arredondamento** do legado é HALF_UP sobre o double exato (`backend/src/common/money.ts`). A
  estimativa da proposta (`fobFr*`) foi corrigida pela mesma regra (385/385). Relatórios e numerário
  usam o mesmo cálculo de agravo. **A migração ainda não foi aplicada no banco** — roda no próximo
  deploy; cotações salvas antes só refletem as regras novas quando forem recalculadas. → `docs/04`, `docs/19`

- [x] **71.** **IRB digitado por processo** também na importação (US$ 0, 10 ou 30 nos dados reais — 30 só
  no marítimo). Hoje só a exportação tem `irbValue`; os relatórios (tarefa 61) dependem disso.
  — 18/11/2026: campo "Valor IRB" / "Moeda IRB" nos dois ramos; o IRB entra no cálculo (convertido para a
  moeda do processo quando vier em outra), no resultado e, na exportação, na diferença. O resumo da
  cotação mostra IRB, prêmio cobrado e resultado do processo.

- [ ] **72.** **Pontos do legado que só fecham com autorização ou com o cliente** (não dá para ler sem
  clicar em ação de escrita ou chamar endpoint fora da allowlist): lista de palavras-chave dos modelos
  (`/cadastro/palavrasChaves`); layout real dos arquivos de remessa e das impressões de provisórias e
  definitivas ("Gerar"/"Imprimir"); detalhe do numerário (abrir dispara `calculaNumerario`), que explica
  as versões 2+ e a diferença cambial; "Gerar" da Emissão NF; Planilha Produção, que volta vazia em
  qualquer filtro. Decidir caso a caso com o usuário.

- [ ] **73.** **Decidir com o cliente o que do legado não portar**, porque os dados mostram que não é
  usado: emissão de IRB/RME (0 emitidos, 7.465 aguardando), comissão "Direta" (0 em 724 numerários),
  posições Valorizado/Desvalorizado/Atrasado/Prorrogado/IRB Emitido/Acerto/Cobrança (0 ocorrências),
  **Definitivas em Prorrogação (0 processos — e a tarefa 64 já implementou)**, baixa de comissão (24
  solicitações desde 2021, nenhuma paga) e fechamento de NF (última visível de 2007).
  Incluir na mesma conversa: **confirmar o agravo de 25 % na exportação** (tarefa 69) e se a taxa
  sobre impostos deve continuar editável por processo.

---

## Concluídas

- [x] **1.** **Confirmar o valor do agravo.** O campo no banco legado se chama `vlDolarAPagarAgravo20`
  (20 %), mas a coluna exibida na *Planilha Produção* é "A Pagar Seguradora **AGRAVO 25%** USD".
  O percentual mudou sem renomear o campo. Definir qual é a regra vigente **antes** de implementar o
  motor de cálculo. → `docs/11-dicionario-dados.md`, `docs/08-fluxos.md` — 03/11/2026, **respondido
  pelo cliente** (aba *Parâmetros* do legado): o agravo é o **desconto que a Cia libera em cima do
  prêmio**, não acréscimo — o sinal estava invertido na nossa implementação. Percentuais:
  **importação 0,25 %**, **importação Fresno 0,25 %**, **exportação 0,30 %** (escala literal,
  confirmada com o usuário — nada a ver com os "20"/"25" do nome do campo e da coluna).
  **Corrigido em 16/11/2026:** a escala estava errada — "0,25" era fator. Em 35 numerários pagos do
  legado, `vlDolarAPagarAgravo20` = `vlDolarAPagar` × 0,75 (desconto de **25 %**). Defaults passaram
  a 25 % / 30 % e a migração `20261116190000_payable_discount_scale` converte parâmetros gravados,
  agravo próprio de clientes e cotações já salvas (numerários emitidos ficam como estão).
  Ver `docs/19-legado-validacoes.md`. Implementado:
  três parâmetros em `SettingsService` (`insurance.payable_discount_*_percent`), motor de cálculo
  com `payableDiscountPercent` abatendo do `insurerPayable`, margem bruta passando a usar o valor
  realmente pago (é a conta de `Dif USD` / `% de Rentabilidade` da Planilha Produção), numerário
  descontando em vez de acrescer, e o percentual congelado na cotação (`payableDiscountPercent`,
  `payableDiscount`, `insurerPayable` em `quotes`) para não mudar retroativamente quando o parâmetro
  for alterado. Falta só o critério do Fresno → tarefa 53.

- [x] **8.** Criar o database `seguros` no Postgres (mesmo servidor do projeto `signa`) e apontar a aplicação para ele. — criado em `34.39.185.114:5432/seguros` (PostgreSQL 18.4, SSL obrigatório).

- [x] **9.** Scaffold do backend: NestJS + Prisma + TypeScript, no padrão dos demais projetos `dev/wake`. — roda em `localhost:3010` (a 3000 já é usada por outro projeto).

- [x] **10.** Scaffold do frontend: Vite + React + TS + Tailwind + shadcn/ui + React Query + React Router + Zustand. — roda em `localhost:5173`, com proxy `/api` para a porta 3010.

- [x] **11.** Definir o design system do projeto (tokens de cor, tipografia, componentes base) a partir de `docs/06-identidade-visual.md`. — tokens em `frontend/src/index.css`, tipografia Inter 14px base, componentes `Button`, `Input`, `Field`, `Badge`, `Select`, `Dialog`, `Page`, estados de lista.

- [x] **12.** Modelagem Prisma do módulo `auth`: `User`, `Role`, `Permission`, `RolePermission`, `RefreshToken`, `PasswordReset`, `AuditLog`. Migração `init_auth` aplicada; seed com 50 permissões e 5 papéis (Administrador, Operador de Seguros, Financeiro, Comercial, Consulta).

- [x] **13.** Telas de acesso: **login**, **esqueci minha senha**, **redefinir senha** e **primeiro acesso / definir senha**. O legado só tem "Zerar Senha" acionado pelo admin. — fluxo validado ponta a ponta no navegador: convite → definição de senha → login.

- [x] **14.** Tela de **gestão de usuários e permissões** (RBAC real: papéis × permissões por recurso e ação, escopo de dados). Substitui a tela de Usuários do legado, que só tem CNPJ + um flag. — validado: usuário com papel *Consulta* não vê o menu de Administração e é barrado ao acessar `/usuarios` direto pela URL.

- [x] **16.** Tela **Minha conta**: alterar a própria senha e ver as sessões ativas. — inclui novos endpoints `GET /auth/sessions`, `DELETE /auth/sessions/:id` e `POST /auth/sessions/revoke-others`; a sessão atual é identificada e não pode ser encerrada por engano; o user-agent é traduzido para "Chrome · macOS".

- [x] **17.** Tela de **auditoria** (`audit:list`). — expõe `GET /audit` e `GET /audit/facets`; filtros por ação e por registro afetado, com rótulos em português para as 38 ações; cada entrada abre o diff antes/depois.

- [x] **18.** Criar papel personalizado pela interface. — diálogo com as 48 permissões agrupadas por módulo e atalho "marcar todas" por grupo; exclusão disponível apenas para papéis não-sistema e sem usuários vinculados. Validado criando e excluindo o papel "Sinistro".

- [x] **19.** Módulo `catalog`: países, estados, cidades, portos/aeroportos, moedas, embalagens, navios e tipos de mercadoria. Inclui a higienização dos dados sujos do legado. — CRUD genérico dirigido por metadados (uma implementação para as 8 tabelas). Seed com 66 países ISO, 27 UFs, 44 portos/aeroportos com UN-LOCODE e IATA, 12 moedas, 47 embalagens, 10 tipos de mercadoria. Sem as duplicatas e entradas-lixo do legado.

- [x] **20.** Módulo `fx`: ingestão automática da PTAX do Banco Central, substituindo o lançamento manual diário da cotação. — importação validada contra a API real do BCB: 1.120 cotações de 10 moedas em um comando. Inclui lançamento manual (auditado) e fallback para o último dia útil quando não há cotação na data. **Ver tarefa 48** — a fórmula da taxa oficial da corretora (abertura + 6%) já foi confirmada. — 16/09/2026: adicionado agendamento diário (`@nestjs/schedule`), roda às 14h (horário de Brasília) em dias úteis e reimporta os últimos 5 dias para se autocurar de feriados ou quedas do servidor; API do BCB é gratuita e não exige chave. Cada execução (manual ou automática) fica registrada na auditoria.

- [x] **23.** Módulo `partners`: empresas com **papéis múltiplos** (cliente, parceiro, seguradora, transportadora, vistoriador) em um cadastro só, e funcionários com vínculo opcional a usuário. Resolve a duplicação do legado, onde a Fidcargo existia duas vezes. —
  18/09/2026: importados **275 parceiros reais** do legado (`#/ParceirosSelecao/Menu`, 287 no
  cadastro original) via `backend/prisma/import-legacy-parceiros.ts` — extração feita navegando de
  verdade na tela autenticada (nunca chamada direta ao legado, ver CLAUDE.md), dado bruto salvo fora
  do git (`.gitignore`). Script valida CNPJ/CPF por **dígito verificador real** (não só contagem de
  dígitos) — pegou 12 lançamentos de teste do legado com CNPJ placeholder (`"1111111111"`, `"456"`,
  nomes de pessoa física, incluindo a própria funcionária da Pinho "Bruna Pietra Appi") que ficaram
  de fora; 4 empresas reais com CNPJ ausente/mal digitado no legado ("Savino Del Bene", "Masterport"
  etc.) foram importadas mesmo assim, sem CNPJ, pra completar depois. Portos/aeroportos do legado
  (1.014, sem código, com duplicatas) ficaram de fora por decisão consciente — mantido o catálogo
  curado de ~44 já existente.

- [x] **24.** Módulo `policies`: apólices e coberturas. Taxa base (cliente e seguradora) e prêmio mínimo viraram **campos estruturados** — no legado a taxa ficava no texto do nome da apólice ("AKAD - 0.10% - PROBEXA") e o prêmio mínimo não aparecia em tela nenhuma.

- [x] **25.** Tela **Cadastros** centralizada: 12 cadastros sob um único item de menu, agrupados por contexto (Pessoas, Seguro, Câmbio, Localização, Carga, Financeiro). Substitui os 20 itens soltos na sidebar do legado, que usavam três padrões visuais diferentes.

- [x] **26.** Módulo `quotes`: motor de cálculo e telas de cotação (importação e exportação). — motor isolado com **18 testes** validando contra os processos reais 2085 e 2084 do legado; formulário em 5 etapas com **recálculo reativo** e resumo fixo; autocomplete no lugar do "código + lupa"; aprovação/reprovação/cancelamento com trava de status.

- [x] **27.** **Taxa por cliente.** — `ClientRate` com escopo opcional e cumulativo (ramo, apólice, cobertura, tipo de mercadoria, modal) e vigência; a regra mais específica vence, empate resolvido pela vigência mais recente. Precedência validada na API: apólice 0,25% → taxa geral do cliente 0,18% → taxa aérea 0,42% → digitada 0,90%. **12 testes** cobrindo especificidade, escopo, vigência e desempate.

- [x] **28.** **Averbação mensal em lote.** — `EndorsementBatch` por competência × seguradora, com prévia do que ainda não entrou em lote, fechamento que congela itens e totais, e exportação CSV (separador `;` + BOM, abre direto no Excel pt-BR). ⚠️ **O layout do arquivo é uma proposta** — precisa ser validado com cada seguradora.

- [x] **29.** **Integração com o SIGRA** (agenciamento, importação e exportação). Puxar a documentação
  que hoje chega por e-mail. Descobrir se há API, banco ou exportação de arquivo. — confirmado: é um
  banco de dados (`sigraweb`, PostgreSQL, ver `docs/SIGRA_DB.md`), exige TLS mútuo com os certificados
  de `backend/certs/sigra/`. Acesso validado (senha corrigida, hostname verification contornado). Sem
  API nem exportação de arquivo envolvidas — a integração será direto no banco. Próximo passo depende
  da tarefa 46.

- [x] **30.** **Referências externas por processo.** — tabela `ExternalReference` com origem (Pinho, SIGRA, cliente, parceiro, seguradora, outra); um processo carrega quantas precisar e `GET /quotes/by-reference` localiza o processo por qualquer uma delas.

- [x] **31.** **Comunicação dentro da plataforma.** Hoje tudo passa por e-mail. Timeline de mensagens e anexos por processo, substituindo a caixa de entrada como sistema de registro. — módulo `communications`: timeline por processo com anexos persistidos (`Attachment`/`Message`), envio via Gmail OAuth por operador (`GmailAccount`), editor de texto rico com Tiptap. Inspirado na composição de e-mail do projeto WBX (aba "Resumo"), mas com anexos persistidos e log gravado no mesmo fluxo do envio — no WBX o log era gravado pelo cliente após o envio e podia se perder. ⚠️ **Exige configurar `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_OAUTH_REDIRECT_URI`** (Google Cloud Console, credencial OAuth "Aplicativo Web", escopo `gmail.send`) para o botão "Conectar Gmail" funcionar. Templates de assunto/corpo por tipo de e-mail (equivalente aos ~18 do WBX) ficaram fora do escopo — a composição hoje é livre.

- [x] **32.** **Extrato mensal** com o acréscimo aplicado. — agrupado por cliente, com colunas separadas para *prêmio original*, *acréscimo* e *total a enviar*, mais um aviso no topo. O percentual vem dos Parâmetros. ~~Segue valendo confirmar se é o mesmo agravo da tarefa 1.~~ **Não é** (03/11/2026): o agravo é desconto da seguradora, este é acréscimo cobrado do cliente — parâmetros separados (`finance.surcharge_percent`). O **percentual deste acréscimo segue sem confirmação** (25 % por default).

- [x] **33.** **Extrato de comissão** consolidado por período e por parceiro/vendedor. — visão "Extrato" agrupa por favorecido com total, pago e em aberto; a visão "Lançamentos" permite selecionar, solicitar NF e registrar pagamento em lote.

- [x] **34.** **Trava de atracação.** "Só pode fazer a averbação quando a carga está atracada." — a definitiva exige data de atracação e recusa data futura; validado que ambos os casos são barrados.

- [x] **35.** **Prazos de TFA e de averbação.** — calculados a partir da **data de atracação**, com os dias configuráveis em Parâmetros (15 e 15 por padrão). A listagem marca o que venceu e o resumo conta as averbações com TFA vencido. O segundo prazo nasceu como "prazo de liberação" (10 dias) e foi renomeado na tarefa 52.

- [x] **37.** Módulo `endorsements`: provisória abre saldo, definitivas consomem proporcionalmente. Numeração `P-####`, `D-######` (importação) e `E-#####` (exportação), como no legado. Cancelar uma definitiva devolve o valor ao saldo. Histórico de posição auditado — o legado trocava a posição sem deixar rastro.

- [x] **38.** Módulo `finance` — **numerário**: fluxo *Falta enviar → Enviado → Recebido*, com agravo parametrizado sobre o valor devido à seguradora, envio em lote e baixa com valor recebido ajustável.

- [x] **39.** Módulo `finance` — **comissões**: geradas automaticamente na emissão da definitiva, rateando o prêmio entre parceiro, corretora e vendedor pelos percentuais da cotação.

- [x] **40.** Tela de **Parâmetros**: valores de negócio que ainda dependem de confirmação do cliente (acréscimo, prazo de TFA, prazo para averbação) editáveis sem deploy, com auditoria da alteração.

- [x] **46.** Aguardar o cliente enviar um documento listando as tabelas/colunas do SIGRA realmente
  necessárias para o projeto de seguros. O schema `pinho` tem 410 tabelas com muitas colunas cada —
  evitar clonar tudo, só trazer o que for confirmado como útil (processo, datas, valores, itens, etc.).
  Bloqueia as tarefas 42 e 43. — a cliente (Lohana) respondeu do lado de negócio, não do lado técnico:
  os **documentos padrão** exigidos em toda averbação são BL/AWB, Invoice, Packing List, CE Mercante,
  CCT (aéreo) e TFA (Termo de Faltas e Avarias). Exemplos reais em `docs/examples/`, referentes ao
  processo SIGRA **1901475** (PO 260098, Multi Mercantes). Isso não é uma lista de colunas do SIGRA,
  mas define o que precisamos rastrear — próximo passo é a tarefa 47.

- [x] **47.** **Confirmar no banco do SIGRA quais campos dos documentos padrão já são dados estruturados
  e quais são só PDFs de terceiros.** Usar os processos **1901475** (sem impostos) e **1898813** (com
  impostos, cliente Farm Direct Food) como casos reais (`SELECT * FROM pinho.imp_processo WHERE id IN
  (1901475, 1898813)`) e checar se existe tabela de anexo/documento/conhecimento no schema `pinho`.
  Incluir a **taxa cambial do processo** (a que aparece na tela de Valores — `Taxa USD: 5,12530` no
  exemplo 1898813) na checagem, é o dado que a tarefa 49 precisa. Hipótese a validar: BL, Invoice,
  Packing List, CE Mercante e TFA são emitidos por terceiros (armador, fornecedor, Receita/Marinha
  Mercante, terminal) e **não estão no SIGRA como arquivo** — só as datas/valores equivalentes
  (`dt_embarque`, `dt_presenca_carga`, `vl_frete`, taxa cambial, etc.). Se confirmado, os PDFs
  continuam entrando pelo módulo `communications` (tarefa 31) e só os campos estruturados vêm do SIGRA.
  Bloqueia as tarefas 43 e 49. — 17/09/2026: primeira rodada de queries rodada pelo usuário (nunca
  direto pelo Claude, ver `CLAUDE.md`) confirmou a maioria dos campos de BL, invoice, valores e **a
  taxa cambial do processo** (`vl_taxa_dolar`) direto em `pinho.imp_processo`/`imp_adicao`/
  `imp_adicao_item` — ver `docs/13-sigra-campos-necessarios.md`. A **hipótese foi refutada**: existem
  dezenas de tabelas satélite (`imp_processo_bl`, `imp_processo_container`, `ce_mercante_*`,
  `ce_manifesto_*`, `op_processo_documento`, `sis_arquivo`) ainda não conferidas. Segunda rodada
  (mesmo dia) levantou a estrutura completa dessas tabelas — quase todo campo que faltava já tem
  coluna candidata identificada, incluindo indício de que o PDF pode estar acessível via
  `sis_arquivo.url`. Falta a **terceira rodada** (queries de linha já escritas em
  `docs/13-sigra-campos-necessarios.md § Status e próximos passos`) para confirmar contra os
  processos 1901475/1898813 e então fechar a tarefa. — 18/09/2026: rodada 3 **parcial** — via
  `npm run sigra:test -- <id>` (script novo em `backend/src/scripts/`, usa o `SigraProcessService`
  da tarefa 44) o usuário confirmou por linha `pinho.imp_processo`/`processo`/`imp_adicao`/
  `imp_adicao_item` contra os dois processos reais — todos os valores batem exatos com o que a
  rodada 1 já tinha confirmado manualmente. Confirmado também `imp_processo_container`: `numero`
  ok, mas `tamanho` voltou `0` (suspeito — pode ser FK de catálogo, não usar sem confirmar) e
  1901475 não tem nenhuma linha (carga solta). Ainda faltam `imp_processo_bl*`, `imp_fatura*`,
  `ce_mercante_*`/`ce_manifesto_*` e a cadeia de documento/arquivo — tarefa segue aberta. —
  18/09/2026 (2): rodada 3 continuou. `imp_fatura`/`imp_fatura_item` **confirmados** por linha
  (cabeçalho e itens da Invoice, com alíquotas de II/IPI/PIS/COFINS por item — dado que
  `imp_adicao_item` não tinha). `imp_processo_bl` pelo mesmo `id` do processo veio **vazio** —
  hipótese de vínculo refutada, chave real ainda desconhecida (bloqueia `imp_processo_bl_container`/
  `_taxas`). **Achado importante**: a cadeia `op_processo_documento`→`op_documento`→`sis_arquivo`
  retornou dados reais nos dois processos, com PDF acessível por `sis_arquivo.url` — isso **refuta
  de vez** a hipótese original da tarefa: BL, Fatura, Packing List e o comprovante de presença de
  carga (TFA) **existem como arquivo dentro do SIGRA**, não só como dado equivalente. `ce_mercante`
  e toda a família, e `imp_adicao_documento_vinculado`, vieram vazios para os dois processos —
  ainda não sabemos se é ausência de dado ou falha de tipo no join; há query de diagnóstico pronta
  em `docs/13-sigra-campos-necessarios.md § Status e próximos passos`. Falta: descobrir a chave real
  do BL, rodar o diagnóstico do CE Mercante, e então fechar a tarefa. — 18/09/2026 (3), **tarefa
  fechada**: diagnóstico final rodado pelo usuário. `imp_processo_bl` buscado pelo número do BL
  (`doc_carga`, não mais pelo `id`) também veio **vazio** — confirmado que a tabela simplesmente não
  tem linha para estes dois processos (não é problema de chave, é ausência de dado). O mesmo para
  `ce_mercante`: `imp_processo.ce_mercante` está preenchido nos dois processos
  (`162605269687586`/`162605271802400`), mas buscar esse número em `ce_mercante.numero` (já com
  `::text` para descartar erro de tipo) veio vazio — a tabela não foi populada para esses números
  (provável dependência de consulta manual à Marinha Mercante feita no sistema, que não ocorreu
  aqui). **Conclusão**: `imp_processo_bl` e `ce_mercante` existem e têm estrutura rica, mas **não são
  confiáveis como fonte garantida** de detalhe estruturado (navio, portos, cubagem, situação do CE) —
  não usar como dependência dura na tarefa 44. O que é garantido para qualquer processo: os campos
  essenciais em `imp_processo`/`imp_adicao`/`imp_adicao_item`/`imp_fatura`/`imp_fatura_item`, e —
  achado principal da rodada 3 — **os PDFs dos documentos em si** (BL, Invoice, Packing List, TFA,
  DI/DUIMP, NFe) acessíveis via `op_processo_documento`→`op_documento`→`sis_arquivo.url`. Mapeamento
  final consolidado em `docs/13-sigra-campos-necessarios.md`. Desbloqueia a tarefa 43.

- [x] **48.** **Adotar a fórmula confirmada da taxa de câmbio oficial da corretora no módulo `fx`**
  (tarefa 20): **taxa de abertura (PTAX) + 6%**, para 5 moedas — Dólar, Euro, Franco Suíço, Iene e Libra
  Esterlina — atualizada manualmente todo dia quando abre o câmbio. Resolve a dúvida da extinta tarefa
  21 (diferença sistemática de ~+6% observada entre a PTAX pura e o legado). Hoje o módulo `fx` só
  importa a PTAX pura da API do BCB — falta oferecer essa taxa com markup como a **taxa oficial**,
  mantendo a PTAX pura como fonte auxiliar/comparação. — cada importação da PTAX passou a gravar
  também um registro `OFICIAL` (PTAX × 1,06) para essas 5 moedas, mantendo o `PTAX` puro ao lado para
  comparação; `rateFor` (usado no cálculo de cotações, endossos e financeiro) passa a priorizar
  `MANUAL` > `OFICIAL` > `PTAX`. Migration `exchange_rate_source_key` ajusta a chave única para
  `date+currencyId+source`; histórico existente das 5 moedas recalculado via backfill. Tela de
  Cotações diárias mostra os badges "PTAX pura · BCB" e "Oficial · PTAX +6%" lado a lado.

- [x] **52.** **Renomear "Prazo para Liberação" para "Prazo para Averbação".** Regra confirmada pelo
  cliente (03/11/2026): a **notificação à Cia (seguradora) precisa ocorrer em até 15 dias da
  chegada/atracação** da carga. Parâmetro `deadline.release_days` → `deadline.endorsement_days`,
  default de 10 → 15 dias; no cálculo das averbações `releaseDueDate` → `endorsementDueDate` e
  `overdue.release` → `overdue.endorsement`; migration só de dados
  (`20261103120000_rename_release_deadline_setting`) renomeia a chave já gravada para não perder o
  valor de produção. — 03/11/2026 (2): o `settings.service.ts` ainda estava com a chave antiga e o
  default 10; **corrigido para `deadline.endorsement_days` = 15 dias**, com a descrição citando a
  regra confirmada. E os prazos, que o backend calculava sem ninguém exibir, **passaram a aparecer
  na interface**: coluna "Prazos" na listagem de averbações (TFA e Averb., em vermelho quando
  vencidos), linhas correspondentes no drawer e um cartão "com prazo de TFA vencido" no resumo — o
  `overdueTfa` já vinha do backend e o frontend nem lia. **Pendente de confirmação:** com 15 dias
  esse prazo ficou idêntico ao `deadline.tfa_days` (também 15 dias da atracação) — pode ser que a
  anotação original "TFA atracações em até 15 dias" já fosse este mesmo prazo e os dois parâmetros
  devam virar um só.
