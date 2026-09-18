# Tarefas

`**************------` **70%**

**Total:** 46  ·  **Pendentes:** 14  ·  **Feitas (aguardando fechamento):** 4  ·  **Concluídas:** 28

---

## Pendentes

### Decisões pendentes com o cliente

- [ ] **1.** **Confirmar o valor do agravo.** O campo no banco legado se chama `vlDolarAPagarAgravo20`
  (20 %), mas a coluna exibida na *Planilha Produção* é "A Pagar Seguradora **AGRAVO 25%** USD".
  O percentual mudou sem renomear o campo. Definir qual é a regra vigente **antes** de implementar o
  motor de cálculo. → `docs/11-dicionario-dados.md`, `docs/08-fluxos.md`

- [ ] **3.** Confirmar se as regras **`fl*NaoCliente`** ainda são usadas (verba que entra na base da
  seguradora mas não é repassada ao cliente). Existem no modelo legado, mas não aparecem em nenhuma
  tela. → `docs/11-dicionario-dados.md`

- [ ] **4.** Confirmar a regra de **retenção de IRRF** com faturamento mínimo acumulado
  (`vlFatMinimoRetencaoIrrf`, `vlFatAcumuladoRetencao`, `pcIrrfRetencao`) — existe no modelo, sem tela.

- [ ] **5.** Definir escopo de **Sinistros** e **Cartas de Protesto**. Têm endpoints e telas completas
  no legado, mas estão fora do menu. Aparentam ser relevantes para o negócio.

- [ ] **7.** Obter o **prêmio mínimo por apólice**. O cálculo o aplica (conferido: 20,41 → 30,00), mas
  o campo não aparece na tela de Apólices. Descobrir onde está configurado hoje.

- [x] **46.** Aguardar o cliente enviar um documento listando as tabelas/colunas do SIGRA realmente
  necessárias para o projeto de seguros. O schema `pinho` tem 410 tabelas com muitas colunas cada —
  evitar clonar tudo, só trazer o que for confirmado como útil (processo, datas, valores, itens, etc.).
  Bloqueia as tarefas 42 e 43. — a cliente (Lohana) respondeu do lado de negócio, não do lado técnico:
  os **documentos padrão** exigidos em toda averbação são BL/AWB, Invoice, Packing List, CE Mercante,
  CCT (aéreo) e TFA (Termo de Faltas e Avarias). Exemplos reais em `docs/examples/`, referentes ao
  processo SIGRA **1901475** (PO 260098, Multi Mercantes). Isso não é uma lista de colunas do SIGRA,
  mas define o que precisamos rastrear — próximo passo é a tarefa 47.

- [ ] **49.** **Exceção de taxa de câmbio na fatura de cobrança.** Para o cliente Farm Direct Food
  (processo SIGRA 1898813, averbação P1954/D106647) **não** se usa a taxa de abertura + 6% do dia —
  usa-se a taxa cambial do próprio processo de importação (a do DI/DUIMP no SIGRA, no exemplo enviado:
  `5,1253`). Falta confirmar com o cliente: essa exceção é **por cliente específico** ou vale para
  **todo processo com impostos (DI)** — o outro exemplo (processo 1901475) foi descrito como "cliente
  sem impostos" e não teve essa ressalva. Sem essa resposta não dá pra saber se é uma flag no cadastro
  do parceiro (`partners`) ou uma regra automática por tipo de processo.

### Da reunião com o cliente → `docs/12-reuniao-cliente.md`

- [x] **29.** **Integração com o SIGRA** (agenciamento, importação e exportação). Puxar a documentação
  que hoje chega por e-mail. Descobrir se há API, banco ou exportação de arquivo. — confirmado: é um
  banco de dados (`sigraweb`, PostgreSQL, ver `docs/SIGRA_DB.md`), exige TLS mútuo com os certificados
  de `backend/certs/sigra/`. Acesso validado (senha corrigida, hostname verification contornado). Sem
  API nem exportação de arquivo envolvidas — a integração será direto no banco. Próximo passo depende
  da tarefa 46.

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

- [ ] **43.** **Mapear o banco do SIGRA e identificar quais dados são úteis para este projeto.**
  Depende da tarefa 47 — só depois de saber quais campos dos documentos padrão (BL, Invoice, Packing
  List, CE Mercante, CCT, TFA) existem como coluna em `pinho.imp_processo` (ou tabela satélite) dá para
  fechar esse mapeamento e complementar `docs/SIGRA_DB.md`.

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

