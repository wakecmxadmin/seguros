# Inventário de botões e ações do legado (tarefa 57)

Gerado por análise estática do bundle `main-S4VFPNOX.js` + `chunk-VYSLERLE.js` (18/11/2026).
Nada foi clicado nem chamado. Coluna **L/E**: L = leitura, E = escrita (persiste dados no legado).
Ícones `oi-*` são Open Iconic. "Visível quando" é a cadeia de `*ngIf`/`[disabled]`/`[hidden]` do template
(variáveis minificadas: `e`/`n`/`t` = componente ou item da linha). Listeners `onChange` de campos de filtro
foram omitidos (os campos já estão nos docs 15–18), exceto quando disparam chamada à API.

## Resumo

- 81 componentes de seguros/sistema com ações (ERP `empresa`, `EmpresaSelecao` e `app-itens-descricao` omitidos;
  `confirma`/`alerta`/`app-root` são infraestrutura). 549 linhas de ação no inventário
  (cliques, duplo clique, Enter, checkbox e callbacks de modal), 150 endpoints distintos alcançáveis a partir
  de botões, dos quais ~81 são escrita.
- **Conferência com os docs 15–18:** os botões, condições de exibição e endpoints da tela de processo (§4),
  da listagem (§6.3), dos documentos (16 §1), do financeiro (17) e dos relatórios/sistema (18) **batem** com
  o bundle atual. As divergências e lacunas são só as listadas abaixo.

## O que é novo ou diverge dos docs 15–18

1. **`Palavras Chaves` → `POST /cadastro/palavrasChaves`** (tela de Modelos de Proposta). O doc 16 §7.1
   dizia que não dava para confirmar o endpoint estaticamente; está no service de cadastro do chunk
   `chunk-VYSLERLE.js`. Nome **fora** da allowlist `obterTodos*/obterTodas*` → não pode ser chamado sem nova
   autorização do usuário, mesmo sendo leitura.
2. **Modal de pesquisa genérico (`pesquisa`)** monta a URL como `/{resource}/{metodo}` a partir de inputs
   do componente pai (`cadastroService.pesquisa`, `registros = [resource, metodo, código, descrição,
   coluna, ordem, parâmetro]`). O doc 18 cita só clientes/parceiros. Lista completa de usos no domínio:

   | Endpoint | Usado em |
   |---|---|
   | `/cadastro/obterTodosClientesPesquisa` | processo, processo-selecao, numerario-selecao, irb-emitida-selecao, relatorio-producao, 3 rankings |
   | `/cadastro/obterTodosParceirosPesquisa` | idem |
   | `/cadastro/obterTodosClientesPesquisaFiltro` / `...ParceirosPesquisaFiltro` | pagamento-comissao-selecao, comissao-emitida-selecao |
   | `/cadastro/obterTodasMercadoriasPesquisa` | processo-aba-dados-produto |
   | `/cadastro/obterTodosNaviosPesquisa` | processo-aba-dados-transporte, processo-aba-origem-destino |
   | `/cadastro/obterTodosModaisPesquisa`, `/cadastro/obterTodosPaisesPesquisa` | processo-aba-origem-destino (`pesquisaLista`, código morto — já anotado no doc 15 §3.3) |
   | `/Clientes/paginaPesquisaClientes` | clientes-selecao `pesquisaCliente()` — **nenhum botão chama** (código morto, recurso de outro produto) |

   Implicação de segurança: como o recurso e o método vêm de variáveis, o mesmo serviço alcançaria qualquer
   endpoint; não há allowlist no front do legado.
3. **Cartas de protesto — o "×" dos modais Avarias/Destinatários grava.** `fechaModalAvarias()` /
   `fechaModalDestinatarios()` são chamados tanto por **Confirmar** quanto pelo **×** do cabeçalho, e os
   dois remontam `deAvaria`/`deDestinatarios` com os itens marcados e chamam `/averbacao/salvarCartasProtesto`.
   Não existe "cancelar seleção": fechar o modal persiste. O doc 15 §7.2 só menciona o Confirmar.
4. **IRB emitido e comissão emitida não podem ser excluídos.** `irb-emitida` e `comissao-emitida` têm o modal
   `confirma` de exclusão no template, mas nenhum botão o abre e `excluirOK(){}` está vazio. Para desfazer um
   IRB ou uma solicitação de NF de comissão não há caminho na UI (doc 17 §7.3/§7.4 não diz isso explicitamente).
5. **"Gerar" de Emissão NF** chama só `/NotaFiscal/obterTodasNf` (nome de leitura). Confirma a suspeita do
   doc 17 (ponto 19): se o servidor grava `cdNf` a cada clique, é escrita escondida atrás de um nome `obter*`.
   O nome **parece** leitura e casa com o padrão `obterTodas*`, mas está em `/NotaFiscal/`, fora da
   exceção da tarefa 51 (que vale só para `/cadastro/`). A allowlist precisa testar o **caminho
   inteiro** (`^/cadastro/obterTod(os|as)\w+$`), nunca só o sufixo — senão um fechamento de NF seria
   criado em produção. **Nunca chamar** `obterTodasNf`.

## Inventário por componente

## `app-component-menu`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | a |  | ngIf=!n.collapse | `` |  |  |

## `app-alterar-senha`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | input |  | ngIf=!n.senhaOK | `validaSenha` | `? /contaUsuario/validaLogin` (L) |  |
| click | input |  | ngIf=n.senhaOK | `alterarSenha` | `? /contaUsuario/alterarSenha` (E) |  |

## `pesquisa`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | tr |  | ngForOf=n.lista | `seleciona` |  |  |
| click | button | × |  | `closeModal` |  |  |
| onChange | div |  |  | `pesquisarFiltro` | `POST /"+t.registros[0]+"/"+t.registros[1]` (L) | modal childModal, abre exibeAlertaVoltar |
| onChange | inputtext | Descrição: · oi oi-loop-circular |  | `pesquisarFiltro` | `POST /"+t.registros[0]+"/"+t.registros[1]` (L) | modal childModal, abre exibeAlertaVoltar |
| click | button | oi oi-loop-circular |  | `pesquisarFiltro` | `POST /"+t.registros[0]+"/"+t.registros[1]` (L) | modal childModal, abre exibeAlertaVoltar |
| click | th | Código |  | `ordem` | `POST /"+t.registros[0]+"/"+t.registros[1]` (L) | modal childModal, abre exibeAlertaVoltar |
| click | label | Descrição |  | `ordem` | `POST /"+t.registros[0]+"/"+t.registros[1]` (L) | modal childModal, abre exibeAlertaVoltar |
| pageChanged | div |  |  | `setPage` | `POST /"+t.registros[0]+"/"+t.registros[1]` (L) | modal childModal, abre exibeAlertaVoltar |
| click | button | Fechar |  | `closeModal` |  |  |

## `impressao-definitiva`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | button | oi oi-print |  | `imprimeDefinitiva` | `POST /relatorio/imprimeDefinitiva` (L (gera documento)) |  |

## `impressao-provisoria`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | button | oi oi-print |  | `imprimeProvisoria` | `POST /relatorio/imprimeProvisoria` (L (gera documento)) |  |

## `arquivo-definitiva`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | button | Excel · oi oi-print |  | `imprimirExcel` | `POST /relatorio/imprimeArquivoDefinitiva` (L (gera documento)) |  |

## `arquivo-provisoria`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | button | Gerar · oi oi-print |  | `imprimeArquivoProvisoria` | `POST /relatorio/imprimeArquivoProvisoria` (L (gera documento)) |  |

## `ranking-apolice-estado`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | button | oi oi-reload |  | `obterTodasTransacoesApolicesEstados` | `POST /relatorio/obterTodasTransacoesApolicesEstados` (L) |  |
| pageChanged | div |  |  | `setPage` | `POST /relatorio/obterTodasTransacoesApolicesEstados` (L) |  |

## `ranking-cliente`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | button | oi oi-reload |  | `obterTodasTransacoesClientes` | `POST /relatorio/obterTodasTransacoesClientes` (L) |  |
| pageChanged | div |  |  | `setPage` | `POST /relatorio/obterTodasTransacoesClientes` (L) |  |

## `ranking-parceiro`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | button | oi oi-reload |  | `obterTodasTransacoesParceiros` | `POST /relatorio/obterTodasTransacoesParceiros` (L) |  |
| pageChanged | div |  |  | `setPage` | `POST /relatorio/obterTodasTransacoesParceiros` (L) |  |

## `relatorio-producao`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | button | oi oi-reload |  | `obterTodasTransacoesProducao` | `POST /relatorio/obterTodasTransacoesProducao` (L) |  |
| click | button | oi oi-cloud-upload |  | `exibeConfirmaAtualizarTxIrb` |  | abre exibeConfirmaIrb |
| click | button | Imprimir · oi oi-print |  | `imprimir` |  |  |
| click | button | Gerar Excel · oi oi-print |  | `gerarExcelRelatorioProducao` | `POST /relatorio/gerarExcelRelatorioProducao` (E) |  |
| click | button | Gerar IRBs · oi oi-document |  | `exibeConfirmaEmitirIrbs` |  | abre exibeConfirmaEmitirIrb |
| resposta | confirma |  | ngIf=n.exibeConfirmaIrb | `confirmaAtualizarTxIrb` | `POST /relatorio/atualizarTxIrb` (E) |  |
| resposta | confirma |  | ngIf=n.exibeConfirmaEmitirIrb | `confirmaEmitirIrb` | `POST /relatorio/emitirIrbTransacoesProducao` (E) |  |

## `contaUsuario`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| resposta | confirma |  | ngIf=n.exibeConfirmaExcluir | `excluirOK` | `POST /contaUsuario/removerUsuario` (E) | modal loader |
| click | button | Zerar Senha |  | `zerarSenha` | `POST /contaUsuario/salvarContaUsuario` (E) | modal loader |
| click | div | Voltar |  | `voltar` |  |  |
| click | button | Salvar |  | `salvar` | `POST /contaUsuario/salvarContaUsuario` (E) | modal loader |
| click | button | Excluir |  | `excluir` |  | abre exibeConfirmaExcluir |

