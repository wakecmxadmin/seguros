# Mapeamento da plataforma Pinho — índice

Engenharia reversa **somente leitura** da plataforma legada em produção
(`http://142.93.2.186:8080/pinhoV2/`, "Coomex Hub", desenvolvida pela Infoline Systems).
Nenhum dado foi criado, alterado ou removido durante o mapeamento.

| Documento | Conteúdo |
|---|---|
| [01-mapa-navegacao.md](01-mapa-navegacao.md) | Árvore completa de menus e rotas do legado |
| [02-cotacao-importacao.md](02-cotacao-importacao.md) | Tela núcleo: todos os campos, selects e defaults |
| [03-cotacao-exportacao.md](03-cotacao-exportacao.md) | Variante de exportação e suas diferenças |
| [04-regras-calculo.md](04-regras-calculo.md) | Fórmulas do seguro, conferidas contra dados reais |
| [05-cadastros.md](05-cadastros.md) | 20 telas de cadastro, campos e problemas de dados |
| [06-identidade-visual.md](06-identidade-visual.md) | Paleta medida no legado + paleta proposta |
| [07-modulos.md](07-modulos.md) | Modularização do sistema novo e ordem de implementação |
| [08-fluxos.md](08-fluxos.md) | Ciclo de vida do processo e fluxos operacionais |
| [09-api-legado.md](09-api-legado.md) | 445 endpoints REST extraídos do bundle + convenções de nomes |
| [10-dores-e-melhorias.md](10-dores-e-melhorias.md) | Problemas encontrados e oportunidades, por prioridade |
| [11-dicionario-dados.md](11-dicionario-dados.md) | Campos reais do banco legado, extraídos do bundle |
| [12-reuniao-cliente.md](12-reuniao-cliente.md) | Dores e regras de negócio levantadas na reunião |
| [13-sigra-campos-necessarios.md](13-sigra-campos-necessarios.md) | Campos a puxar do SIGRA por documento (BL, Invoice, CE Mercante, TFA, câmbio), status do mapeamento |
| [SIGRA_DB.md](SIGRA_DB.md) | Schema, tabelas e conexão do banco externo `sigraweb` (SIGRA) |

## Stack alvo (mesmo padrão dos demais projetos em `dev/wake`)
- **Backend**: NestJS + Prisma + PostgreSQL + TypeScript
- **Frontend**: Vite + React 18 + TypeScript + Tailwind + shadcn/ui + React Query + React Router + Zustand
- **Estrutura**: `backend/` e `frontend/` na raiz do repositório

## Identificação do sistema legado
- SPA **Angular** (versão moderna, build com chunks; roteamento por hash `#/Rota/:origem`), Bootstrap 3/4, fonte Roboto
- Backend **Java REST** em `/pinhoV2/rest/...`
- Multi-tenant rudimentar: o header mostra `Pinho | <usuário>`; o rodapé, "Infoline Systems"
- A empresa operadora aparece como "Coomex Inteligencia Logistica Ltda"
