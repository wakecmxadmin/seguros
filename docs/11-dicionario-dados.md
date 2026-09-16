# Dicionário de dados do legado

Campos reais extraídos do bundle do frontend (`main-*.js`). São os nomes das colunas trafegadas pela API,
que espelham o esquema do banco Oracle/SQL Server por trás.

A convenção de prefixos está documentada em [09-api-legado.md](09-api-legado.md).

> Filtrado para o **domínio de seguros**. O bundle é compartilhado com um ERP completo da Infoline,
> então centenas de campos fiscais/produção/estoque foram omitidos.

## Valores monetários da transação (`vl*`)

### Verbas que compõem a Importância Segurada
| Campo | Significado |
|---|---|
| `vlMercadoria` | valor da mercadoria (linha "Custo") |
| `vlFrete` | frete |
| `vlDespesa` | despesas (calculada por `vlPercentualDespesa`) |
| `vlLucroEsperado` | lucros esperados (calculada por `vlPercentualLucroEsperado`) |
| `vlImpostos` | impostos |
| `vlCif` | valor CIF (exclusivo da exportação) |
| `vlImportanciaSegurada` | **I.S.** — soma das verbas |
| `vlPercentualDespesa` / `vlPercentualLucroEsperado` | percentuais (default 10,00) |

### Prêmio por verba e por lado
| Cliente | Seguradora |
|---|---|
| `vlPremioCustoCliente` | `vlPremioCustoSeguradora` |
| `vlPremioFreteCliente` | `vlPremioFreteSeguradora` |
| `vlPremioDespesasCliente` | `vlPremioDespesasSeguradora` |
| `vlPremioLucroEsperadoCliente` | `vlPremioLucroEsperadoSeguradora` |
| `vlPremioImpostoCliente` | `vlPremioImpostoSeguradora` |
| `vlFinalPremioCliente` | `vlFinalPremioSeguradora` |
| `vlFinalPremioClienteDolar` | `vlFinalPremioSeguradoraDolar` |
| `vlFinalPremioClienteReais` | `vlFinalPremioSeguradoraReais` |
| `vlPremioMinimoCliente` | — (o mínimo **não** se aplica ao lado seguradora) |

Confirma a regra do prêmio mínimo documentada em [04-regras-calculo.md](04-regras-calculo.md):
existe `vlPremioMinimoCliente` e a flag `flCalculadoMinimo`, mas nenhum equivalente do lado seguradora.

### Resultado e rentabilidade
`vlResultado` · `vlResultadoDolar` · `vlResultadoOperacional` · `vlResultadoPinho` ·
`vlResultadoOperacionalPinho` · `vlDiferenca` · `vlDiferencaDolar` · `vlDiferencaReal` ·
`vlTotalPremioLiquido` · `vlPremioLiqOverSComiReal`

### Over e adicionais
`vlOver` · `vlPremioOverDolar` · `vlPremioOverReal` · `vlPremioOverRealPinho` ·
`vlAdicionalCarta` (exportação) · `vlAdicionalNavio` · `vlTaxaAdicionalNavio` ·
`vlTaxaAdicionalNavioPremio` · `vlClassificacaoNavio` · **`vlDolarAPagarAgravo20`**

> Note: o campo é `vlDolarAPagarAgravo20`, mas a **Planilha Produção** exibe a coluna
> "A Pagar Seguradora **AGRAVO 25%** USD" — o percentual do agravo mudou sem renomear o campo.
> Confirmar a regra vigente com o cliente antes de implementar.

### Comissões
`vlComissao` · `vlComissaoDolar` · `vlComissaoReal` · `vlComissaoParceiro` ·
`vlComissaoParceiroDolar` · `vlComissaoParceiroReal` · `vlComissaoParceiroRealPinho` ·
`vlComissaoFuncionario` · `vlComissaoVetor` · `vlComissaoVetorPinho` ·
`vlComissaoFidcargoDolar` · `vlTotalComissaoParceiroReal` · `pcComissao` · `tpComissao`

### IRB / resseguro
`vlIrb` · `vlIrbDolar` · `vlIrbReal` · `vlIrbPinho` · `vlPremioIrbDolar` · `vlPremioIrbReal` ·
`vlTotalIrb` · `txIrb` · `tpIrb` · `dtIrb` · `cdIrb` · `nuCobrancaIrb` · `txIrbProrrogada`

### Prorrogação
`vlProrrogacaoCliente` · `vlProrrogacaoClienteReal` · `vlProrrogadaCliente` ·
`vlProrrogadaClienteReal` · `vlProrrogadaSeguradoraDolar` · `vlDiferencaDolarProrrogada` ·
`vlDiferencaRealProrrogada` · `vlRealAPagarProrrogada` · `vlDolarAPagarProrrogada` ·
`txDolarNumerarioProrrogada` · `flProrrogacao`

### Numerário / financeiro
`vlSolicitado` · `vlRecebido` · `vlSaldo` · `vlCredito` · `vlPagamentoAnterior` ·
`vlPagamentoAnteriorReal` · `vlDolarAPagar` · `vlRealAPagar` · `vlPgSegReal` ·
`vlFaturamentoMinimo` · `vlFatMinimoRetencaoIrrf` · `vlFatAcumuladoRetencao` · `pcIrrfRetencao`

