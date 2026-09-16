# Projeto Seguros — Pinho

Reescrita da plataforma de seguros de transporte internacional de cargas usada hoje pela Pinho
(legado "Coomex Hub" / pinhoV2, da Infoline Systems).

O mapeamento completo do sistema legado está em [`docs/`](docs/00-indice.md) — comece por
`docs/00-indice.md` antes de implementar qualquer módulo.

## Stack

- **Backend**: NestJS + Prisma + PostgreSQL + TypeScript
- **Frontend**: Vite + React 18 + TypeScript + Tailwind + shadcn/ui + React Query + React Router + Zustand
- **Estrutura**: `backend/` e `frontend/` na raiz

Mesmo padrão dos demais projetos em `dev/wake` (`grupinho-rh`, `signa`, `grupinho`).

---

# Convenção de nomes (Always Follow)

* **Em inglês**: nomes de arquivos e pastas, identificadores de código (componentes, funções,
  variáveis, tipos), campos e tabelas do banco, slugs de permissão, rotas da API e chaves de query.
* **Em português**: todo texto visível ao usuário (rótulos, mensagens, validações, e-mails),
  comentários de código, e os documentos de mapeamento em `docs/`.
* Arquivos internos que não vão para o repositório podem ficar em português.

Ou seja: `UserDialog.tsx` com `<Button>Salvar</Button>` — nunca `UsuarioDialog.tsx`.

---

# Gestão de Tarefas (Always Follow)

* Sempre que o usuário se referir a **"tarefas"**, **"demandas"** ou **"pendências"**, isso significa o
  arquivo `novas_tarefas.md` na raiz do repositório.
* O arquivo tem duas seções: `## Pendentes` e `## Concluídas`, e um **contador** no topo.
* Todas as tarefas são **numeradas**, com numeração **estável** — o número de um item nunca muda,
  nem quando ele é movido entre seções.
* Ao **concluir** uma tarefa, apenas marque `[x]` antes dela. **Não mova para Concluídas nesse momento.**
* Só mova as tarefas marcadas para `## Concluídas` quando:
  - um **bloco de trabalho for fechado**, ou
  - o **usuário pedir explicitamente**.
* No topo há uma **barra de progresso** em ASCII (`*` preenchido, `-` vazio, 20 caracteres) com a
  porcentagem — calculada como *feitas + concluídas ÷ total*.
* O contador distingue **Pendentes** (ainda `[ ]`), **Feitas** (já `[x]`, mas ainda na seção
  Pendentes) e **Concluídas** (já movidas). Atualize a barra e o contador a cada mudança.
* Antes de começar a trabalhar em uma tarefa, leia o item correspondente em `novas_tarefas.md`
  para entender o escopo já decidido.
* Nunca marque uma tarefa como concluída por conta própria sem que o trabalho esteja de fato entregue.

## Formato do arquivo

```markdown
# Tarefas

`*******-------------` **36%**

**Total:** N  ·  **Pendentes:** N  ·  **Feitas (aguardando fechamento):** N  ·  **Concluídas:** N

## Pendentes

- [ ] **1.** Descrição da tarefa
- [x] **2.** Tarefa feita, aguardando fechamento do bloco

## Concluídas

- [x] **0.** Tarefa já movida
```

---

# Trabalho no sistema legado (Always Follow)

* A plataforma legada está **em produção** e atende processos reais.
* É permitido **apenas leitura**: navegar, filtrar, visualizar e requisições `GET` de arquivos estáticos.
* **Nunca** clicar em *Salvar*, *Excluir*, *Emitir*, *Confirmar*, *Gerar* ou qualquer ação que persista
  dados, e nunca chamar endpoints de escrita.
* Formulários podem ser abertos para inventariar campos, desde que abandonados sem submeter.

---

# UI/UX (Always Follow)

* A interface deve ser **leve, intuitiva e simples de entender** — e **não pode ter cara de gerada por IA**.
* **Evitar telas genéricas** (dashboards decorativos, cards de métrica sem propósito, gráficos que
  ninguém pediu). Toda tela precisa resolver uma tarefa real do operador.
* Seguir a paleta definida em [`docs/06-identidade-visual.md`](docs/06-identidade-visual.md),
  derivada das cores reais do legado — melhorias de contraste e consistência são bem-vindas.
* Preservar a **semântica de cor de status** que os usuários já internalizaram (Cotação / Provisória /
  Definitiva), trocando o preenchimento de linha inteira por badges + faixa sutil na borda.
* Densidade adequada a telas de dados: base 14px, não 16px como no legado.
* Sempre tratar estados de carregamento, vazio, erro e sucesso.
* Formulários longos (como a cotação, com ~60 campos) devem ser divididos em etapas ou abas,
  com autosave e recálculo reativo — nunca uma rolagem única como no legado.

---

# Fluxo de trabalho (Always Follow)

* Antes de alterar código (edição, criação de arquivo, migração), **explique primeiro em texto** o que
  vai fazer e por quê — antes das chamadas de ferramenta, não depois.
* Para tarefas simples, uma frase basta. Para tarefas maiores, descreva o plano antes de executar.
* Responder sempre em **português**.