## `ContaUsuarioSelecao`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| dblclick | tr | oi oi-pencil | ngIf=n.selecao==!0 ∧ ngForOf=e.listaContaUsuario | `visualizaUsuario` |  |  |
| click | button | Editar · oi oi-pencil | ngIf=n.selecao==!0 ∧ ngForOf=e.listaContaUsuario | `visualizaUsuario` |  |  |
| click | button | oi oi-magnifying-glass | ngIf=n.selecao==!0 | `pesquisarFiltro` | `POST /contaUsuario/obterTodosUsuariosEmpresaSelecao` (L) | modal loader |
| click | label | Usuário | ngIf=n.selecao==!0 | `ordem` | `POST /contaUsuario/obterTodosUsuariosEmpresaSelecao` (L) | modal loader |
| click | label | Data Ultimo Acesso | ngIf=n.selecao==!0 | `ordem` | `POST /contaUsuario/obterTodosUsuariosEmpresaSelecao` (L) | modal loader |
| click | label | Token | ngIf=n.selecao==!0 | `ordem` | `POST /contaUsuario/obterTodosUsuariosEmpresaSelecao` (L) | modal loader |
| pageChanged | div | oi oi-plus | ngIf=n.selecao==!0 | `setPage` | `POST /contaUsuario/obterTodosUsuariosEmpresaSelecao` (L) | modal loader |
| click | button | Incluir · oi oi-plus | ngIf=n.selecao==!0 | `incluir` |  |  |
| resposta | contaUsuario |  | ngIf=!n.selecao | `respostaUsuario` | `POST /contaUsuario/obterTodosUsuariosEmpresaSelecao` (L) | modal loader |

## `app-observacao`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| resposta | confirma |  | ngIf=n.exibeConfirmaExcluir | `excluirOK` | `POST /cadastro/excluirObservacao` (E) |  |
| click | button | Voltar · oi oi-book |  | `voltar` |  |  |
| click | button | Salvar · oi oi-book |  | `salvarObservacao` | `POST /cadastro/salvarObservacao` (E) |  |
| click | button | Excluir · oi oi-x |  | `excluirObservacao` |  | abre exibeConfirmaExcluir |

## `app-observacao-selecao`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | td | oi oi-pencil | ngForOf=e.listaObservacao | `visualizar` |  |  |
| click | button | Pesquisar · oi oi-bell |  | `pesquisarFiltro` | `POST /cadastro/obterObservacao` (L) |  |
| click | label | Código |  | `ordem` | `POST /cadastro/obterObservacao` (L) |  |
| click | label | Observação |  | `ordem` | `POST /cadastro/obterObservacao` (L) |  |
| pageChanged | pagination | oi oi-plus |  | `setPage` | `POST /cadastro/obterObservacao` (L) |  |
| click | button | Incluir · oi oi-plus |  | `incluir` |  |  |
| resposta | app-observacao |  | ngIf=!n.selecao | `respostaSelecao` | `POST /cadastro/obterObservacao` (L) |  |

## `perfil`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| dblclick | tr | oi oi-check | ngForOf=n.listaUsuariosDisponiveis | `clickGridUsuarios` | `POST /perfil/removeUsuarioPerfil` (L)<br>`POST /perfil/adicionaUsuarioPermitido` (L)<br>`POST /perfil/listaUsuariosDisponiveis` (L)<br>`POST /perfil/listaUsuariosPermitidos` (L) |  |
| click | button | Selecionar · oi oi-check | ngForOf=n.listaUsuariosDisponiveis | `clickGridUsuarios` | `POST /perfil/removeUsuarioPerfil` (L)<br>`POST /perfil/adicionaUsuarioPermitido` (L)<br>`POST /perfil/listaUsuariosDisponiveis` (L)<br>`POST /perfil/listaUsuariosPermitidos` (L) |  |
| dblclick | tr | oi oi-x | ngForOf=n.listaUsuariosPermitidos | `clickGridUsuarios` | `POST /perfil/removeUsuarioPerfil` (L)<br>`POST /perfil/adicionaUsuarioPermitido` (L)<br>`POST /perfil/listaUsuariosDisponiveis` (L)<br>`POST /perfil/listaUsuariosPermitidos` (L) |  |
| click | button | Deselecionar · oi oi-x | ngForOf=n.listaUsuariosPermitidos | `clickGridUsuarios` | `POST /perfil/removeUsuarioPerfil` (L)<br>`POST /perfil/adicionaUsuarioPermitido` (L)<br>`POST /perfil/listaUsuariosDisponiveis` (L)<br>`POST /perfil/listaUsuariosPermitidos` (L) |  |
| resposta | confirma |  | ngIf=n.exibeConfirmaExcluir | `excluirOK` | `POST /perfil/removerPerfil` (E) |  |
| click | label | Data |  | `ordemDisponivel` | `POST /perfil/listaUsuariosDisponiveis` (L) |  |
| click | label | Usuários Permitidos |  | `ordemPermitido` | `POST /perfil/listaUsuariosPermitidos` (L) |  |
| pageChanged | div |  |  | `setPage` | `POST /perfil/listaUsuariosDisponiveis` (L) |  |
| pageChanged | div |  |  | `setPageExtrato` | `POST /perfil/listaUsuariosPermitidos` (L) |  |
| click | div | Voltar |  | `voltar` |  |  |
| click | button | Excluir |  | `excluir` |  | abre exibeConfirmaExcluir |
| click | button | Salvar |  | `salvar` | `POST /perfil/salvarPerfil` (E) |  |

## `PerfilSelecao`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| dblclick | tr | oi oi-pencil | ngForOf=e.listaPerfil | `visualizaPerfil` |  |  |
| click | button | Editar · oi oi-pencil | ngForOf=e.listaPerfil | `visualizaPerfil` |  |  |
| click | button | Incluir · oi oi-plus | ngIf=e.authService.cdContaUsuario=="Infoline" | `novoPerfil` |  |  |
| click | button | oi oi-magnifying-glass |  | `pesquisarFiltro` | `POST /perfil/getListPorEmpresa` (L) |  |
| click | label | Código |  | `ordem` | `POST /perfil/getListPorEmpresa` (L) |  |
| click | label | Empresa |  | `ordem` | `POST /perfil/getListPorEmpresa` (L) |  |
| pageChanged | div |  |  | `setPage` | `POST /perfil/getListPorEmpresa` (L) |  |

## `AlteracaoImagemUsuario`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | button | Remover Imagem · oi oi-x | ngIf=n.usuarioSelecionado.imagemUsuario!=null | `removerImUsuario` |  |  |
| click | button | Download Imagem · oi oi-cloud-download | ngIf=n.usuarioSelecionado.imagemUsuario!=null | `downloadImUsuario` |  |  |
| click | button | Upload Imagem · oi oi-cloud-upload |  | `click` |  |  |
| change | input |  |  | `fileChangeEvent` |  |  |
| click | div | Voltar |  | `voltar` |  |  |
| click | button | Salvar Imagem |  | `salvar` | `POST /contaUsuario/salvarContaUsuario` (E) |  |

## `cadastro-cidades`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| resposta | confirma |  | ngIf=n.exibeConfirmaExcluir | `excluirOK` | `POST /cadastro/removerGloCidade` (E) |  |
| onChange | div | Selecione um País |  | `obterCombosCidadesEstadosPaises` | `POST /cadastro/obterCombosCidadesEstadosPaises` (L) |  |
| onChange | inputselect | Selecione um Estado · Estado: |  | `obterCombosCidadesEstadosPaises` | `POST /cadastro/obterCombosCidadesEstadosPaises` (L) |  |
| click | div | Voltar |  | `voltar` |  |  |
| click | button | Excluir |  | `excluirGloCidade` |  | abre exibeConfirmaExcluir |
| click | button | Salvar |  | `salvarGloCidade` | `POST /cadastro/salvarGloCidade` (E) |  |

## `cadastro-cidades-selecao`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| dblclick | tr | oi oi-pencil | ngForOf=e.listaGloCidades | `visualizaGloCidades` |  |  |
| click | button | Editar · oi oi-pencil | ngForOf=e.listaGloCidades | `visualizaGloCidades` |  |  |
| keyup.enter | div |  |  | `obterTodasGloCidades` | `POST /cadastro/obterTodasGloCidades` (L) |  |
| click | button | oi oi-reload |  | `obterTodasGloCidades` | `POST /cadastro/obterTodasGloCidades` (L) |  |
| click | label | País |  | `ordem` | `POST /cadastro/obterTodasGloCidades` (L) |  |
| click | label | UF |  | `ordem` | `POST /cadastro/obterTodasGloCidades` (L) |  |
| click | label | Estado |  | `ordem` | `POST /cadastro/obterTodasGloCidades` (L) |  |
| click | label | Cidade |  | `ordem` | `POST /cadastro/obterTodasGloCidades` (L) |  |
| pageChanged | div |  |  | `setPage` | `POST /cadastro/obterTodasGloCidades` (L) |  |
| click | button | Incluir · oi oi-plus |  | `incluirNovoGloCidades` |  |  |
| resposta | cadastro-cidades |  | ngIf=!n.selecao | `respostaGloCidades` | `POST /cadastro/obterTodasGloCidades` (L) |  |

## `cadastro-estados`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| resposta | confirma |  | ngIf=n.exibeConfirmaExcluir | `excluirOK` | `POST /cadastro/removerGloEstado` (E) |  |
| click | div | Voltar |  | `voltar` |  |  |
| click | button | Excluir |  | `excluirGloEstado` |  | abre exibeConfirmaExcluir |
| click | button | Salvar |  | `salvarGloEstado` | `POST /cadastro/salvarGloEstado` (E) |  |

## `cadastro-estados-selecao`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| dblclick | tr | oi oi-pencil | ngForOf=e.listaGloEstados | `visualizaGloEstados` |  |  |
| click | button | Editar · oi oi-pencil | ngForOf=e.listaGloEstados | `visualizaGloEstados` |  |  |
| keyup.enter | div |  |  | `obterTodosGloEstados` | `POST /cadastro/obterTodosGloEstados` (L) |  |
| click | div | oi oi-reload |  | `obterTodosGloEstados` | `POST /cadastro/obterTodosGloEstados` (L) |  |
| click | label | País |  | `ordem` | `POST /cadastro/obterTodosGloEstados` (L) |  |
| click | label | UF: |  | `ordem` | `POST /cadastro/obterTodosGloEstados` (L) |  |
| click | label | Estado: |  | `ordem` | `POST /cadastro/obterTodosGloEstados` (L) |  |
| pageChanged | div |  |  | `setPage` | `POST /cadastro/obterTodosGloEstados` (L) |  |
| click | button | Incluir · oi oi-plus |  | `incluirNovoGloEstados` |  |  |
| resposta | cadastro-estados |  | ngIf=!n.selecao | `respostaGloEstados` | `POST /cadastro/obterTodosGloEstados` (L) |  |

## `cadastro-paises`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| resposta | confirma |  | ngIf=n.exibeConfirmaExcluir | `excluirOK` | `POST /cadastro/removerGloPaises` (E) |  |
| click | div | Voltar |  | `voltar` |  |  |
| click | button | Excluir |  | `excluirGloPaises` |  | abre exibeConfirmaExcluir |
| click | button | Salvar |  | `salvarGloPaises` | `POST /cadastro/salvarGloPaises` (E) |  |

