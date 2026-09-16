# Modularização proposta

Recorte do sistema em módulos, derivado do que foi mapeado no legado. Cada módulo é um bounded context
com dono claro de dados — serve tanto para o backend (módulos NestJS + schemas Prisma) quanto para a
navegação do frontend.

---

## 1. `auth` — Identidade e Acesso
**Substitui:** tela "Usuários" (`ContaUsuarioSelecao`), que hoje só tem CNPJ + flag de numerário.

Entidades: `User`, `Role`, `Permission`, `RolePermission`, `Session`, `PasswordReset`, `AuditLog`.

Escopo:
- Login por e-mail + senha (hash Argon2/bcrypt), com CNPJ como identificador alternativo para
  compatibilizar a migração dos usuários atuais.
- Recuperação de senha por token expirável (hoje só existe "Zerar Senha" feito pelo admin).
- **RBAC de verdade**: papéis (Administrador, Operador de Seguros, Financeiro, Comercial/Vendedor,
  Parceiro externo, Cliente) × permissões por recurso e ação.
- Escopo de dados: um Parceiro/Cliente só enxerga seus próprios processos.
- Trilha de auditoria de quem alterou o quê (inexistente hoje — problema sério num sistema que
  movimenta prêmio e comissão).
- 2FA opcional para perfis administrativos.

> **Gap do legado:** não há papéis, não há vínculo entre `Usuário` e `Funcionário`, não há auditoria.

## 2. `partners` — Cadastros de Pessoas
Entidades: `Client`, `Partner`, `Insurer`, `Employee`, `Surveyor` (vistoriador), `Carrier` (transportadora).

Todas compartilham um núcleo `LegalEntity` (razão social, nome fantasia, CNPJ/CPF, endereço, contato,
e-mails, ativo). Hoje são 6 telas quase idênticas duplicadas.

Melhorias: dedupe na migração (Bradesco duplicado, parceiros repetidos), validação de CNPJ,
autocomplete no lugar de "código + lupa", integração ReceitaWS/BrasilAPI para preencher por CNPJ.

## 3. `catalog` — Tabelas de Domínio
Entidades: `Country`, `State`, `City`, `PortAirport`, `Currency`, `Packaging`, `Vessel` (navio),
`CommodityType` (a "meremb"), `Incoterm`, `Modal`.

Melhorias:
- Higienizar países (remover `..`, `...`, unificar Índia/India/índia, Bélgica ×2, Coréia/Korea, etc.).
- Portos/aeroportos com **UN-LOCODE / IATA**, cidade e estado — hoje é só nome livre + país.
- Seed a partir de bases públicas em vez de digitação manual.

## 4. `policies` — Apólices e Tarifação
Entidades: `Policy`, `Coverage`, `PolicyCoverage`, `RateTable`, `AccessoryCoverage`, `Deductible` (franquia).

Escopo:
- Apólice com `numero`, `descricao`, `importanciaSegurada`, `tipo` (IMPORTACAO/EXPORTACAO),
  `seguradoraId`, `corretorCodigo`, `vigenciaInicio/Fim`, `ativo`
  **+ campos hoje ausentes**: `taxaBasica`, `premioMinimo`, `moeda`.
  (Hoje a taxa está escondida no texto da descrição: "AKAD - 0.10% - PROBEXA".)
- Coberturas ICC: Básica Ampla "A", Básica Restrita "B", Básica Restrita "C" + acessórias
  (Guerra e Greve, Paralisação Máquina/Refrigeração, Despesas, Lucros Esperados, Prêmio Mínimo,
  Transbordo, Carta de Crédito).
- Tabela de taxas por (apólice × cobertura × modal × tipo de mercadoria), com lado **cliente** e
  lado **seguradora** — hoje a estrutura existe mas está zerada e a taxa é digitada à mão em cada cotação.

## 5. `quotes` — Cotações (núcleo)
Entidades: `Process`, `QuoteImport`, `QuoteExport`, `QuoteItem`, `RateLine`, `QuoteCalculation`.

Substitui `CotacaoImportacao`, `CotacaoExportacao`, `ProcessosNovos`, `ProcessosAbertos`.

Escopo:
- Um `Process` com número sequencial, `tipo` (IMPORTACAO/EXPORTACAO), `status`
  (COTACAO → PROVISORIA → DEFINITIVA) e `posicao` (Proposta em aberto, Aprovada, Pendente, Follow-up…).
- Blocos: identificação, origem, destino, produto, financeiro, comissões, coberturas, impostos, taxas.
- **Motor de cálculo isolado e testável** (ver `04-regras-calculo.md`) — regras de I.S., prêmio,
  prêmio mínimo, conversão cambial e margem.
- Recálculo reativo (hoje exige clicar "Calcular").
- Versionamento da cotação (histórico de alterações de taxa/valor).

## 6. `endorsements` — Averbações (Provisória e Definitiva)
Entidades: `Endorsement`, `EndorsementType` (PROVISORIA/DEFINITIVA), `EndorsementBalance`, `PositionHistory`.

Substitui `ProcessosProvisorias`, `ImpressaoProvisoria/Definitiva`, `ArquivoProvisoria/Definitiva`.

