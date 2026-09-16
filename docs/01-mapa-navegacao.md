# Mapa de navegação — plataforma legada (Coomex Hub / pinhoV2)

Base: `http://142.93.2.186:8080/pinhoV2/#/`
Cliente/tenant observado: **Pinho** — usuário `William Ruytina`. Rodapé: Infoline Systems.
SPA com roteamento por hash (`#/Rota/Menu`). Layout: sidebar fixa à esquerda + header com título centralizado.

## Home (`#/admin`) — "Atalhos do Sistema"
Grid de cards de atalho + campo "Filtrar Atalhos". Atalhos padrão:
- Listar Cotações -> Em Aberto
- Listar Novas Cotações
- Listar Pendências -> Provisória/Definitiva
- Nova Cotação - Exportação
- Nova Cotação - Importação

## Sistema
### Cadastros Gerais
| Item | Rota |
|---|---|
| Usuários | `#/ContaUsuarioSelecao/Menu` |
| Cadastro de Países | `#/CadastroPaisesSelecao/Menu` |
| Cadastro de Estados | `#/CadastroEstadosSelecao/Menu` |
| Cadastro de Cidades | `#/CadastroCidadesSelecao/Menu` |
| Cadastro de Aeroportos/Portos | `#/AeroportosPortosSelecao/Menu` |
| Cadastro de Apólices | `#/ApolicesSelecao/Menu` |
| Cadastro de Clientes | `#/ClientesSelecao/Menu` |
| Cadastro de Coberturas | `#/CoberturasSelecao/Menu` |
| Cadastro de E-mails | `#/EmailsSelecao/Menu` |
| Cadastro de Embalagens | `#/EmbalagensSelecao/Menu` |
| Cadastro de Vistorias | `#/VistoriadoresSelecao/Menu` |
| Cadastro de Funcionarios | `#/FuncionariosSelecao/Menu` |
| Cadastro de Mercadorias | `#/MercadoriasSelecao/Menu` |
| Cadastro de Moedas | `#/MoedasSelecao/Menu` |
| Cadastro de Navios | `#/NaviosSelecao/Menu` |
| Cadastro de Parceiros | `#/ParceirosSelecao/Menu` |
| Cadastro de Seguradoras | `#/SeguradorasSelecao/Menu` |
| Cadastro de Taxas Cambiais Diárias | `#/TaxasCambiaisDiariasSelecao/Menu` |
| Cadastro de Transportadoras | `#/TransportadorasSelecao/Menu` |
| Cadastro de Modelos de Propostas | `#/ModelosPropostaSelecao/Menu` |

### Averbações
| Item | Rota |
|---|---|
| Nova Cotação - Importação | `#/CotacaoImportacao/Menu` |
| Nova Cotação - Exportação | `#/CotacaoExportacao/Menu` |
| Listar Novas Cotações | `#/ProcessosNovos/Menu` |
| Listar Cotações -> Em Aberto | `#/ProcessosAbertos/Menu` |
| Listar Pendências -> Provisória/Definitiva | `#/ProcessosProvisorias/Menu` |

### Financeiro
| Item | Rota |
|---|---|
| Solicitar numerário | `#/NumerarioSelecao/Menu` |
| Numerários Pagos | `#/NumerariosPagos/Menu` |
| Pagamento de Intermediação de Negocios | `#/PagamentoComissaoSelecao/Menu` |
| Pagamento de Intermediação de Negocios Funcionário | `#/emContrucao/Menu` (não implementado) |
| Intermediação de Negocios Emitidas | `#/ComissaoEmitidaSelecao/Menu` |
| Emissão IRB | `#/NumerariosChequeIRB/Menu` |

## Relatórios
### Emissões
| Item | Rota |
|---|---|
| Emissão NF | `#/Nf/Menu` |
| NF's Emitidas | `#/NfEmitida/Menu` |

### Impressões
| Item | Rota |
|---|---|
| Impressão de Provisórias | `#/ImpressaoProvisoria/Menu` |
| Impressão de Definitivas | `#/ImpressaoDefinitiva/Menu` |

### Arquivos
| Item | Rota |
|---|---|
| Arquivo de Provisórias | `#/ArquivoProvisoria/Menu` |
| Arquivo de Definitivas | `#/ArquivoDefinitiva/Menu` |

### Rankings
| Item | Rota |
|---|---|
| Ranking Apolice | `#/RankingApolice/Menu` |
| Ranking Cliente | `#/RankingCliente/Menu` |
| Ranking Estado | `#/RankingEstado/Menu` |
| Ranking Parceiro | `#/RankingParceiro/Menu` |
| Relatório de Produção | `#/RelatorioProducao/Menu` |
| Relatório de Saldo Provisórias | `#/emContrucao/Menu` (não implementado) |
| Mapa | `#/emContrucao/Menu` (não implementado) |

---

## Rotas existentes no código mas **ausentes do menu**

Extraídas do bundle Angular: **85 rotas no código × 38 no menu**.
Lista completa e comentada em [09-api-legado.md](09-api-legado.md).

Destaques do domínio de seguros:

| Rota | O que é | Situação |
|---|---|---|
| `PerfilSelecao/:origem` | Cadastro de perfis e permissões | **funciona** — acessada e mapeada |
| `ProcessosProrrogacoes/:origem` | Definitivas em Prorrogação | funciona, 0 registros |
| `AverbacaoProvisoria` / `AverbacaoDefinitiva` | telas de averbação | não acessadas |
| `Certificado` · `Recibo` · `Seguro` · `Cobertura` · `Processo` | documentos e detalhes | não acessadas |
| `PlanilhaIrb` · `IrbEmitida` · `IrbEmitidaSelecao` · `EmissaoRme` | resseguro / RME | não acessadas |
| `NumerarioImpressao` · `ObservacaoSelecao` · `EmpresaSelecao` | apoio | não acessadas |
| `alterarSenha` · `AlteracaoImagemUsuario` | perfil do próprio usuário | não acessadas |
| `ComandosSqlSelecaoComponent` | **console de SQL arbitrário** | ⚠️ não acessada (executaria escrita) |

## Telas apontando para `#/emContrucao` (nunca implementadas)
- Financeiro › *Pagamento de Intermediação de Negócios Funcionário*
- Relatórios › Rankings › *Relatório de Saldo Provisórias*
- Relatórios › Rankings › *Mapa*