## `cadastro-paises-selecao`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| dblclick | tr | oi oi-pencil | ngForOf=e.listaGloPaises | `visualizaGloPaises` |  |  |
| click | button | Editar · oi oi-pencil | ngForOf=e.listaGloPaises | `visualizaGloPaises` |  |  |
| keyup.enter | div |  |  | `obterTodosGloPaises` | `POST /cadastro/obterTodosGloPaises` (L) |  |
| click | div | oi oi-reload |  | `obterTodosGloPaises` | `POST /cadastro/obterTodosGloPaises` (L) |  |
| click | label | País |  | `ordem` | `POST /cadastro/obterTodosGloPaises` (L) |  |
| click | label | Taxa Guerra e Greve: |  | `ordem` | `POST /cadastro/obterTodosGloPaises` (L) |  |
| click | label | Taxa Guerra e Greve Seguradora: |  | `ordem` | `POST /cadastro/obterTodosGloPaises` (L) |  |
| pageChanged | div |  |  | `setPage` | `POST /cadastro/obterTodosGloPaises` (L) |  |
| click | button | Incluir · oi oi-plus |  | `incluirNovoGloPaises` |  |  |
| resposta | cadastro-paises |  | ngIf=!n.selecao | `respostaGloPaises` | `POST /cadastro/obterTodosGloPaises` (L) |  |

## `aeroportos-portos-selecao`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | div | cancel · Excluir | ngForOf=n.listaAeroportosPortos | `excluir` | `POST /cadastro/removerPorto` (E)<br>`POST /cadastro/obterTodosPortos` (L) |  |
| click | div | save · Salvar | ngForOf=n.listaAeroportosPortos | `salvar` | `POST /cadastro/salvarPorto` (E)<br>`POST /cadastro/obterTodosPortos` (L) |  |
| keyup.enter | inputtext | Descrição: |  | `obterTodosAeroportosPortos` | `POST /cadastro/obterTodosPortos` (L) |  |
| keyup.enter | inputtext | País: |  | `obterTodosAeroportosPortos` | `POST /cadastro/obterTodosPortos` (L) |  |
| keyup.enter | inputtext | Modal: · oi oi-magnifying-glass |  | `obterTodosAeroportosPortos` | `POST /cadastro/obterTodosPortos` (L) |  |
| click | button | Pesquisar · oi oi-magnifying-glass |  | `obterTodosAeroportosPortos` | `POST /cadastro/obterTodosPortos` (L) |  |
| click | button | Adicionar |  | `adicionarNovoAeroportosPortos` |  |  |
| pageChanged | pagination |  |  | `setPage` | `POST /cadastro/obterTodosPortos` (L) |  |

## `apolices-selecao`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | div | cancel · Excluir | ngForOf=n.listaApolices | `excluir` | `POST /cadastro/removerApolice` (E)<br>`POST /cadastro/obterTodosApolices` (L) |  |
| click | div | save · Salvar | ngForOf=n.listaApolices | `salvar` | `POST /cadastro/salvarApolice` (E)<br>`POST /cadastro/obterTodosApolices` (L) |  |
| keyup.enter | inputtext | Apolíce: · oi oi-magnifying-glass |  | `obterTodosApolices` | `POST /cadastro/obterTodosApolices` (L) |  |
| click | button | Pesquisar · oi oi-magnifying-glass |  | `obterTodosApolices` | `POST /cadastro/obterTodosApolices` (L) |  |
| click | button | Adicionar |  | `adicionarNovaApolice` |  |  |
| pageChanged | pagination |  |  | `setPage` | `POST /cadastro/obterTodosApolices` (L) |  |

## `coberturas-selecao`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | div | cancel · Excluir | ngForOf=n.listaCoberturas | `excluir` | `POST /cadastro/removerCobertura` (E)<br>`POST /cadastro/obterTodasCoberturas` (L) |  |
| click | div | save · Salvar | ngForOf=n.listaCoberturas | `salvar` | `POST /cadastro/salvarCobertura` (E)<br>`POST /cadastro/obterTodasCoberturas` (L) |  |
| keyup.enter | inputtext | Cobertura: · oi oi-magnifying-glass |  | `obterTodasCoberturas` | `POST /cadastro/obterTodasCoberturas` (L) |  |
| click | button | Pesquisar · oi oi-magnifying-glass |  | `obterTodasCoberturas` | `POST /cadastro/obterTodasCoberturas` (L) |  |
| click | button | Adicionar |  | `adicionarNovaCobertura` |  |  |
| pageChanged | pagination |  |  | `setPage` | `POST /cadastro/obterTodasCoberturas` (L) |  |

## `emails-selecao`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | div | cancel · Excluir | ngForOf=n.listaEmails | `excluir` | `POST /cadastro/removerEmail` (E)<br>`POST /cadastro/obterTodosEmails` (L) |  |
| click | div | save · Salvar | ngForOf=n.listaEmails | `salvar` | `POST /cadastro/salvarEmail` (E)<br>`POST /cadastro/obterTodosEmails` (L) |  |
| keyup.enter | inputtext | E-mail: |  | `obterTodosEmails` | `POST /cadastro/obterTodosEmails` (L) |  |
| keyup.enter | inputtext | Cobertura: · oi oi-magnifying-glass |  | `obterTodosEmails` | `POST /cadastro/obterTodosEmails` (L) |  |
| click | button | Pesquisar · oi oi-magnifying-glass |  | `obterTodosEmails` | `POST /cadastro/obterTodosEmails` (L) |  |
| click | button | Adicionar |  | `adicionarNovoEmail` |  |  |
| pageChanged | pagination |  |  | `setPage` | `POST /cadastro/obterTodosEmails` (L) |  |

## `embalagens-selecao`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | div | cancel · Excluir | ngForOf=n.listaEmbalagem | `excluir` | `POST /cadastro/removerEmbalagem` (E)<br>`POST /cadastro/obterTodasEmbalagens` (L) |  |
| click | div | save · Salvar | ngForOf=n.listaEmbalagem | `salvar` | `POST /cadastro/salvarEmbalagem` (E)<br>`POST /cadastro/obterTodasEmbalagens` (L) |  |
| keyup.enter | inputtext | Código da seguradora: |  | `obterTodasEmbalagens` | `POST /cadastro/obterTodasEmbalagens` (L) |  |
| keyup.enter | inputtext | Embalagem: · oi oi-magnifying-glass |  | `obterTodasEmbalagens` | `POST /cadastro/obterTodasEmbalagens` (L) |  |
| click | button | Pesquisar · oi oi-magnifying-glass |  | `obterTodasEmbalagens` | `POST /cadastro/obterTodasEmbalagens` (L) |  |
| click | button | Adicionar |  | `adicionarNovaEmbalagem` |  |  |
| pageChanged | pagination |  |  | `setPage` | `POST /cadastro/obterTodasEmbalagens` (L) |  |

## `funcionarios-selecao`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | div | cancel · Excluir | ngForOf=n.listaFuncionarios | `excluir` | `POST /cadastro/removerFuncionario` (E)<br>`POST /cadastro/obterTodosFuncionarios` (L) |  |
| click | div | save · Salvar | ngForOf=n.listaFuncionarios | `salvar` | `POST /cadastro/salvarFuncionario` (E)<br>`POST /cadastro/obterTodosFuncionarios` (L) |  |
| keyup.enter | inputtext | Funcionário: |  | `obterTodosFuncionarios` | `POST /cadastro/obterTodosFuncionarios` (L) |  |
| keyup.enter | inputtext | Setor: |  | `obterTodosFuncionarios` | `POST /cadastro/obterTodosFuncionarios` (L) |  |
| keyup.enter | inputtext | Função: |  | `obterTodosFuncionarios` | `POST /cadastro/obterTodosFuncionarios` (L) |  |
| keyup.enter | inputselect | Todos · Status: |  | `obterTodosFuncionarios` | `POST /cadastro/obterTodosFuncionarios` (L) |  |
| click | button | Pesquisar · oi oi-magnifying-glass |  | `obterTodosFuncionarios` | `POST /cadastro/obterTodosFuncionarios` (L) |  |
| click | button | Adicionar |  | `adicionarNovoFuncionario` |  |  |
| pageChanged | pagination |  |  | `setPage` | `POST /cadastro/obterTodosFuncionarios` (L) |  |

## `mercadorias-selecao`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | div | cancel · Excluir | ngForOf=n.listaMercadorias | `excluir` | `POST /cadastro/removerMercadoria` (E)<br>`POST /cadastro/obterTodasMercadorias` (L) |  |
| click | div | save · Salvar | ngForOf=n.listaMercadorias | `salvar` | `POST /cadastro/salvarMercadoria` (E)<br>`POST /cadastro/obterTodasMercadorias` (L) |  |
| keyup.enter | inputtext | Meremb: · oi oi-magnifying-glass |  | `obterTodasMercadorias` | `POST /cadastro/obterTodasMercadorias` (L) |  |
| click | button | Pesquisar · oi oi-magnifying-glass |  | `obterTodasMercadorias` | `POST /cadastro/obterTodasMercadorias` (L) |  |
| click | button | Adicionar |  | `adicionarNovaMercadoria` |  |  |
| pageChanged | pagination |  |  | `setPage` | `POST /cadastro/obterTodasMercadorias` (L) |  |

## `moedas-selecao`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | div | cancel · Excluir | ngForOf=n.listaMoedas | `excluir` | `POST /cadastro/removerMoeda` (E)<br>`POST /cadastro/obterTodasMoedas` (L) |  |
| click | div | save · Salvar | ngForOf=n.listaMoedas | `salvar` | `POST /cadastro/salvarMoeda` (E)<br>`POST /cadastro/obterTodasMoedas` (L) |  |
| keyup.enter | inputtext | Moeda: |  | `obterTodasMoedas` | `POST /cadastro/obterTodasMoedas` (L) |  |
| keyup.enter | inputtext | Sigla: |  | `obterTodasMoedas` | `POST /cadastro/obterTodasMoedas` (L) |  |
| keyup.enter | inputtext | Código internacioal: · oi oi-magnifying-glass |  | `obterTodasMoedas` | `POST /cadastro/obterTodasMoedas` (L) |  |
| click | button | Pesquisar · oi oi-magnifying-glass |  | `obterTodasMoedas` | `POST /cadastro/obterTodasMoedas` (L) |  |
| click | button | Adicionar |  | `adicionarNovaMoeda` |  |  |
| pageChanged | pagination |  |  | `setPage` | `POST /cadastro/obterTodasMoedas` (L) |  |