- [ ] **45.** **Subir o projeto na VM e colocar para rodar em produção.**

- [ ] **50.** **Testar contra mais processos reais as tabelas do SIGRA que vieram vazias só pros
  dois exemplos (1901475/1898813).** Pode ser que essas tabelas simplesmente não sejam preenchidas
  pra todo processo (padrão já visto), ou pode ser que os dois exemplos escolhidos sejam atípicos
  (ambos sem CE Mercante consultado, sem BL detalhado, sem câmbio contratado). Tabelas/queries a
  repetir com outros IDs de processo: `imp_processo_bl` (+ `_container`/`_taxas`), `ce_mercante`
  (+ família `ce_mercante_*`/`ce_manifesto_*`), `imp_processo_cambio`, `coda_imp_fatura`,
  `coda_imp_processo_bl`, `trk_embarque` (por `numero_conhecimento`), `imp_processo_acrescimo`/
  `imp_processo_deducao`. Ver queries prontas em `docs/14-sigra-tabelas.md` e
  `docs/13-sigra-campos-necessarios.md`. Escolher processos variados (marítimo FCL, aéreo, com e
  sem impostos) pra não repetir o viés dos dois exemplos atuais.

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

---

---

## Concluídas

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
- [x] **30.** **Referências externas por processo.** — tabela `ExternalReference` com origem (Pinho, SIGRA, cliente, parceiro, seguradora, outra); um processo carrega quantas precisar e `GET /quotes/by-reference` localiza o processo por qualquer uma delas.
- [x] **31.** **Comunicação dentro da plataforma.** Hoje tudo passa por e-mail. Timeline de mensagens e anexos por processo, substituindo a caixa de entrada como sistema de registro. — módulo `communications`: timeline por processo com anexos persistidos (`Attachment`/`Message`), envio via Gmail OAuth por operador (`GmailAccount`), editor de texto rico com Tiptap. Inspirado na composição de e-mail do projeto WBX (aba "Resumo"), mas com anexos persistidos e log gravado no mesmo fluxo do envio — no WBX o log era gravado pelo cliente após o envio e podia se perder. ⚠️ **Exige configurar `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_OAUTH_REDIRECT_URI`** (Google Cloud Console, credencial OAuth "Aplicativo Web", escopo `gmail.send`) para o botão "Conectar Gmail" funcionar. Templates de assunto/corpo por tipo de e-mail (equivalente aos ~18 do WBX) ficaram fora do escopo — a composição hoje é livre.
- [x] **32.** **Extrato mensal** com o acréscimo aplicado. — agrupado por cliente, com colunas separadas para *prêmio original*, *acréscimo* e *total a enviar*, mais um aviso no topo. O percentual vem dos Parâmetros. **Segue valendo confirmar se é o mesmo agravo da tarefa 1.**
- [x] **33.** **Extrato de comissão** consolidado por período e por parceiro/vendedor. — visão "Extrato" agrupa por favorecido com total, pago e em aberto; a visão "Lançamentos" permite selecionar, solicitar NF e registrar pagamento em lote.
- [x] **34.** **Trava de atracação.** "Só pode fazer a averbação quando a carga está atracada." — a definitiva exige data de atracação e recusa data futura; validado que ambos os casos são barrados.
- [x] **35.** **Prazos de TFA e liberação.** — calculados a partir da **data de atracação** (leitura minha das anotações, a confirmar), com os dias configuráveis em Parâmetros (15 e 10 por padrão). A listagem marca o que venceu e o resumo conta as averbações com TFA vencido.
- [x] **37.** Módulo `endorsements`: provisória abre saldo, definitivas consomem proporcionalmente. Numeração `P-####`, `D-######` (importação) e `E-#####` (exportação), como no legado. Cancelar uma definitiva devolve o valor ao saldo. Histórico de posição auditado — o legado trocava a posição sem deixar rastro.
- [x] **38.** Módulo `finance` — **numerário**: fluxo *Falta enviar → Enviado → Recebido*, com agravo parametrizado sobre o valor devido à seguradora, envio em lote e baixa com valor recebido ajustável.
- [x] **39.** Módulo `finance` — **comissões**: geradas automaticamente na emissão da definitiva, rateando o prêmio entre parceiro, corretora e vendedor pelos percentuais da cotação.
- [x] **40.** Tela de **Parâmetros**: valores de negócio que ainda dependem de confirmação do cliente (acréscimo, prazo de TFA, prazo de liberação) editáveis sem deploy, com auditoria da alteração.
