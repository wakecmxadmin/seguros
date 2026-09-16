# API do sistema legado

Base: `http://142.93.2.186:8080/pinhoV2/rest`
Todas as chamadas observadas são **POST** com corpo JSON (mesmo as de leitura), via
`authService.gerarURL("/recurso/metodo")`.

> **Importante:** o bundle contém **445 endpoints**, mas a maior parte pertence a um ERP completo da
> Infoline (fiscal, produção, estoque, folha, CRM) com o qual a base de código é compartilhada.
> Abaixo estão apenas os endpoints do **domínio de seguros**.

## `/averbacao` — cotações e averbações (26)
- `/averbacao/aprovaDefinitiva`
- `/averbacao/aprovaTransacao`
- `/averbacao/calculaTransacao`
- `/averbacao/cancelarTransacao`
- `/averbacao/cobrancaTransacao`
- `/averbacao/concluiTransacao`
- `/averbacao/cotacoesAguardando`
- `/averbacao/excluirCartasProtesto`
- `/averbacao/incluirCartasProtesto`
- `/averbacao/listaCartasProtesto`
- `/averbacao/obterCombosPaisModal`
- `/averbacao/obterCombosTransacao`
- `/averbacao/obterListaCobertura`
- `/averbacao/obterListaTipoValor`
- `/averbacao/obterTodasTransacoes`
- `/averbacao/obterTodosSinistros`
- `/averbacao/obterTransacaoAtualizada`
- `/averbacao/removerSinistro`
- `/averbacao/removerTransacao`
- `/averbacao/reprovarTransacao`
- `/averbacao/saldo30`
- `/averbacao/salvarCartasProtesto`
- `/averbacao/salvarDefinitiva`
- `/averbacao/salvarPosicaoTransacao`
- `/averbacao/salvarSinistro`
- `/averbacao/salvarTransacao`

## `/numerario` — financeiro (24)
- `/numerario/baixarNumerario`
- `/numerario/calculaNumerario`
- `/numerario/emitirIrb`
- `/numerario/imprimirSolicitacaoNF`
- `/numerario/obterComissao`
- `/numerario/obterImagemBase64`
- `/numerario/obterListaApoliceTransacao`
- `/numerario/obterListaApoliceTransacaoProrrogacao`
- `/numerario/obterListaTransacaoRme`
- `/numerario/obterNumerario`
- `/numerario/obterTodasComissoes`
- `/numerario/obterTodasIrbs`
- `/numerario/obterTodasTransacoes`
- `/numerario/obterTodasTransacoesPagamentosComissoes`
- `/numerario/obterTransacoesComissoes`
- `/numerario/obterTransacoesIrbs`
- `/numerario/obterTransacoesNumerario`
- `/numerario/removerNumerario`
- `/numerario/salvarComissao`
- `/numerario/salvarIrb`
- `/numerario/salvarNumerario`
- `/numerario/salvarNumerarioEditarInfoline`
- `/numerario/solicitarNotaFiscal`
- `/numerario/solicitarNumerario`

## `/relatorio` — relatórios e impressões (15)
- `/relatorio/atualizarTxIrb`
- `/relatorio/emitirIrbTransacoesProducao`
- `/relatorio/gerarExcelRelatorioProducao`
- `/relatorio/imprimeArquivoDefinitiva`
- `/relatorio/imprimeArquivoProvisoria`
- `/relatorio/imprimeCartaProtestoPDF`
- `/relatorio/imprimeDefinitiva`
- `/relatorio/imprimePropostaDocX`
- `/relatorio/imprimePropostaHTML`
- `/relatorio/imprimePropostaPDF`
- `/relatorio/imprimeProvisoria`
- `/relatorio/obterTodasTransacoesApolicesEstados`
- `/relatorio/obterTodasTransacoesClientes`
- `/relatorio/obterTodasTransacoesParceiros`
- `/relatorio/obterTodasTransacoesProducao`

## `/contaUsuario` — usuários e autenticação (22)
- `/contaUsuario/alterarSenha`
- `/contaUsuario/buscaListaUsuarios`
- `/contaUsuario/buscaMenu`
- `/contaUsuario/buscaQtRegistrosPaginaUsuario`
- `/contaUsuario/buscarUsuario`
- `/contaUsuario/buscaUsuarios`
- `/contaUsuario/excluir`
- `/contaUsuario/getListCadastrados`
- `/contaUsuario/obterTodosUsuariosEmpresa`
- `/contaUsuario/obterTodosUsuariosEmpresaSelecao`
- `/contaUsuario/obterTodosUsuariosOportunidade`
- `/contaUsuario/obterUsuario`
- `/contaUsuario/removerUsuario`
- `/contaUsuario/salvar`
- `/contaUsuario/salvarContaUsuario`
- `/contaUsuario/salvarQtRegistrosPaginaUsuario`
- `/contaUsuario/update`
- `/contaUsuario/validaLogin`
- `/contaUsuario/validaSenha`
- `/contaUsuario/verificaPermissaoExcluirLocacao`
- `/contaUsuario/verificaPermissaoExclusaoTabelaPreco`
- `/contaUsuario/verificaPermissaoImpressaoRomaneio`