## `navios-selecao`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | div | cancel · Excluir | ngForOf=n.listaNavios | `excluir` | `POST /cadastro/removerNavio` (E)<br>`POST /cadastro/obterTodosNavios` (L) |  |
| click | div | save · Salvar | ngForOf=n.listaNavios | `salvar` | `POST /cadastro/salvarNavio` (E)<br>`POST /cadastro/obterTodosNavios` (L) |  |
| keyup.enter | inputtext | Navio: · oi oi-magnifying-glass |  | `obterTodosNavios` | `POST /cadastro/obterTodosNavios` (L) |  |
| click | button | Pesquisar · oi oi-magnifying-glass |  | `obterTodosNavios` | `POST /cadastro/obterTodosNavios` (L) |  |
| click | button | Adicionar |  | `adicionarNovoNavio` |  |  |
| pageChanged | pagination |  |  | `setPage` | `POST /cadastro/obterTodosNavios` (L) |  |

## `seguradoras-aba-geral`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| onChange | inputselect | Selecione um País · País: |  | `retorna, obterCombosCidadesEstadosPaisesSeguradoras` | `POST /cadastro/obterCombosCidadesEstadosPaisesSeguradoras` (L) |  |
| onChange | inputselect | Selecione um Estado · Estado: |  | `retorna, obterCombosCidadesEstadosPaisesSeguradoras` | `POST /cadastro/obterCombosCidadesEstadosPaisesSeguradoras` (L) |  |

## `app-seguradoras-contatos`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | span |  | ngIf=n.errorMsg | `limpaErrorMsg` |  |  |
| resposta | confirma |  | ngIf=n.exibeConfirmaExcluir | `excluirOK` | `POST /cadastro/removerSeguradoraContato` (E) |  |
| keyup.enter | inputtext | Setor: |  | `salvarSeguradoraContato` | `POST /cadastro/salvarSeguradoraContato` (E) |  |
| click | button | Voltar |  | `voltar` |  |  |
| click | button | Salvar · oi oi-book |  | `salvarSeguradoraContato` | `POST /cadastro/salvarSeguradoraContato` (E) |  |
| click | button | Excluir · oi oi-x |  | `excluir` |  | abre exibeConfirmaExcluir |

## `seguradoras-aba-contatos`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | tr |  | ngForOf=n.listaTodasSeguradorasContatos | `visualizarSeguradoraContato` |  | modal seguradorasContatos |
| click | button | Novo Contato · oi oi-plus | ngIf=!n.visualizacao | `incluirSeguradoraContato` |  | modal seguradorasContatos |
| click | button | × |  | `fechaContatosSeguradora` |  |  |
| resposta | div |  |  | `respostaSeguradoraContato` | `POST /cadastro/obterTodasSeguradorasContatos` (L) |  |

## `seguradoras`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | span |  | ngIf=n.errorMsg | `limpaErrorMsg` |  |  |
| resposta | confirma |  | ngIf=n.exibeConfirmaExcluir | `excluirOK` | `POST /cadastro/removerSeguradora` (E) |  |
| click | button | Voltar · oi oi-book |  | `voltar` |  |  |
| click | button | Salvar · oi oi-book |  | `salvarSeguradora` | `POST /cadastro/salvarSeguradora` (E) |  |
| click | button | Excluir · oi oi-x |  | `excluirSeguradora` |  | abre exibeConfirmaExcluir |

## `seguradoras-selecao`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| dblclick | tr | oi oi-pencil | ngForOf=e.listaSeguradoras | `visualizaSeguradora` |  |  |
| click | button | Editar · oi oi-pencil | ngForOf=e.listaSeguradoras | `visualizaSeguradora` |  |  |
| click | button | Imprimir · oi oi-print | ngForOf=e.listaSeguradoras | `imprimirCliente` |  |  |
| keyup.enter | div |  |  | `pesquisarFiltro` | `POST /cadastro/obterTodasSeguradoras` (L) |  |
| click | button | oi oi-magnifying-glass |  | `pesquisarFiltro` | `POST /cadastro/obterTodasSeguradoras` (L) |  |
| click | label | Código |  | `ordem` | `POST /cadastro/obterTodasSeguradoras` (L) |  |
| click | label | Razão Social |  | `ordem` | `POST /cadastro/obterTodasSeguradoras` (L) |  |
| click | label | Telefone |  | `ordem` | `POST /cadastro/obterTodasSeguradoras` (L) |  |
| click | label | Nome Fantasia |  | `ordem` | `POST /cadastro/obterTodasSeguradoras` (L) |  |
| click | label | Endereço |  | `ordem` | `POST /cadastro/obterTodasSeguradoras` (L) |  |
| click | label | Cidade |  | `ordem` | `POST /cadastro/obterTodasSeguradoras` (L) |  |
| click | label | Estado |  | `ordem` | `POST /cadastro/obterTodasSeguradoras` (L) |  |
| click | label | País |  | `ordem` | `POST /cadastro/obterTodasSeguradoras` (L) |  |
| click | label | Cnpj/Cpf |  | `ordem` | `POST /cadastro/obterTodasSeguradoras` (L) |  |
| click | label | E-mail |  | `ordem` | `POST /cadastro/obterTodasSeguradoras` (L) |  |
| pageChanged | pagination | oi oi-plus |  | `setPage` | `POST /cadastro/obterTodasSeguradoras` (L) |  |
| click | button | Incluir · oi oi-plus |  | `incluirNovoSeguradora` |  |  |
| resposta | seguradoras |  | ngIf=!n.selecao | `respostaSeguradora` | `POST /cadastro/obterTodasSeguradoras` (L) |  |

## `taxas-cambiais-diarias-selecao`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | div | cancel · Excluir | ngForOf=n.listaTaxaDiarias | `excluir` | `POST /cadastro/removerTaxaDiaria` (E)<br>`POST /cadastro/obterTodasTaxaDiarias` (L) |  |
| click | div | save · Salvar | ngForOf=n.listaTaxaDiarias | `salvar` | `POST /cadastro/salvarTaxaDiaria` (E)<br>`POST /cadastro/obterTodasTaxaDiarias` (L) |  |
| keyup.enter | inputdate | Data inicial: |  | `obterTodasTaxaDiarias` | `POST /cadastro/obterTodasTaxaDiarias` (L) |  |
| keyup.enter | inputdate | Data final: |  | `obterTodasTaxaDiarias` | `POST /cadastro/obterTodasTaxaDiarias` (L) |  |
| keyup.enter | inputtext | Moeda: · oi oi-magnifying-glass |  | `obterTodasTaxaDiarias` | `POST /cadastro/obterTodasTaxaDiarias` (L) |  |
| click | button | Pesquisar · oi oi-magnifying-glass |  | `obterTodasTaxaDiarias` | `POST /cadastro/obterTodasTaxaDiarias` (L) |  |
| click | button | Adicionar |  | `adicionarNovaTaxaDiaria` |  |  |
| pageChanged | pagination |  |  | `setPage` | `POST /cadastro/obterTodasTaxaDiarias` (L) |  |

## `cliente-aba-geral`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| onChange | inputselect | Selecione um País · País: |  | `retorna, obterCombosCidadesEstadosPaisesCliente` | `POST /cadastro/obterCombosCidadesEstadosPaisesCliente` (L) |  |
| onChange | inputselect | Selecione um Estado · Estado: |  | `retorna, obterCombosCidadesEstadosPaisesCliente` | `POST /cadastro/obterCombosCidadesEstadosPaisesCliente` (L) |  |

## `app-cliente-contato`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | span |  | ngIf=n.errorMsg | `limpaErrorMsg` |  |  |
| resposta | confirma |  | ngIf=n.exibeConfirmaExcluir | `excluirOK` | `POST /cadastro/removerClienteContato` (E) |  |
| keyup.enter | inputtext | Setor: |  | `salvarClienteContato` | `POST /cadastro/salvarClienteContato` (E) |  |
| click | button | Voltar |  | `voltar` |  |  |
| click | button | Salvar · oi oi-book |  | `salvarClienteContato` | `POST /cadastro/salvarClienteContato` (E) |  |
| click | button | Excluir · oi oi-x |  | `excluir` |  | abre exibeConfirmaExcluir |

## `cliente-aba-contatos`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | tr |  | ngForOf=n.listaTodosClientesContatos | `visualizarClienteContatos` |  | modal clientesContatos |
| click | button | Novo Contato · oi oi-plus | ngIf=!n.visualizacao | `incluirClienteContato` |  | modal clientesContatos |
| click | button | × |  | `fechaContatosClientes` |  |  |
| resposta | div |  |  | `respostaClienteContatos` | `POST /cadastro/listarClientesContatos` (L) |  |

## `clientes`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | span |  | ngIf=n.errorMsg | `limpaErrorMsg` |  |  |
| resposta | confirma |  | ngIf=n.exibeConfirmaExcluir | `excluirOK` | `POST /cadastro/removerCliente` (E) |  |
| click | button | Voltar · oi oi-book |  | `voltar` |  |  |
| click | button | Salvar · oi oi-book |  | `salvarCliente` | `POST /cadastro/salvarCliente` (E) |  |
| click | button | Excluir · oi oi-x |  | `excluirCliente` |  | abre exibeConfirmaExcluir |

## `clientes-selecao`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| dblclick | tr | oi oi-pencil | ngForOf=e.listaClientes | `visualizaCliente` |  |  |
| click | button | Editar · oi oi-pencil | ngForOf=e.listaClientes | `visualizaCliente` |  |  |
| click | button | Imprimir · oi oi-print | ngForOf=e.listaClientes | `imprimirCliente` |  |  |
| keyup.enter | div |  |  | `pesquisarFiltro` | `POST /cadastro/obterTodosClientes` (L) |  |
| click | button | oi oi-magnifying-glass |  | `pesquisarFiltro` | `POST /cadastro/obterTodosClientes` (L) |  |
| click | label | Código |  | `ordem` | `POST /cadastro/obterTodosClientes` (L) |  |
| click | label | Razão Social |  | `ordem` | `POST /cadastro/obterTodosClientes` (L) |  |
| click | label | Telefone |  | `ordem` | `POST /cadastro/obterTodosClientes` (L) |  |
| click | label | Nome Fantasia |  | `ordem` | `POST /cadastro/obterTodosClientes` (L) |  |
| click | label | Endereço |  | `ordem` | `POST /cadastro/obterTodosClientes` (L) |  |
| click | label | Cidade |  | `ordem` | `POST /cadastro/obterTodosClientes` (L) |  |
| click | label | Estado |  | `ordem` | `POST /cadastro/obterTodosClientes` (L) |  |
| click | label | País |  | `ordem` | `POST /cadastro/obterTodosClientes` (L) |  |
| click | label | Cnpj/Cpf |  | `ordem` | `POST /cadastro/obterTodosClientes` (L) |  |
| click | label | E-mail |  | `ordem` | `POST /cadastro/obterTodosClientes` (L) |  |
| click | label | Ativo |  | `ordem` | `POST /cadastro/obterTodosClientes` (L) |  |
| pageChanged | pagination | oi oi-plus |  | `setPage` | `POST /cadastro/obterTodosClientes` (L) |  |
| click | button | Incluir · oi oi-plus |  | `incluirNovoCliente` |  |  |
| resposta | clientes |  | ngIf=!n.selecao | `respostaCliente` | `POST /cadastro/obterTodosClientes` (L) |  |