Escopo:
- Numeração própria: `P-####` (provisória) e `E-#####` (definitiva) — padrão observado nos dados reais.
- Controle de **saldo** e **percentual** de utilização da provisória (colunas `Saldo` e `Percentual`
  nas listagens; provisórias abertas ficam em 100,00).
- Flag "Provisória única" (só na importação).
- Transição de posição com histórico e responsável (hoje é um modal "Posição" com um select, sem trilha).
- Data limite de pendência com alerta — hoje há **10.279 pendências provisórias** acumuladas.

## 7. `documents` — Propostas, Modelos e Emissão
Entidades: `ProposalTemplate`, `GeneratedDocument`, `DocumentVersion`.

Substitui `ModelosPropostaSelecao`, botões de impressão nas listagens, `Nf`, `NfEmitida`.

Escopo:
- Template por (tipo × cobertura), hoje `.docx` versionado por nome de arquivo com sufixos "(1)".
- Geração de proposta/certificado em PDF com merge de dados do processo.
- Envio por e-mail com destinatários por cobertura (cadastro `E-mails`, hoje vazio).
- Emissão e consulta de NF.

## 8. `finance` — Financeiro
Entidades: `CashRequest` (numerário), `Payment`, `Commission`, `CommissionPayment`, `IrbIssue`.

Substitui `NumerarioSelecao`, `NumerariosPagos`, `PagamentoComissaoSelecao`, `ComissaoEmitidaSelecao`,
`NumerariosChequeIRB`.

Escopo:
- Solicitação de numerário (gated pelo flag `Permite solicitar Numerario` do usuário — vira permissão RBAC).
- Numerários pagos, baixa e conciliação.
- **Intermediação de negócios** (o legado chama comissão assim): rateio Parceiro % / Pinho % / Vendedor %.
- Emissão IRB (resseguro) — `Valor IRB` e `Moeda IRB` vêm da cotação de exportação.
- Existe hoje um item "Pagamento de Intermediação de Negócios **Funcionário**" que aponta para
  `#/emContrucao` — **nunca foi implementado**.

## 9. `fx` — Câmbio
Entidades: `ExchangeRate` (data, moeda, valorFiscal).

Substitui `TaxasCambiaisDiariasSelecao`.

Escopo:
- **Ingestão automática do PTAX (Banco Central)** — hoje alguém digita a cotação do dólar todo dia,
  card a card. É a dor operacional mais evidente do sistema.
- Histórico, fallback para o último dia útil, suporte às 12 moedas (hoje só o dólar é alimentado).
- Override manual auditado, para quando o negócio precisar de uma taxa específica.

## 10. `reports` — Relatórios e Rankings
Substitui `RankingApolice`, `RankingCliente`, `RankingEstado`, `RankingParceiro`, `RelatorioProducao`,
`RelatorioSaldoProvisorias` (não implementado), `Mapa` (não implementado).

Escopo: produção por período, rankings por apólice/cliente/estado/parceiro, saldo de provisórias,
exportação para Excel/CSV/PDF. Um painel operacional (não um "dashboard genérico"): pendências vencendo,
provisórias sem baixa, cotações sem resposta.

## 11. `notifications` — Alertas
Não existe no legado. Necessário para atacar as 10.279 pendências acumuladas:
alerta de data limite de pendência, cotação parada, provisória sem definitiva, apólice a vencer.

---

## Ordem de implementação sugerida

| Fase | Módulos | Justificativa |
|---|---|---|
| 1 | `auth`, `catalog`, `partners` | base de tudo; permite login, permissões e cadastros |
| 2 | `policies`, `fx` | pré-requisitos do motor de cálculo |
| 3 | `quotes` | núcleo de valor; entrega já útil isoladamente |
| 4 | `endorsements`, `documents` | fecha o ciclo operacional |
| 5 | `finance`, `reports`, `notifications` | complementos |

## Rotas legado → módulo (referência de migração)

| Rota legada | Módulo |
|---|---|
| `ContaUsuarioSelecao` | auth |
| `ClientesSelecao`, `ParceirosSelecao`, `SeguradorasSelecao`, `FuncionariosSelecao`, `VistoriadoresSelecao`, `TransportadorasSelecao` | partners |
| `CadastroPaises/Estados/Cidades`, `AeroportosPortosSelecao`, `MoedasSelecao`, `EmbalagensSelecao`, `NaviosSelecao`, `MercadoriasSelecao` | catalog |
| `ApolicesSelecao`, `CoberturasSelecao` | policies |
| `CotacaoImportacao`, `CotacaoExportacao`, `ProcessosNovos`, `ProcessosAbertos` | quotes |
| `ProcessosProvisorias`, `ImpressaoProvisoria/Definitiva`, `ArquivoProvisoria/Definitiva` | endorsements |
| `ModelosPropostaSelecao`, `EmailsSelecao`, `Nf`, `NfEmitida` | documents |
| `NumerarioSelecao`, `NumerariosPagos`, `PagamentoComissaoSelecao`, `ComissaoEmitidaSelecao`, `NumerariosChequeIRB` | finance |
| `TaxasCambiaisDiariasSelecao` | fx |
| `RankingApolice/Cliente/Estado/Parceiro`, `RelatorioProducao` | reports |