## `/perfil` + `/perfilMenu` + `/grupo` — perfis e permissões (15)
- `/grupo/buscaGrupo`
- `/grupo/excluir`
- `/grupo/salvar`
- `/perfil/adicionaUsuarioPermitido`
- `/perfil/alteraMenu`
- `/perfil/buscaPerfil`
- `/perfil/getListPorEmpresa`
- `/perfil/listaUsuariosDisponiveis`
- `/perfil/listaUsuariosPermitidos`
- `/perfil/obterMenus`
- `/perfil/removerPerfil`
- `/perfil/removeUsuarioPerfil`
- `/perfil/salvar`
- `/perfil/salvarPerfil`
- `/perfilMenu/salvar`

## `/cadastro` — cadastros gerais (197 endpoints)
Endpoints CRUD genéricos por entidade, no padrão `obterTodos<Entidade>` / `salvar<Entidade>` /
`remover<Entidade>` / `obter<Entidade>`. Cobrem países, estados, cidades, portos, apólices, clientes,
coberturas, e-mails, embalagens, vistoriadores, funcionários, mercadorias, moedas, navios, parceiros,
seguradoras, taxas cambiais, transportadoras e modelos de proposta — além de dezenas de entidades do ERP
que não pertencem ao domínio de seguros.

---

## Observações de arquitetura

- **Frontend**: Angular (versão moderna, build com chunks e hash — `main-*.js`, `chunk-*.js`),
  roteamento por hash (`#/Rota/:origem`), PrimeNG/Bootstrap, CKEditor 4.10.1 via CDN.
- **Backend**: Java, exposto em `/rest`. Retorna sempre um envelope de paginação
  (`nuPagina`, `qtPaginas`, `qtRegistrosPorPagina`, `qtRegistros`, `registros`, `deMensagem`).
- **Multi-tenant** por `cdEmpresa`, presente em praticamente toda requisição.
- **Autenticação**: token em `deToken`; a URL inicial aceita `?session_id=...`.
- **Convenção de nomes** (prefixo de tipo, herdada de Delphi/Oracle):

| Prefixo | Significado | Exemplo |
|---|---|---|
| `cd` | código / FK | `cdCliente`, `cdSeguradora`, `cdTransacao` |
| `de` | descrição / texto | `deMercadoria`, `deRazaoSocial` |
| `nu` | número | `nuAverbacao`, `nuApolice`, `nuCnpj` |
| `dt` | data | `dtTransacao`, `dtTaxaDiaria` |
| `vl` | valor monetário | `vlImportanciaSegurada`, `vlFinalPremioCliente` |
| `tx` | taxa (%) | `txBasicaCliente`, `txGuerraGreveSeguradora` |
| `pc` | percentual | `pcComissao`, `pcIcms` |
| `fl` | flag booleana | `flGuerraGreve`, `flProrrogacao` |
| `qt` | quantidade | `qtRegistros`, `qtPaginas` |
| `tp` | tipo | `tpIrb`, `tpComissao` |
| `st` | status | `stStatus` |

## Rotas do frontend: 85 no código, 38 no menu

Telas existentes mas **não expostas** no menu do usuário Pinho:

| Rota | O que é |
|---|---|
| `PerfilSelecao` | **Cadastro de perfis e permissões** (existe e funciona) |
| `ProcessosProrrogacoes` | Definitivas em prorrogação |
| `AverbacaoProvisoria` / `AverbacaoDefinitiva` | Telas de averbação |
| `Certificado` · `Recibo` · `Seguro` · `Cobertura` · `Processo` | Documentos e detalhes |
| `CotacoesAbertas` · `NovasCotacoes` | Variantes das listagens |
| `PlanilhaIrb` · `IrbEmitida` · `IrbEmitidaSelecao` · `EmissaoRme` | Resseguro / RME |
| `NumerarioImpressao` | Impressão de numerário |
| `ObservacaoSelecao` | Cadastro de observações padrão |
| `EmpresaSelecao` | Cadastro de empresas (multi-tenant) |
| `alterarSenha` · `AlteracaoImagemUsuario` | Perfil do usuário |
| **`ComandosSqlSelecaoComponent`** | **Tela de execução de SQL arbitrário** |
| `CFOSelecao`, `ClassificacaoFiscalSelecao`, `GloCnae*`, `GloSeries*`, `fabricanteSelecao`, `appCategorias`, `appItens`, `ComAgentesGruposSelecao`, … | Telas do ERP que não pertencem a este produto |

> ⚠️ A rota `ComandosSqlSelecaoComponent` sugere um console de SQL embutido na aplicação.
> Não foi acessada durante o mapeamento (seria escrita no banco). Vale confirmar com a Infoline
> se está ativa em produção — é um risco de segurança relevante.