## `parceiros-aba-geral`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| onChange | inputselect | Selecione um País · País: |  | `retorna, obterCombosCidadesEstadosPaisesParceiro` | `POST /cadastro/obterCombosCidadesEstadosPaisesParceiro` (L) |  |
| onChange | inputselect | Selecione um Estado · Estado: |  | `retorna, obterCombosCidadesEstadosPaisesParceiro` | `POST /cadastro/obterCombosCidadesEstadosPaisesParceiro` (L) |  |

## `app-parceiros-contato`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | span |  | ngIf=n.errorMsg | `limpaErrorMsg` |  |  |
| resposta | confirma |  | ngIf=n.exibeConfirmaExcluir | `excluirOK` | `POST /cadastro/removerParceiroContatos` (E) |  |
| keyup.enter | inputtext | Setor: |  | `salvarParceiroContatos` | `POST /cadastro/salvarParceiroContatos` (E) |  |
| click | button | Voltar |  | `voltar` |  |  |
| click | button | Salvar · oi oi-book |  | `salvarParceiroContatos` | `POST /cadastro/salvarParceiroContatos` (E) |  |
| click | button | Excluir · oi oi-x |  | `excluir` |  | abre exibeConfirmaExcluir |

## `parceiros-aba-contatos`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | tr |  | ngForOf=n.listaTodosParceirosContatos | `visualizarParceiroContatos` |  | modal parceirosContatos |
| click | button | Novo Contato · oi oi-plus | ngIf=!n.visualizacao&&n.parceiroSelecionado.id.cdParceiro | `incluirParceiroContatos` |  | modal parceirosContatos |
| click | button | × |  | `fechaContatosParceiros` |  |  |
| resposta | div |  |  | `respostaParceiroContatos` | `POST /cadastro/obterTodosParceirosContatos` (L) |  |

## `parceiros`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | span |  | ngIf=n.errorMsg | `limpaErrorMsg` |  |  |
| resposta | confirma |  | ngIf=n.exibeConfirmaExcluir | `excluirOK` | `POST /cadastro/removerParceiro` (E) |  |
| click | button | Voltar · oi oi-book |  | `voltar` |  |  |
| click | button | Salvar · oi oi-book |  | `salvarParceiro` | `POST /cadastro/salvarParceiro` (E) |  |
| click | button | Excluir · oi oi-x |  | `excluirParceiro` |  | abre exibeConfirmaExcluir |

## `parceiros-selecao`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| dblclick | tr | oi oi-pencil | ngForOf=e.listaParceiros | `visualizaParceiro` |  |  |
| click | button | Editar · oi oi-pencil | ngForOf=e.listaParceiros | `visualizaParceiro` |  |  |
| click | button | Imprimir · oi oi-print | ngForOf=e.listaParceiros | `imprimirCliente` |  |  |
| keyup.enter | div |  |  | `pesquisarFiltro` | `POST /cadastro/obterTodosParceiros` (L) |  |
| click | button | oi oi-magnifying-glass |  | `pesquisarFiltro` | `POST /cadastro/obterTodosParceiros` (L) |  |
| click | label | Código |  | `ordem` | `POST /cadastro/obterTodosParceiros` (L) |  |
| click | label | Razão Social |  | `ordem` | `POST /cadastro/obterTodosParceiros` (L) |  |
| click | label | Telefone |  | `ordem` | `POST /cadastro/obterTodosParceiros` (L) |  |
| click | label | Nome Fantasia |  | `ordem` | `POST /cadastro/obterTodosParceiros` (L) |  |
| click | label | Endereço |  | `ordem` | `POST /cadastro/obterTodosParceiros` (L) |  |
| click | label | Cidade |  | `ordem` | `POST /cadastro/obterTodosParceiros` (L) |  |
| click | label | Estado |  | `ordem` | `POST /cadastro/obterTodosParceiros` (L) |  |
| click | label | País |  | `ordem` | `POST /cadastro/obterTodosParceiros` (L) |  |
| click | label | Cnpj/Cpf |  | `ordem` | `POST /cadastro/obterTodosParceiros` (L) |  |
| click | label | E-mail |  | `ordem` | `POST /cadastro/obterTodosParceiros` (L) |  |
| click | label | Ativo |  | `ordem` | `POST /cadastro/obterTodosParceiros` (L) |  |
| pageChanged | pagination | oi oi-plus |  | `setPage` | `POST /cadastro/obterTodosParceiros` (L) |  |
| click | button | Incluir · oi oi-plus |  | `incluirNovoParceiro` |  |  |
| resposta | parceiros |  | ngIf=!n.selecao | `respostaParceiro` | `POST /cadastro/obterTodosParceiros` (L) |  |

## `transportadoras-aba-geral`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| onChange | inputselect | Selecione um País · País: |  | `retorna, obterCombosCidadesEstadosPaisesTransportadoras` | `POST /cadastro/obterCombosCidadesEstadosPaisesTransportadoras` (L) |  |
| onChange | inputselect | Selecione um Estado · Estado: |  | `retorna, obterCombosCidadesEstadosPaisesTransportadoras` | `POST /cadastro/obterCombosCidadesEstadosPaisesTransportadoras` (L) |  |

## `app-transportadoras-contatos`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | span |  | ngIf=n.errorMsg | `limpaErrorMsg` |  |  |
| resposta | confirma |  | ngIf=n.exibeConfirmaExcluir | `excluirOK` | `POST /cadastro/removerTransportadoraContato` (E) |  |
| keyup.enter | inputtext | Setor: |  | `salvarTransportadoraContato` | `POST /cadastro/salvarTransportadoraContato` (E) |  |
| click | button | Voltar |  | `voltar` |  |  |
| click | button | Salvar · oi oi-book |  | `salvarTransportadoraContato` | `POST /cadastro/salvarTransportadoraContato` (E) |  |
| click | button | Excluir · oi oi-x |  | `excluir` |  | abre exibeConfirmaExcluir |

## `transportadoras-aba-contatos`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | tr |  | ngForOf=n.listaTodosTransportadorasContatos | `visualizarTransportadoraContatos` |  | modal transportadorasContatos |
| click | button | Novo Contato · oi oi-plus | ngIf=!n.visualizacao | `incluirTransportadoraContatos` |  | modal transportadorasContatos |
| click | button | × |  | `fechaContatosTransportadoras` |  |  |
| resposta | div |  |  | `respostaTransportadoraContatos` | `POST /cadastro/obterTodasTransportadorasContatos` (L) |  |

## `transportadoras`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | span |  | ngIf=n.errorMsg | `limpaErrorMsg` |  |  |
| resposta | confirma |  | ngIf=n.exibeConfirmaExcluir | `excluirOK` | `POST /cadastro/removerTransportadora` (E) |  |
| click | button | Voltar · oi oi-book |  | `voltar` |  |  |
| click | button | Salvar · oi oi-book |  | `salvarTransportadora` | `POST /cadastro/salvarTransportadora` (E) |  |
| click | button | Excluir · oi oi-x |  | `excluirTransportadora` |  | abre exibeConfirmaExcluir |

## `transportadoras-selecao`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| dblclick | tr | oi oi-pencil | ngForOf=e.listaTransportadoras | `visualizaTransportadora` |  |  |
| click | button | Editar · oi oi-pencil | ngForOf=e.listaTransportadoras | `visualizaTransportadora` |  |  |
| click | button | Imprimir · oi oi-print | ngForOf=e.listaTransportadoras | `imprimirCliente` |  |  |
| keyup.enter | div |  |  | `pesquisarFiltro` | `POST /cadastro/obterTodasTransportadoras` (L) |  |
| click | button | oi oi-magnifying-glass |  | `pesquisarFiltro` | `POST /cadastro/obterTodasTransportadoras` (L) |  |
| click | label | Código |  | `ordem` | `POST /cadastro/obterTodasTransportadoras` (L) |  |
| click | label | Razão Social |  | `ordem` | `POST /cadastro/obterTodasTransportadoras` (L) |  |
| click | label | Telefone |  | `ordem` | `POST /cadastro/obterTodasTransportadoras` (L) |  |
| click | label | Nome Fantasia |  | `ordem` | `POST /cadastro/obterTodasTransportadoras` (L) |  |
| click | label | Endereço |  | `ordem` | `POST /cadastro/obterTodasTransportadoras` (L) |  |
| click | label | Cidade |  | `ordem` | `POST /cadastro/obterTodasTransportadoras` (L) |  |
| click | label | Estado |  | `ordem` | `POST /cadastro/obterTodasTransportadoras` (L) |  |
| click | label | País |  | `ordem` | `POST /cadastro/obterTodasTransportadoras` (L) |  |
| click | label | Cnpj/Cpf |  | `ordem` | `POST /cadastro/obterTodasTransportadoras` (L) |  |
| click | label | E-mail |  | `ordem` | `POST /cadastro/obterTodasTransportadoras` (L) |  |
| pageChanged | pagination | oi oi-plus |  | `setPage` | `POST /cadastro/obterTodasTransportadoras` (L) |  |
| click | button | Incluir · oi oi-plus |  | `incluirNovoTransportadora` |  |  |
| resposta | transportadoras |  | ngIf=!n.selecao | `respostaTransportadora` | `POST /cadastro/obterTodasTransportadoras` (L) |  |

## `app-modelos-propostas`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | button | Upload Modelo Proposta · oi oi-cloud-upload | ngIf=n.modelosPropostasSelecionado.imDocx64==null\|\|n.modelosPropostasSelecionado.imDocx64=="" | `click` |  |  |
| click | button | Trocar Modelo Proposta · oi oi-cloud-upload | ngIf=n.modelosPropostasSelecionado.imDocx64!=null&&n.modelosPropostasSelecionado.imDocx64!="" | `click` |  |  |
| resposta | confirma |  | ngIf=n.exibeConfirmaExcluir | `excluirOK` | `POST /cadastro/removerModelosProposta` (E) |  |
| change | input |  |  | `uploadAnexo` |  |  |
| click | div | Voltar |  | `voltar` |  |  |
| click | button | Palavras Chaves |  | `palavrasChaves` | `POST /cadastro/palavrasChaves` (L) |  |
| click | button | Excluir |  | `excluirModelosProposta` |  | abre exibeConfirmaExcluir |
| click | button | Salvar |  | `salvarModelosPropostas` | `POST /cadastro/salvarModelosPropostas` (E) |  |