> Há **retenção de IRRF** com faturamento mínimo acumulado — regra fiscal que não aparece em nenhuma
> tela mapeada, mas existe no modelo.

## Taxas (`tx*`)
| Campo | Significado |
|---|---|
| `txBasicaCliente` / `txBasicaSeguradora` | taxa básica por lado |
| `txAdicionalCliente` / `txAdicionalSeguradora` | taxa adicional |
| `txGuerraGreveCliente` / `txGuerraGreveSeguradora` | GTM/GMCC |
| `txGuerraGreveImpostoCliente` | GTM/GMCC sobre impostos |
| `txTotalSeguradora` | soma das taxas do lado seguradora |
| `txCliente` / `txClienteAereo` | taxa do cliente (geral / aérea) |
| `txSeguradora` / `txSeguradoraAereo` | taxa da seguradora (geral / aérea) |
| `txNegociada` | taxa negociada (override) |
| `txImposto` | taxa aplicada sobre impostos |
| `txMoeda` / `txDolar` / `vlTaxaDiaria` | câmbio |
| `txDolarNumerario` | câmbio usado na emissão do numerário |
| `txDolarMaiorPeriodo` | maior cotação do período |

> `txDolarNumerario` separado de `txDolar` confirma que o câmbio da **cotação** e o da **cobrança**
> são registrados em momentos diferentes — daí as colunas "Dif USD" / "Dif R$" da Planilha Produção.

## Flags do domínio (`fl*`)
| Campo | Significado |
|---|---|
| `flGuerraGreve` | cobertura Guerra e Greve |
| `flMaquinaRefrigeracao` | Paralisação Máquina/Refrigeração |
| `flDespesas` / `flLucroEsperados` | verbas acessórias marcadas |
| `flCalculadoMinimo` | prêmio mínimo aplicado |
| `flCoberturaUnica` | cobertura única (cadastro de coberturas) |
| `flTransacaoUnica` | **"Provisória única"** do formulário de importação |
| `flCarta` / `flCartaCobranca` | Carta de Crédito / carta de cobrança |
| `flCertificado` / `flCertificadoGarantia` | emissão de certificado |
| `flProrrogacao` | processo prorrogado |
| `flAereo` | modal aéreo |
| `flAdicionalNavioSeguradora` / `flAdicionalPagamentoNavioCliente` | adicional de navio por lado |
| `flDespesaNaoCliente` · `flFreteNaoCliente` · `flMercadoriaNaoCliente` · `flLucroEsperadoNaoCliente` · `flImpostosNaoCliente` | verba **não cobrada do cliente** (fica só no lado seguradora) |
| `flSituacaoMercadoria` | mercadoria Nova/Usada |
| `flIi` · `flIpi` · `flIcms` · `flPis` · `flCofins` | impostos marcados |
| `flPermiteSolicitarNumerario` | flag do cadastro de usuário |
| `flPermiteAcessoExterno` · `flGloPermissaoPorMenu` · `flPermitido` | permissões |
| `flVerProposta` · `flArquivoDisponivel` | visibilidade de documentos |
| `flAtivo` / `flStatus` | ativo/inativo |

> A família `fl*NaoCliente` é uma regra de negócio que **não aparece em nenhuma tela mapeada**:
> permite que uma verba entre na base da seguradora mas não seja repassada ao cliente.
> Vale confirmar com o cliente se ainda é usada.

## Identificadores e chaves
`cdEmpresa` (tenant, presente em quase tudo) · `cdTransacao` (o processo) · `cdCliente` · `cdParceiro` ·
`cdSeguradora` · `cdApolice` · `cdCobertura` · `cdMercadoria` · `cdEmbalagem` · `cdNavio` · `cdMoeda` ·
`cdModal` · `cdPais` / `cdPaisOrigem` · `cdEstado` · `cdCidade` · `cdFuncionario` · `cdTransportadora` ·
`cdStatus` · `cdPosicao` · `cdTipo` · `cdComissao` · `cdIrb` · `cdPerfil` · `cdMenu` · `cdUsuario` ·
`cdContaUsuario` · `cdRestricao` · `cdFormaCobranca` · `cdTipoEmissao`

`nuAverbacao` · `nuApolice` · `nuCnpj` / `nuCpf` · `nuConhecimentoEmbarque` (BL/AWB) · `nuContainer` ·
`nuEmbalagemNumero` / `nuEmbalagemNumeroPinho` · `nuCheque` · `nuTelefone` · `nuCep`

> `nuConhecimentoEmbarque` (BL/AWB) e `nuContainer` existem no modelo mas **não apareceram em nenhum
> formulário mapeado** — provavelmente preenchidos na tela de averbação definitiva.

## Envelope de paginação (padrão de toda a API)
`nuPagina` · `qtPaginas` · `qtRegistrosPorPagina` · `qtRegistros` · `registros` · `deMensagem` ·
`nuConsulta` · `deParametro` · `deTituloPagina`

Preferência por usuário: `buscaQtRegistrosPaginaUsuario` / `salvarQtRegistrosPaginaUsuario`
(explica o campo "15" / "35" ao lado da paginação).

## Filtros padronizados
`dtInicialFiltro` · `dtFinalFiltro` · `cdTransacaoInicialFiltro` · `cdTransacaoFinalFiltro` ·
`nuAverbacaoIncialFiltro` *(sic — erro de grafia no original)* · `nuAverbacaoFinalFiltro`
