# Tarefas

`**************------` **70%**

**Total:** 40  ·  **Pendentes:** 12  ·  **Feitas (aguardando fechamento):** 1  ·  **Concluídas:** 27

---

## Pendentes

### Decisões pendentes com o cliente

- [ ] **1.** **Confirmar o valor do agravo.** O campo no banco legado se chama `vlDolarAPagarAgravo20`
  (20 %), mas a coluna exibida na *Planilha Produção* é "A Pagar Seguradora **AGRAVO 25%** USD".
  O percentual mudou sem renomear o campo. Definir qual é a regra vigente **antes** de implementar o
  motor de cálculo. → `docs/11-dicionario-dados.md`, `docs/08-fluxos.md`

- [ ] **2.** Definir se haverá **portal externo** para cliente e parceiro. Hoje eles não acessam o
  sistema — tudo passa pela Pinho. A resposta muda a modelagem de `auth` (escopo de dados por
  tenant desde o início) e o desenho das telas de acesso. → `docs/07-modulos.md`

- [ ] **3.** Confirmar se as regras **`fl*NaoCliente`** ainda são usadas (verba que entra na base da
  seguradora mas não é repassada ao cliente). Existem no modelo legado, mas não aparecem em nenhuma
  tela. → `docs/11-dicionario-dados.md`

- [ ] **4.** Confirmar a regra de **retenção de IRRF** com faturamento mínimo acumulado
  (`vlFatMinimoRetencaoIrrf`, `vlFatAcumuladoRetencao`, `pcIrrfRetencao`) — existe no modelo, sem tela.

- [ ] **5.** Definir escopo de **Sinistros** e **Cartas de Protesto**. Têm endpoints e telas completas
  no legado, mas estão fora do menu. Aparentam ser relevantes para o negócio.

- [ ] **6.** Verificar com a Infoline se a rota **`ComandosSqlSelecaoComponent`** (console de SQL
  arbitrário) está ativa em produção. Risco de segurança. Não replicar no sistema novo.

- [ ] **7.** Obter o **prêmio mínimo por apólice**. O cálculo o aplica (conferido: 20,41 → 30,00), mas
  o campo não aparece na tela de Apólices. Descobrir onde está configurado hoje.

### Da reunião com o cliente → `docs/12-reuniao-cliente.md`

- [ ] **29.** **Integração com o SIGRA** (agenciamento, importação e exportação). Puxar a documentação
  que hoje chega por e-mail. Descobrir se há API, banco ou exportação de arquivo.

- [ ] **31.** **Comunicação dentro da plataforma.** Hoje tudo passa por e-mail. Timeline de mensagens
  e anexos por processo, substituindo a caixa de entrada como sistema de registro.

### Próximos passos

- [ ] **36.** Persistir o **prêmio mínimo** na cotação. Hoje ele vem da apólice; se o operador digitar
  um valor sem selecionar apólice, o processo salva com o piso aplicado mas ao reabrir recalcula sem
  ele (divergência observada: salvo 30,00, reaberto 20,41).

- [ ] **15.** Configurar SMTP no `backend/.env`. Hoje os e-mails de convite e recuperação são apenas
  escritos no log do servidor.

- [ ] **21.** **Definir a fonte oficial do câmbio.** A PTAX do Banco Central foi importada e comparada
  com os valores que estão hoje no legado: a diferença é **sistemática, de +6,0% a +6,4%** em todos os
  dias conferidos (13/08/2026: PTAX 5,1859 × legado 5,4944). Não é erro de digitação — é outra fonte.
  Hipóteses: taxa fiscal da Receita, dólar comercial de venda com spread, ou markup próprio da corretora.
  Confirmar com o cliente antes de trocar a origem do dado. A coluna `source` já distingue
  `PTAX` de `MANUAL`, então dá para conviver com as duas.