## `app-modelos-propostas-selecao`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | button | excluir modelo · oi oi-x | ngForOf=e.listaModelosPropostas | `excluirModelosProposta` |  | abre exibeConfirmaExcluir |
| click | button | Download modelo · oi oi-cloud-upload | ngForOf=e.listaModelosPropostas | `visualizar` | `POST /cadastro/obterArquivoModeloProposta` (L) |  |
| onChange | div | Selecionar Tipo |  | `pesquisarFiltro` | `POST /cadastro/obterTodosModelosPropostas` (L) |  |
| onChange | inputselect | Selecionar Cobertura · Cobertura |  | `pesquisarFiltro` | `POST /cadastro/obterTodosModelosPropostas` (L) |  |
| click | button | Pesquisar · oi oi-magnifying-glass |  | `pesquisarFiltro` | `POST /cadastro/obterTodosModelosPropostas` (L) |  |
| click | th | oi oi-plus |  | `incluirNovoModelosPropostas` |  |  |
| click | label | Tipo |  | `ordem` | `POST /cadastro/obterTodosModelosPropostas` (L) |  |
| click | label | Cobertura |  | `ordem` | `POST /cadastro/obterTodosModelosPropostas` (L) |  |
| click | label | Data da versão |  | `ordem` | `POST /cadastro/obterTodosModelosPropostas` (L) |  |
| click | label | Arquivo |  | `ordem` | `POST /cadastro/obterTodosModelosPropostas` (L) |  |
| click | label | Modelo de Proposta |  | `ordem` | `POST /cadastro/obterTodosModelosPropostas` (L) |  |
| pageChanged | div |  |  | `setPage` | `POST /cadastro/obterTodosModelosPropostas` (L) |  |
| resposta | confirma |  | ngIf=n.exibeConfirmaExcluir | `excluirOK` | `POST /cadastro/removerModelosProposta` (E)<br>`POST /cadastro/obterTodosModelosPropostas` (L) |  |
| resposta | app-modelos-propostas |  | ngIf=!n.selecao | `respostaModelosProposta` | `POST /cadastro/obterTodosModelosPropostas` (L) |  |

## `motivo`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | button | × |  | `fechar` |  |  |
| click | button | Sim |  | `confirmar` |  |  |
| click | button | Não |  | `fechar` |  |  |

## `pesquisa-lista`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | td |  | ngForOf=n.lista | `seleciona` |  |  |
| click | td |  | ngForOf=n.lista | `seleciona` |  |  |
| click | button | × |  | `closeModal` |  |  |
| onChange | div |  |  | `pesquisarFiltro` | `POST /"+t.registros[0]+"/"+t.registros[1]` (L) | modal childModal, abre exibeAlertaVoltar |
| onChange | inputtext | Descrição: · oi oi-loop-circular |  | `pesquisarFiltro` | `POST /"+t.registros[0]+"/"+t.registros[1]` (L) | modal childModal, abre exibeAlertaVoltar |
| click | button | oi oi-loop-circular |  | `pesquisarFiltro` | `POST /"+t.registros[0]+"/"+t.registros[1]` (L) | modal childModal, abre exibeAlertaVoltar |
| click | label | Código |  | `ordem` | `POST /"+t.registros[0]+"/"+t.registros[1]` (L) | abre exibeAlertaVoltar |
| click | label | Descrição |  | `ordem` | `POST /"+t.registros[0]+"/"+t.registros[1]` (L) | abre exibeAlertaVoltar |
| pageChanged | pagination |  |  | `setPage` | `POST /"+t.registros[0]+"/"+t.registros[1]` (L) | abre exibeAlertaVoltar |
| click | div | Fechar |  | `closeModal` |  |  |
| click | button | Selecionar |  | `finalizarPesquisa` |  |  |

## `processo-aba-origem-destino`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| onChange | inputselect | Modal: | ngIf=n.menu!="averbacaoDefinitiva" | `obterCombosTransacao` | `POST /averbacao/obterCombosTransacao` (L) |  |
| onChange | inputselect | Selecione o país · País: |  | `obterCombosTransacao` | `POST /averbacao/obterCombosTransacao` (L) |  |
| onChange | inputselect | Selecione o estado · Estado: |  | `obterCombosTransacao` | `POST /averbacao/obterCombosTransacao` (L) |  |
| onChange | inputselect | Selecione o porto |  | `obterCombosTransacao` | `POST /averbacao/obterCombosTransacao` (L) |  |
| onChange | inputselect | Selecione o país · País: |  | `obterCombosTransacao` | `POST /averbacao/obterCombosTransacao` (L) |  |
| onChange | inputselect | Selecione o estado · Estado: |  | `obterCombosTransacao` | `POST /averbacao/obterCombosTransacao` (L) |  |
| onChange | inputselect | Selecione o porto |  | `obterCombosTransacao` | `POST /averbacao/obterCombosTransacao` (L) |  |

## `processo-aba-cartas-protesto`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | td | oi oi-x | ngForOf=n.cartas | `excluir` |  | abre exibeConfirmaExclusao |
| click | button | Imprimir Carta de Protesto · oi oi-print | ngForOf=n.cartas | `imprimeCartaProtestoPDF` | `POST /relatorio/imprimeCartaProtestoPDF` (L (gera documento)) |  |
| resposta | confirma |  | ngIf=n.exibeConfirmaExclusao | `excluirOK` | `POST /averbacao/excluirCartasProtesto` (E) |  |
| click | button | Remover · oi oi-x | ngIf=!n.adicionandoAvaria ∧ ngForOf=e.listaAvariasAux[0] | `removerAvaria` |  | abre exibeConfirmaExcluirAvaria |
| click | button | Remover · oi oi-x | ngIf=!n.adicionandoAvaria ∧ ngForOf=e.listaAvariasAux[1] | `removerAvaria` |  | abre exibeConfirmaExcluirAvaria |
| click | button | × | ngIf=!n.adicionandoAvaria | `fechaModalAvarias` | `POST /averbacao/salvarCartasProtesto` (E) |  |
| click | button | Adicionar · Adicionar Avaria | ngIf=!n.adicionandoAvaria | `adicionarAvaria` |  |  |
| click | button | Confirmar | ngIf=!n.adicionandoAvaria | `fechaModalAvarias` | `POST /averbacao/salvarCartasProtesto` (E) |  |
| click | button | × | ngIf=n.adicionandoAvaria | `fechaModalAvarias` | `POST /averbacao/salvarCartasProtesto` (E) |  |
| click | button | Voltar | ngIf=n.adicionandoAvaria | `` |  |  |
| click | button | Salvar | ngIf=n.adicionandoAvaria | `salvarAvaria` | `POST /cadastro/salvarAvaria` (E)<br>`POST /cadastro/obterTodasAvarias` (L) |  |
| resposta | confirma |  | ngIf=n.exibeConfirmaExcluirAvaria | `removerAvariaOK` | `POST /cadastro/removerAvaria` (E)<br>`POST /cadastro/obterTodasAvarias` (L) |  |
| click | button | Remover · oi oi-x | ngIf=!n.adicionandoDestinatario ∧ ngForOf=e.listaDestinatariosAux[0] | `removerDestinatario` |  | abre exibeConfirmaExcluirDestinatario |
| click | button | Remover · oi oi-x | ngIf=!n.adicionandoDestinatario ∧ ngForOf=e.listaDestinatariosAux[1] | `removerDestinatario` |  | abre exibeConfirmaExcluirDestinatario |
| click | button | × | ngIf=!n.adicionandoDestinatario | `fechaModalDestinatarios` | `POST /averbacao/salvarCartasProtesto` (E) |  |
| click | button | Adicionar · Adicionar Destinatario | ngIf=!n.adicionandoDestinatario | `adicionarDestinatario` |  |  |
| click | button | Confirmar | ngIf=!n.adicionandoDestinatario | `fechaModalDestinatarios` | `POST /averbacao/salvarCartasProtesto` (E) |  |
| click | button | × | ngIf=n.adicionandoDestinatario | `fechaModalDestinatarios` | `POST /averbacao/salvarCartasProtesto` (E) |  |
| click | button | Voltar | ngIf=n.adicionandoDestinatario | `` |  |  |
| click | button | Salvar | ngIf=n.adicionandoDestinatario | `salvarDestinatario` | `POST /cadastro/salvarDestinatario` (E)<br>`POST /cadastro/obterTodosDestinatarios` (L) |  |
| resposta | confirma |  | ngIf=n.exibeConfirmaExcluirDestinatario | `removerDestinatarioOK` | `POST /cadastro/removerDestinatario` (E)<br>`POST /cadastro/obterTodosDestinatarios` (L) |  |
| click | th | oi oi-plus |  | `incluir` | `POST /averbacao/incluirCartasProtesto` (E) |  |

## `processo-sinistro`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | div | Voltar | ngIf=!n.selecao | `voltar` |  |  |
| click | button | Excluir sinistro | ngIf=!n.selecao | `excluirSinistro` |  | abre exibeConfirmaExcluir |
| click | button | Salvar sinistro | ngIf=!n.selecao | `salvarSinistro` | `POST /averbacao/salvarSinistro` (E) |  |
| resposta | confirma |  | ngIf=n.exibeConfirmaExcluir | `excluirOK` | `POST /averbacao/removerSinistro` (E) |  |

## `processo-aba-sinistro`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| dblclick | tr | oi oi-pencil | ngForOf=e.listaSinistro | `visualizaSinistro` |  |  |
| click | button | Editar · oi oi-pencil | ngForOf=e.listaSinistro | `visualizaSinistro` |  |  |
| click | label | Data |  | `ordem` |  |  |
| click | label | Destinatario |  | `ordem` |  |  |
| click | label | E-mail Destinatario: |  | `ordem` |  |  |
| click | label | Contato |  | `ordem` |  |  |
| click | label | Setor Contato: |  | `ordem` |  |  |
| click | label | Texto |  | `ordem` |  |  |
| click | label | Texto 1 |  | `ordem` |  |  |
| click | label | Texto 2 |  | `ordem` |  |  |
| click | label | Tipo Protesto |  | `ordem` |  |  |
| click | button | Voltar · oi oi-plus |  | `voltar` |  |  |
| click | button | Incluir · oi oi-plus |  | `incluirNovoSinistro` |  |  |
| resposta | processo-sinistro |  | ngIf=!n.selecao | `respostaSinistro` | `POST /averbacao/obterTodosSinistros` (L) |  |

## `processo`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | span |  | ngIf=e.errorMsg | `limpaErrorMsg` |  |  |
| click | button | Voltar | ngIf=e.transacaoSelecionado.id.cdTransacao!=null&&e.origemTela!="cotacaoImportacao" | `voltar` |  |  |
| click | button | Salvar · oi oi-book | ngIf=e.transacaoSelecionado.isCotacaoReprovada==!1&&e.transacaoSelecionado.isCotacaoAprovada==!1&&e.transacaoSelecionado.isProvisoriaCancelada==!1&&e.transacaoSelecionado.isDefinitiva==!1&&e.menu!="averbacaoDefinitiva" | `salvar` | `POST /averbacao/salvarTransacao` (E) |  |
| click | button | Salvar Definitiva · oi oi-book | ngIf=e.transacaoSelecionado.isDefinitiva==!0\|\|e.menu=="averbacaoDefinitiva"&&e.transacaoSelecionado.isImportacao==!0 | `salvarDefinitiva` | `POST /averbacao/salvarDefinitiva` (E) |  |
| click | button | Cancelar | ngIf=e.transacaoSelecionado.isProvisoria==!0\|\|e.transacaoSelecionado.isDefinitiva==!0\|\|e.transacaoSelecionado.isExportacao==!0&&e.transacaoSelecionado.isProvisoriaCancelada==!1 | `cancelar` |  | abre exibeConfirmaCancelar |
| click | button | Reprovar | ngIf=e.transacaoSelecionado.isCotacao==!0&&e.transacaoSelecionado.isNovoProcesso==!1&&e.transacaoSelecionado.isCotacaoReprovada==!1&&e.transacaoSelecionado.isCotacaoAprovada==!1 | `reprova` |  | abre exibeConfirmaReprovar |
| click | button | Gerar | ngIf=e.transacaoSelecionado.isProvisoria==!0&&e.menu=="averbacaoProvisoria" | `voltar` |  |  |
| click | button | Concluir | ngIf=e.transacaoSelecionado.isProvisoria==!0&&e.menu=="averbacaoProvisoria"&&e.transacaoSelecionado.isProvisoriaCancelada==!1 | `concluir` |  | abre exibeConfirmaConcluir |
| click | button | Efetuar Cobrança | ngIf=e.transacaoSelecionado.isProvisoria==!0&&e.menu=="averbacaoProvisoria"&&e.transacaoSelecionado.isProvisoriaCancelada==!1 | `cobranca` |  | abre exibeConfirmaCobranca |
| click | button | Adicionar Definitiva | ngIf=e.transacaoSelecionado.isProvisoria==!0&&e.menu=="averbacaoProvisoria"&&e.transacaoSelecionado.isProvisoriaCancelada==!1 | `aprovaDefinitiva` |  | abre exibeConfirmaDefinitiva |
| click | button | Aprovar | ngIf=e.transacaoSelecionado.cdPosicao==e.propostaEmAberto | `aprovaTransacao` |  | abre exibeConfirmaAprovar |
| click | button | Renegociar | ngIf=e.transacaoSelecionado.cdPosicao==e.propostaEmAberto | `renegociar` |  | abre exibeConfirmaRenegocia |
| click | button | Calcular · oi oi-calculator | ngIf=e.transacaoSelecionado.isProvisoriaCancelada==!1 | `calculaTransacao` | `POST /averbacao/calculaTransacao` (L? (cálculo no servidor)) |  |
| resposta | motivo |  | ngIf=n.exibeConfirmaReprovar | `reprovaOK` | `POST /averbacao/reprovarTransacao` (E) |  |
| resposta | confirma |  | ngIf=n.exibeConfirmaExcluir | `excluirOK` | `POST /averbacao/removerTransacao` (E) |  |
| resposta | confirma |  | ngIf=n.exibeConfirmaAprovar | `aprovaTransacaoOK` | `POST /averbacao/aprovaTransacao` (E) |  |
| resposta | confirma |  | ngIf=n.exibeConfirmaRenegocia | `renegociaOK` | `POST /averbacao/salvarTransacao` (E)<br>`POST /averbacao/calculaTransacao` (L? (cálculo no servidor)) |  |
| resposta | confirma |  | ngIf=n.exibeConfirmaDefinitiva | `aprovaDefinitivaOK` | `POST /averbacao/aprovaDefinitiva` (E) |  |
| resposta | confirma |  | ngIf=n.exibeConfirmaCobranca | `cobrancaOK` | `POST /averbacao/cobrancaTransacao` (E) |  |
| resposta | motivo |  | ngIf=n.exibeConfirmaConcluir | `concluirOK` | `POST /averbacao/concluiTransacao` (E) |  |
| resposta | motivo |  | ngIf=n.exibeConfirmaCancelar | `cancelarOK` | `POST /averbacao/cancelarTransacao` (E) |  |

## `editar-posicao-infoline`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | button | × |  | `fecharEditarInfoline` |  |  |
| click | button | Salvar · oi oi-check |  | `salvar` | `POST /averbacao/salvarPosicaoTransacao` (E) | modal loader |

## `seguro`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | span |  | ngIf=n.errorMsg | `limpaErrorMsg` |  |  |
| click | button | Voltar · oi oi-print |  | `voltar` |  |  |
| click | button | Imprimir · oi oi-print |  | `imprimir` |  |  |

## `recibo`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | span |  | ngIf=n.errorMsg | `limpaErrorMsg` |  |  |
| click | button | Voltar · oi oi-print |  | `voltar` |  |  |
| click | button | Imprimir · oi oi-print |  | `imprimir` |  |  |

## `certificado`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | span |  | ngIf=n.errorMsg | `limpaErrorMsg` |  |  |
| click | button | Voltar · oi oi-print |  | `voltar` |  |  |
| click | button | Imprimir · oi oi-print |  | `imprimir` |  |  |

## `cobertura`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | span |  | ngIf=n.errorMsg | `limpaErrorMsg` |  |  |
| click | button | Voltar · oi oi-print |  | `voltar` |  |  |
| click | button | Imprimir · oi oi-print |  | `imprimir` |  |  |

## `processo-selecao`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | label | I.S. | ngIf=e.transacaoSelecionado.cdStatus!=e.DEFINITIVA | `ordem` | `POST /averbacao/obterTodasTransacoes` (L) |  |
| click | label | I.S. | ngIf=e.transacaoSelecionado.cdStatus==e.DEFINITIVA | `ordem` | `POST /averbacao/obterTodasTransacoes` (L) |  |
| click | button | Editar Posição · oi oi-pencil | ngForOf=e.listaTransacao ∧ ngIf=t.paginas.cdUsuario=="Infoline" | `editarPosicao` |  |  |
| click | button | Imprimir proposta em PDF · oi oi-print | ngForOf=e.listaTransacao ∧ ngIf=e.flVerProposta | `imprimePropostaPDF` | `POST /averbacao/obterTransacaoAtualizada` (L)<br>`POST /relatorio/imprimePropostaPDF` (L (gera documento)) |  |
| click | button | Baixar proposta em DocX · oi oi-print | ngForOf=e.listaTransacao ∧ ngIf=e.flVerProposta | `imprimePropostaDocX` | `POST /averbacao/obterTransacaoAtualizada` (L)<br>`POST /relatorio/imprimePropostaDocX` (L (gera documento)) |  |
| click | button | Imprimir proposta · oi oi-file | ngForOf=e.listaTransacao ∧ ngIf=!1 | `visualizaSeguro` | `POST /averbacao/obterTransacaoAtualizada` (L) |  |
| click | button | Imprimir recibo · oi oi-file | ngForOf=e.listaTransacao ∧ ngIf=e.isRecibo | `visualizaRecibo` | `POST /averbacao/obterTransacaoAtualizada` (L) |  |
| click | button | Imprimir certificado · oi oi-box | ngForOf=e.listaTransacao ∧ ngIf=e.isRecibo&&e.cdStatus==2&&e.cdTipo==0 | `visualizaCertificado` | `POST /averbacao/obterTransacaoAtualizada` (L) |  |
| click | button | Emitir Cobertura · oi oi-box | ngForOf=e.listaTransacao ∧ ngIf=e.cdStatus==2&&e.cdTipo==1 | `visualizaCobertura` | `POST /averbacao/obterTransacaoAtualizada` (L) |  |
| dblclick | tr | oi oi-pencil | ngForOf=e.listaTransacao | `visualizaTransacao` | `POST /averbacao/obterTransacaoAtualizada` (L) |  |
| click | button | Editar · oi oi-pencil | ngForOf=e.listaTransacao | `visualizaTransacao` | `POST /averbacao/obterTransacaoAtualizada` (L) |  |
| keyup.enter | div |  |  | `obterTodasTransacoes` | `POST /averbacao/obterTodasTransacoes` (L) |  |
| click | button | oi oi-reload |  | `obterTodasTransacoes` | `POST /averbacao/obterTodasTransacoes` (L) |  |
| click | label | Processo |  | `ordem` | `POST /averbacao/obterTodasTransacoes` (L) |  |
| click | label | Data |  | `ordem` | `POST /averbacao/obterTodasTransacoes` (L) |  |
| click | label | Cliente |  | `ordem` | `POST /averbacao/obterTodasTransacoes` (L) |  |
| click | label | Parceiro |  | `ordem` | `POST /averbacao/obterTodasTransacoes` (L) |  |
| click | label | Tipo |  | `ordem` | `POST /averbacao/obterTodasTransacoes` (L) |  |
| click | label | Status |  | `ordem` | `POST /averbacao/obterTodasTransacoes` (L) |  |
| click | label | Posição |  | `ordem` | `POST /averbacao/obterTodasTransacoes` (L) |  |
| click | label | Prêmio US$ |  | `ordem` | `POST /averbacao/obterTodasTransacoes` (L) |  |
| click | label | Número averbação |  | `ordem` | `POST /averbacao/obterTodasTransacoes` (L) |  |
| click | label | Moeda |  | `ordem` | `POST /averbacao/obterTodasTransacoes` (L) |  |
| click | label | Saldo |  | `ordem` | `POST /averbacao/obterTodasTransacoes` (L) |  |
| click | label | Percentual |  | `ordem` | `POST /averbacao/obterTodasTransacoes` (L) |  |
| resposta | processo |  | ngIf=n.isTransacaoSelecionada | `respostaTransacao` | `POST /averbacao/obterTodasTransacoes` (L) |  |
| resposta | seguro |  | ngIf=n.isSeguroImpressao | `respostaSeguro` | `POST /averbacao/obterTodasTransacoes` (L) |  |
| resposta | recibo |  | ngIf=n.isReciboImpressao | `respostaRecibo` | `POST /averbacao/obterTodasTransacoes` (L) |  |
| resposta | certificado |  | ngIf=n.isCertificadoImpressao | `respostaCertificado` | `POST /averbacao/obterTodasTransacoes` (L) |  |
| resposta | cobertura |  | ngIf=n.isCoberturaImpressao | `respostaCobertura` | `POST /averbacao/obterTodasTransacoes` (L) |  |
| resposta | editar-posicao-infoline |  |  | `respostaEditarPosicao` | `POST /averbacao/obterTodasTransacoes` (L) |  |