- [ ] **22.** Investigar por que o **CNY (yuan)** não retorna cotação na API do BCB — as outras 10 moedas
  importaram normalmente.

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
- [x] **20.** Módulo `fx`: ingestão automática da PTAX do Banco Central, substituindo o lançamento manual diário da cotação. — importação validada contra a API real do BCB: 1.120 cotações de 10 moedas em um comando. Inclui lançamento manual (auditado) e fallback para o último dia útil quando não há cotação na data. **Ver tarefa 21 antes de adotar como fonte oficial.** — 16/09/2026: adicionado agendamento diário (`@nestjs/schedule`), roda às 14h (horário de Brasília) em dias úteis e reimporta os últimos 5 dias para se autocurar de feriados ou quedas do servidor; API do BCB é gratuita e não exige chave. Cada execução (manual ou automática) fica registrada na auditoria.
- [x] **23.** Módulo `partners`: empresas com **papéis múltiplos** (cliente, parceiro, seguradora, transportadora, vistoriador) em um cadastro só, e funcionários com vínculo opcional a usuário. Resolve a duplicação do legado, onde a Fidcargo existia duas vezes.
- [x] **24.** Módulo `policies`: apólices e coberturas. Taxa base (cliente e seguradora) e prêmio mínimo viraram **campos estruturados** — no legado a taxa ficava no texto do nome da apólice ("AKAD - 0.10% - PROBEXA") e o prêmio mínimo não aparecia em tela nenhuma.
- [x] **25.** Tela **Cadastros** centralizada: 12 cadastros sob um único item de menu, agrupados por contexto (Pessoas, Seguro, Câmbio, Localização, Carga, Financeiro). Substitui os 20 itens soltos na sidebar do legado, que usavam três padrões visuais diferentes.
- [x] **26.** Módulo `quotes`: motor de cálculo e telas de cotação (importação e exportação). — motor isolado com **18 testes** validando contra os processos reais 2085 e 2084 do legado; formulário em 5 etapas com **recálculo reativo** e resumo fixo; autocomplete no lugar do "código + lupa"; aprovação/reprovação/cancelamento com trava de status.
- [x] **27.** **Taxa por cliente.** — `ClientRate` com escopo opcional e cumulativo (ramo, apólice, cobertura, tipo de mercadoria, modal) e vigência; a regra mais específica vence, empate resolvido pela vigência mais recente. Precedência validada na API: apólice 0,25% → taxa geral do cliente 0,18% → taxa aérea 0,42% → digitada 0,90%. **12 testes** cobrindo especificidade, escopo, vigência e desempate.
- [x] **28.** **Averbação mensal em lote.** — `EndorsementBatch` por competência × seguradora, com prévia do que ainda não entrou em lote, fechamento que congela itens e totais, e exportação CSV (separador `;` + BOM, abre direto no Excel pt-BR). ⚠️ **O layout do arquivo é uma proposta** — precisa ser validado com cada seguradora.
- [x] **30.** **Referências externas por processo.** — tabela `ExternalReference` com origem (Pinho, SIGRA, cliente, parceiro, seguradora, outra); um processo carrega quantas precisar e `GET /quotes/by-reference` localiza o processo por qualquer uma delas.
- [x] **32.** **Extrato mensal** com o acréscimo aplicado. — agrupado por cliente, com colunas separadas para *prêmio original*, *acréscimo* e *total a enviar*, mais um aviso no topo. O percentual vem dos Parâmetros. **Segue valendo confirmar se é o mesmo agravo da tarefa 1.**
- [x] **33.** **Extrato de comissão** consolidado por período e por parceiro/vendedor. — visão "Extrato" agrupa por favorecido com total, pago e em aberto; a visão "Lançamentos" permite selecionar, solicitar NF e registrar pagamento em lote.
- [x] **34.** **Trava de atracação.** "Só pode fazer a averbação quando a carga está atracada." — a definitiva exige data de atracação e recusa data futura; validado que ambos os casos são barrados.
- [x] **35.** **Prazos de TFA e liberação.** — calculados a partir da **data de atracação** (leitura minha das anotações, a confirmar), com os dias configuráveis em Parâmetros (15 e 10 por padrão). A listagem marca o que venceu e o resumo conta as averbações com TFA vencido.
- [x] **37.** Módulo `endorsements`: provisória abre saldo, definitivas consomem proporcionalmente. Numeração `P-####`, `D-######` (importação) e `E-#####` (exportação), como no legado. Cancelar uma definitiva devolve o valor ao saldo. Histórico de posição auditado — o legado trocava a posição sem deixar rastro.
- [x] **38.** Módulo `finance` — **numerário**: fluxo *Falta enviar → Enviado → Recebido*, com agravo parametrizado sobre o valor devido à seguradora, envio em lote e baixa com valor recebido ajustável.
- [x] **39.** Módulo `finance` — **comissões**: geradas automaticamente na emissão da definitiva, rateando o prêmio entre parceiro, corretora e vendedor pelos percentuais da cotação.
- [x] **40.** Tela de **Parâmetros**: valores de negócio que ainda dependem de confirmação do cliente (acréscimo, prazo de TFA, prazo de liberação) editáveis sem deploy, com auditoria da alteração.