## `irb-emitida`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | span |  | ngIf=n.errorMsg | `limpaErrorMsg` |  |  |
| click | button | Salvar · oi oi-book | ngIf=n.isDtPagamentoVazia | `salvar` | `POST /numerario/salvarIrb` (E) |  |
| click | button | Voltar |  | `voltar` |  |  |

## `emissao-rme`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | div | Voltar · oi oi-print | ngIf=n.selecaoEmissaoRme | `voltar` |  |  |
| click | button | Imprimir · oi oi-print | ngIf=n.selecaoEmissaoRme | `imprimir` |  |  |

## `planilha-irb`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | span |  | ngIf=n.selecaoPlanilhaIrb ∧ ngIf=e.errorMsg | `limpaErrorMsg` |  |  |
| click | div | oi oi-print | ngIf=n.selecaoPlanilhaIrb ∧ ngForOf=e.listaApoliceTransacao | `visualizaEmissaoRme` |  |  |
| click | div | oi oi-print | ngIf=n.selecaoPlanilhaIrb ∧ ngForOf=e.listaApoliceTransacaoProrrogacao | `visualizaEmissaoRme` |  |  |
| click | button | Voltar · oi oi-print | ngIf=n.selecaoPlanilhaIrb | `voltar` |  |  |
| click | button | Imprimir · oi oi-print | ngIf=n.selecaoPlanilhaIrb | `imprimir` |  |  |

## `editar-infoline`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | button | × |  | `fecharEditarInfoline` |  |  |
| click | div | Limpar Data · oi oi-trash |  | `limparData` |  |  |
| click | button | Salvar · oi oi-check |  | `salvar` | `POST /numerario/salvarNumerarioEditarInfoline` (E) | modal loader |

## `numerario-impressao`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | span |  | ngIf=n.selecaoPlanilhaIrb ∧ ngIf=e.errorMsg | `limpaErrorMsg` |  |  |
| click | button | Voltar · oi oi-print | ngIf=n.selecaoPlanilhaIrb | `voltar` |  |  |
| click | button | Imprimir · oi oi-print | ngIf=n.selecaoPlanilhaIrb | `imprimir` |  |  |

## `numerario`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | span |  | ngIf=e.errorMsg | `limpaErrorMsg` |  |  |
| click | button | Salvar · oi oi-book | ngIf=e.numerarioSelecionado.isNumerarioPago==!1 | `salvar` | `POST /numerario/salvarNumerario` (E) |  |
| click | button | Baixar · oi oi-book | ngIf=e.numerarioSelecionado.isNumerarioPago==!1 | `baixar` | `POST /numerario/baixarNumerario` (E) | abre exibeConfirma |
| click | button | Calcular · oi oi-calculator |  | `calculaNumerario` | `POST /numerario/calculaNumerario` (L? (cálculo no servidor)) |  |
| click | button | Voltar · oi oi-print |  | `voltar` |  |  |
| click | button | Ver Numerário · Ver numerário · oi oi-print |  | `visualizaNumerarioImpressao` |  |  |
| resposta | confirma |  | ngIf=n.exibeConfirma | `difOK` | `POST /numerario/baixarNumerario` (E) | abre exibeConfirma |

## `numerario-selecao`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | label | Data Pagamento | ngIf=e.filtroTransacao.isNumerarioPago | `ordem` | `POST /numerario/obterTodasTransacoes` (L) |  |
| click | button | Editar · oi oi-pencil | ngForOf=e.listaTransacao | `visualizaNumerario` | `POST /numerario/obterNumerario` (L)<br>`POST /numerario/obterTransacoesNumerario` (L) |  |
| click | button | Editar Infoline · oi oi-pencil | ngForOf=e.listaTransacao | `visualizaNumerarioEditarInfoline` | `POST /numerario/obterNumerario` (L)<br>`POST /numerario/obterTransacoesNumerario` (L) |  |
| click | button | Solicitar Numerário · oi oi-plus | ngIf=e.filtroTransacao.isNumerarioChequeIRB==!1&&e.filtroTransacao.isNumerarioPago==!1 | `solicitarNumerario` | `POST /numerario/solicitarNumerario` (E)<br>`POST /numerario/obterTodasTransacoes` (L) |  |
| click | button | Emitir IRB · oi oi-check | ngIf=e.filtroTransacao.isNumerarioChequeIRB | `emitirIrb` | `POST /numerario/emitirIrb` (E)<br>`POST /numerario/obterTodasTransacoes` (L) |  |
| keyup.enter | div |  |  | `obterTodasTransacoes` | `POST /numerario/obterTodasTransacoes` (L) |  |
| click | button | oi oi-reload |  | `obterTodasTransacoes` | `POST /numerario/obterTodasTransacoes` (L) |  |
| click | label | Processo |  | `ordem` | `POST /numerario/obterTodasTransacoes` (L) |  |
| click | label | Tipo |  | `ordem` | `POST /numerario/obterTodasTransacoes` (L) |  |
| click | label | Status |  | `ordem` | `POST /numerario/obterTodasTransacoes` (L) |  |
| resposta | numerario |  | ngIf=!n.selecao | `respostaNumerario` | `POST /numerario/obterTodasTransacoes` (L) |  |
| resposta | editar-infoline |  |  | `respostaEditarInfoline` | `POST /numerario/obterTodasTransacoes` (L) |  |

## `comissao-emitida`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | span |  | ngIf=n.errorMsg | `limpaErrorMsg` |  |  |
| click | button | Salvar · oi oi-book | ngIf=n.isDtPagamentoVazia | `salvar` | `POST /numerario/salvarComissao` (E) |  |
| pageChanged | div |  |  | `setPage` | `POST /numerario/obterTransacoesComissoes` (L) |  |
| click | button | Voltar · oi oi-print |  | `voltar` |  |  |
| click | button | Imprimir · oi oi-print |  | `imprimirSolicitacaoNF` | `POST /numerario/imprimirSolicitacaoNF` (L (gera documento)) |  |

## `comissao-emitida-selecao`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| dblclick | tr | oi oi-pencil | ngForOf=e.listaComissao | `visualizaComissao` |  |  |
| click | button | Editar · oi oi-pencil | ngForOf=e.listaComissao | `visualizaComissao` |  |  |
| keyup.enter | div |  |  | `obterTodasComissoes` | `POST /numerario/obterTodasComissoes` (L) |  |
| click | button | Pesquisar · oi oi-reload |  | `obterTodasComissoes` | `POST /numerario/obterTodasComissoes` (L) |  |
| click | button | Limpar Filtro · oi oi-trash |  | `limparFiltro` | `POST /numerario/obterTodasComissoes` (L) |  |
| pageChanged | div |  |  | `setPage` | `POST /numerario/obterTodasComissoes` (L) |  |
| resposta | comissao-emitida |  | ngIf=!n.selecao | `respostaComissao` | `POST /numerario/obterTodasComissoes` (L) |  |

## `irb-emitida-selecao`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| dblclick | tr | oi oi-pencil | ngForOf=e.listaIrb | `visualizaIrb` | `POST /numerario/obterTransacoesIrbs` (L) |  |
| click | button | Editar · oi oi-pencil | ngForOf=e.listaIrb | `visualizaIrb` | `POST /numerario/obterTransacoesIrbs` (L) |  |
| click | button | Visualizar Planilha IRB · oi oi-print | ngForOf=e.listaIrb | `visualizaPlanilhaIrb` | `POST /numerario/obterTransacoesIrbs` (L) |  |
| keyup.enter | div | Filtro IRB |  | `obterTodasIrbs` | `POST /numerario/obterTodasIrbs` (L) |  |
| click | button | oi oi-reload |  | `obterTodasIrbs` | `POST /numerario/obterTodasIrbs` (L) |  |
| pageChanged | div |  |  | `setPage` | `POST /numerario/obterTodasIrbs` (L) |  |
| resposta | planilha-irb |  | ngIf=n.selecaoPlanilhaIrb | `respostaPlanilhaIrb` | `POST /numerario/obterTodasIrbs` (L) |  |
| resposta | irb-emitida |  | ngIf=n.selecaoIrbEmitida | `respostaIrbEmitida` | `POST /numerario/obterTodasIrbs` (L) |  |

## `pagamento-comissao-selecao`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| dblclick | tr |  | ngForOf=e.listaTransacao | `visualizaNumerario` |  |  |
| change | input |  | ngForOf=e.listaTransacao | `gravaListaSelecionados` |  |  |
| click | button | Limpar Seleção · oi oi-x | ngIf=e.listaTransacaoSelecionada.length>0 | `excluirSelecao` | `POST /numerario/obterTodasTransacoesPagamentosComissoes` (L) |  |
| keyup.enter | div |  |  | `obterTodasTransacoesPagamentosComissoes` | `POST /numerario/obterTodasTransacoesPagamentosComissoes` (L) |  |
| click | button | Pesquisar · oi oi-reload |  | `obterTodasTransacoesPagamentosComissoes` | `POST /numerario/obterTodasTransacoesPagamentosComissoes` (L) |  |
| click | button | Limpar Filtro · oi oi-trash |  | `limparFiltro` | `POST /numerario/obterTodasTransacoesPagamentosComissoes` (L) |  |
| click | label | Processo |  | `ordem` | `POST /numerario/obterTodasTransacoesPagamentosComissoes` (L) |  |
| click | button | Solicitar Nota Fiscal · oi oi-plus |  | `solicitarNotaFiscal` | `POST /numerario/solicitarNotaFiscal` (E)<br>`POST /numerario/obterTodasTransacoesPagamentosComissoes` (L) |  |

## `nota-fiscal`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | button | Gerar | ngIf=n.emissaoNF==null | `gerar` | `POST /NotaFiscal/obterTodasNf` (L) |  |

## `NfEmitida`

| Evento | Elemento | Rótulo / título / ícone | Visível / habilitado quando | Método | Endpoint (L/E) | Efeito no front |
|---|---|---|---|---|---|---|
| click | td | oi oi-pencil | ngForOf=e.listaNotasEmitidas | `visualizaNotaEmitida` |  |  |
| keyup.enter | div |  |  | `pesquisar` | `POST /NotaFiscal/listarNfEmitida` (L) |  |
| click | button | Pesquisar |  | `pesquisar` | `POST /NotaFiscal/listarNfEmitida` (L) |  |
| resposta | nota-fiscal |  | ngIf=!n.selecao | `respostaNotaEmitida` | `POST /NotaFiscal/listarNfEmitida` (L) |  |
