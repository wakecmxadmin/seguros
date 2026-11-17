# Núcleo de processos do legado — engenharia reversa do bundle

Análise **estática** do bundle Angular do Coomex Hub (`main-S4VFPNOX.js`), sem acesso ao servidor.
Complementa e corrige [02](02-cotacao-importacao.md), [03](03-cotacao-exportacao.md),
[04](04-regras-calculo.md) e [08](08-fluxos.md). Nomes entre crases são os identificadores reais
do bundle (campos do objeto `Transacao`, métodos, endpoints).

Componentes cobertos: `processo` (tela central), as abas `processo-aba-*`, `processo-sinistro`,
`processo-selecao` (listagem), `editar-posicao-infoline`, `motivo`, `confirma` e os *wrappers* de rota.

> **Achado principal:** o cliente **não calcula nada**. Toda a matemática do seguro (verbas derivadas,
> I.S., prêmios, conversão cambial, prêmio mínimo, saldo) é feita no servidor em
> `/averbacao/calculaTransacao`; a tela só exibe o objeto devolvido. As fórmulas do doc 04 descrevem
> o comportamento do **servidor** e continuam sendo a referência — não há nenhuma fórmula no front
> para copiar.

---

## 1. Convenções técnicas do legado

| Item | Comportamento |
|---|---|
| Envelope de toda chamada | `POST` com objeto `Paginas`: `{nuPagina, qtRegistrosPorPagina, nuConsulta, qtPaginas, cdEmpresa, cdRestricao, cdUsuario, deParametro, registros:[...]}` |
| Payload das ações do processo | `registros = [transacaoSelecionado]` — **o objeto inteiro** da transação vai em toda ação (salvar, calcular, aprovar…) |
| `deParametro` | Usado como "modo": recebe o `menu` (`cotacaoImportacao`, `cotacaoExportacao`, `averbacaoProvisoria`, `averbacaoDefinitiva`) em `salvarTransacao`, `salvarDefinitiva`, `calculaTransacao`, `aprovaTransacao`, `aprovaDefinitiva`. Nas listas, recebe `"coluna,asc|desc"` para ordenação |
| Resposta | `{deMensagem, registros, …}`. `deMensagem` vazio = sucesso; preenchido = erro exibido em modal vermelho |
| Checkbox (`inputcheck`) | emite `-1` quando marcado e `0` quando desmarcado; a tela converte com `validaCheckBox(v) = (v == -1)` |
| Telas "minimizáveis" | `processo` e `processo-selecao` guardam estado em `authService.buffer` e podem ser minimizadas para a barra (rota `/:origem = minimizado` restaura) |
| Serviço de cadastro | `serviceCadastro.obterListaApolice/Modal/Seguradoras/Porto/Embalagem/Moeda/Funcionario`, `obterTodasAvarias`, `salvarAvaria`, etc. não estão definidos neste chunk (provavelmente `/cadastro/<método>` em chunk lazy) |

---

## 2. Rotas e modos

### 2.1 Tela de processo (`processo`, input `menu`)

| Rota | Wrapper | `menu` | Título exibido |
|---|---|---|---|
| `#/CotacaoImportacao/:origem` | `cotacao-importacao` | `cotacaoImportacao` (+ `origemTela=cotacaoImportacao`) | "Importação" |
| `#/CotacaoExportacao/:origem` | `cotacao-exportacao` | `cotacaoExportacao` | "Nova Cotação - Exportacão" (sic) |
| `#/AverbacaoProvisoria/:origem` | `averbacao-provisoria` | `averbacaoProvisoria` | "Averbação Provisória" |
| `#/AverbacaoDefinitiva/:origem` | `averbacao-definitiva` | `averbacaoDefinitiva` | "Averbação Definitiva" |
| `#/Processo/:origem` | — | (sem `menu`) | — |

Quando o processo é aberto **a partir da listagem**, o `menu` é decidido pelo registro devolvido por
`/averbacao/obterTransacaoAtualizada`:

```
se status == Provisória(1)  → averbacaoProvisoria
se status == Definitiva(2)  → averbacaoDefinitiva
senão (Cotação)             → tipo == Importação(0) ? cotacaoImportacao : cotacaoExportacao
```

Ou seja, **provisória e definitiva usam a mesma tela**, para importação e exportação; o que muda é
`menu` + as flags calculadas pelo servidor (`isImportacao`, `isExportacao`, `isCotacao`,
`isProvisoria`, `isDefinitiva`, `isNovoProcesso`, `isCotacaoAprovada`, `isCotacaoReprovada`,
`isProvisoriaCancelada`).

### 2.2 Listagem (`processo-selecao`, input `titulo` + filtro inicial)

| Rota | Wrapper | `titulo` → enviado como `filtro.deMenu` | Título | Filtro pré-definido |
|---|---|---|---|---|
| `#/ProcessosNovos` | `processos-novos` | `novaCotacao` | Novas Cotações | data inicial = hoje − 15 dias, final = hoje |
| `#/ProcessosAbertos` | `processos-abertos` | `cotacaoAberta` | Cotações em Aberto | `cdStatus=0` (Cotação), `cdPosicao=2` (Proposta em aberto) |
| `#/ProcessosProvisorias` | `processos-provisorias` | `pedenciaProvisoria` (sic) | Pendências Provisórias | nenhum no cliente — o servidor filtra por `deMenu` |
| `#/ProcessosProrrogacoes` | `processos-prorrogacoes` | `definitivaProrrogacao` | Definitivas em Prorrogação | `cdStatus=2` (Definitiva), `cdPosicao=8` (Prorrogado) |
| `#/NovasCotacoes`, `#/CotacoesAbertas` | `novas-cotacoes`, `cotacoes-abertas` | passam só `menu`, sem filtro | — | **Rotas quebradas**: sem `pFiltroTransacao` o `ngOnInit` acessa `undefined.cdStatus` e a tela não carrega. Código morto |

Em todos os modos, ao abrir: `cdTipo = -1` (Todos), `filtroCoringa = ""`, e `cdStatus = -1` se não
vier preenchido.

---

## 3. Tela de processo — campos

Layout (de cima para baixo): cabeçalho de identificação → [Dados do Transporte, só definitiva] →
Origem | Destino → Dados do Produto → Dados Financeiros + Comissões + Coberturas + Impostos →
[Resumo] + Taxas → [Cartas de protesto, só definitiva] → barra de botões.

Quando `cdTipo == Importação && cdStatus == Definitiva`, aparece no topo:
**"(\*) Campos em vermelho são obrigatórios para solicitar numerário!"** — os campos marcados com
🔴 nas tabelas abaixo ficam vermelhos (`invalid`) se vazios nessa situação. É a **única validação
de obrigatoriedade no cliente**; todo o resto é validado (ou não) pelo servidor.

Legenda das colunas de modo: **CI** cotação importação · **CE** cotação exportação ·
**PR** provisória · **DE** definitiva. ✔ visível · ✎ editável · 🔒 somente leitura · — oculto.

### 3.1 Cabeçalho (identificação)

| Rótulo | Campo | Tipo | CI | CE | PR | DE | Observações |
|---|---|---|---|---|---|---|---|
| Processo | `id.cdTransacao` | texto | 🔒 | 🔒 | 🔒 | 🔒 | gerado pelo servidor no primeiro salvar |
| Averbação | `id.nuAverbacao` | texto | — | — | 🔒 | 🔒 | |
| Data | `dtTransacao` | data | ✎ | ✎ | ✎ | ✎ | default = hoje (novo) |
| Data limite pendência | `dtLimitePendente` | data | ✎ | ✎ | — | — | |
| Apólice | `cdApolice` | select ("Selecione a apolíce") | ✎ | ✎ | ✎ | ✎ | lista filtrada por tipo: `deParametro = "0"` (imp) / `"1"` (exp) |
| Seguradora | `cdSeguradora` | select ("Selecione a seguradora") | ✎ | ✎ | ✎ | ✎ | **não é filtrada pela apólice** — independente |
| Código do cliente + Descrição | `cdCliente` / `deCliente` | código + pesquisa / texto | ✎ | ✎ | ✎ | ✎ | lupa ou *blur* abre modal "Pesquisa de Clientes" (`cadastro/obterTodosClientesPesquisa`), descrição = `deClienteCnpj` |
| Código do parceiro + Descrição | `cdParceiro` / `deParceiro` | idem | ✎ | ✎ | ✎ | ✎ | "Pesquisa de Parceiros" (`obterTodosParceirosPesquisa`) |
| Provisória única | `flTransacaoUnica` | checkbox | ✎ | — | ✎ | — | |
| Contato | `deContato` | texto (máx. 30) | ✎ | ✎ | — | — | |
| Telefone | `nuTelefone` | texto | ✎ | ✎ | — | — | |
| E-mail | `deEmail` | texto | ✎ | ✎ | — | — | |

### 3.2 Dados do Transporte (`processo-aba-dados-transporte`) — só `averbacaoDefinitiva`

| Rótulo | Campo | Tipo | Observações |
|---|---|---|---|
| Modal 🔴 | `cdModal` | select | aqui substitui o select de modal da Origem (oculto na definitiva) |
| Código do navio 🔴 + Descrição | `cdNavio` / `deNavio` | pesquisa ("Pesquisa de Navios", `obterTodosNaviosPesquisa`) | só se modal = Marítimo (2); 🔴 só se marítimo |
| Nome do navio | `deNomeNavio` | texto livre | só se marítimo |
| **AWB / BL / CRT / Ferroviário** | `nuConhecimentoEmbarque` | texto | rótulo muda pelo modal: 1→AWB, 2→BL, 3→CRT, 4→"Ferroviário" |
| Proforma/Comercial | `deGuia` | texto | **mesmo campo** do "Proforma/Comercial" de Dados do Produto (aparece duas vezes na definitiva) |
| Data de saída 🔴 | `dtEmbarque` | data | |
| Data de chegada 🔴 | `dtSaida` | data | atenção: "chegada" grava em `dtSaida` |
| Data de Desembaraço | `dtDesembaraco` | data | |

### 3.3 Origem / Destino (`processo-aba-origem-destino`)

| Bloco | Rótulo | Campo | CI | CE | PR | DE | Observações |
|---|---|---|---|---|---|---|---|
| Origem | Modal | `cdModal` | ✎ | ✎ | ✎ | — | trocar recarrega combos de origem e destino (`"ambos"`) |
| Origem | País 🔴 | `cdPaisOrigem` | ✎ | ✎ | ✎ | ✎ | trocar recarrega combos de origem |
| Origem | Estado | `cdEstadoOrigem` | ✎ | ✎ | ✎ | ✎ | trocar recarrega combos de origem |
| Origem | Cidade 🔴 | `cdCidadeOrigem` | ✎ | ✎ | ✎ | ✎ | |
| Origem | **Aeroporto: / Porto: / Fronteira: / Estação:** | `cdPortoOrigem` | ✎ | ✎ | ✎ | ✎ | rótulo dinâmico pelo modal (1/2/3/4) |
| Origem | Previsão de saída | `dtPrevisaoSaida` | — | ✎ | — | — | |
| Origem | Navio + Descrição | `cdNavio` / `deNavio` | — | ✎ (só marítimo) | — | — | pesquisa de navios |
| Origem | Container | `cdContainer` | — | ✎ (só marítimo) | — | — | Break Bulk (0) · Consolidado (1) · Full (2); default 0 |
| Origem | Outra origem | `deOutraOrigem` | — | — | ✎ | — | texto livre |
| Destino | País 🔴 / Estado / Cidade 🔴 | `cdPais` / `cdEstado` / `cdCidade` | ✎ | ✎ | ✎ | ✎ | mesma cascata |
| Destino | Aeroporto/Porto/… | `cdPortoDestino` | ✎ | ✎ | ✎ | ✎ | |
| Destino | Outro destino | `deOutroDestino` | — | — | ✎ | — | |

Carga das cascatas: `/averbacao/obterCombosTransacao` com
`deParametro = "<país>,<estado>,<modal>,<origem|destino|ambos>"` e `registros=[transação]`;
resposta `registros[0] = {listaPaises, listaEstados, listaCidades, listaPortos}`. **Os portos dependem
do modal e do país/estado**, não da cidade. Na abertura, se origem e destino estão vazios pede
`"ambos"`.

> Código morto relevante: `pesquisaLista("deModais"|"dePaises")` com `limite 5`, `deModaisOrigem`,
> `dePaisesOrigem`, `qtModaisPU`, `qtPaisesPU` ("PU" = provisória única). Indica que a
> **provisória única** foi pensada para aceitar até 5 modais e 5 países de origem, mas a UI nunca foi
> ligada.

### 3.4 Dados do Produto (`processo-aba-dados-produto`)

| Rótulo | Campo | Tipo | Modos | Observações |
|---|---|---|---|---|
| Mercadoria | `deMercadoria` | textarea (máx. 250) | todos | |
| Observação | `deObservacao` | textarea (máx. **124**) | todos | |
| Observação Interna | `deObservacaoInterna` | textarea (máx. 200) | todos | |
| Situação | `flSituacaoMercadoria` | select Nova(0) / Usada(1) | todos | default 0 |
| NCM | `nuNcm` | texto (máx. 10) | todos | |
| Marca | `deMarca` | texto (máx. 50) | todos | |
| Peso(kg) | `vlPeso` | número | todos | |
| Quantidade | `qtTransacao` | número | **PR, DE** | |
| Proforma/Comercial | `deGuia` | texto (máx. 30) | todos | é o "Fatura" do filtro avançado |
| Código da mercadoria + Descrição | `cdMercadoria` / `deMercadoriaFormula` | pesquisa ("Pesquisa de Mercadorias", `obterTodasMercadoriasPesquisa`) | todos | |
| Garantia | `cdCobertura` | select de `/averbacao/obterListaCobertura` | todos | |
| Embalagem | `cdEmbalagem` | select (cadastro) | todos | |

### 3.5 Dados Financeiros, Comissões, Coberturas, Impostos (`processo-aba-dados-financeiros`)

"Bloqueado em PR/DE" = `validaDisabled()` retorna verdadeiro quando `menu` é provisória ou definitiva.

**Dados Financeiros**

| Rótulo | Campo | CI | CE | PR | DE | Observações |
|---|---|---|---|---|---|---|
| Condição de Venda | `cdTipoValor` | ✎ | ✎ | ✎ | ✎ | lista de `/averbacao/obterListaTipoValor`; default 3 (CFR) |
| Moeda | `cdMoeda` | ✎ | ✎ | ✎ | ✎ | default 2 (Dólar) |
| Garantia | `deCobertura` | — | — | — | 🔒 | cópia somente leitura |
| Over | `vlOver` | ✎ | ✎ | ✎ | ✎ | |
| Referência | `nuReferencia` | ✎ | ✎ | ✎ | ✎ | |
| Cobrança via | `cdInstrucaoCobranca` | ✎ | ✎ | ✎ | ✎ | 0 = "Coomex Inteligencia Logistica Ltda", 1 = "Parceiro"; default 0 |
| **Cliente desconto** (CI) / **Desconto padrão** (demais) | `vlDescontoPadrao` | ✎ | ✎ | ✎ | ✎ | mesmo campo, rótulo muda |
| Adicional carta | `vlAdicionalCarta` | — | ✎ | — | — | default 10 |
| Desconto seguradora | `vlDescontoPadraoSeguradora` | ✎ | — | — | — | |
| Percentuais despesa | `vlPercentualDespesa` | ✎ | — | 🔒 | 🔒 | default 10 |
| Percentuais lucro esperado | `vlPercentualLucroEsperado` | ✎ | — | 🔒 | 🔒 | default 10 |
| Orçamento | `nuOrcamento` | ✎ | ✎ | ✎ | ✎ | Taxas(0) / Valores(1); default 0. **Não altera nada na tela** — só vai ao servidor |
| Funcionário | `cdUsuario` | ✎ | ✎ | ✎ | ✎ | texto livre |
| Valor declarado | `cdAdicionalAereo` | ✎ | ✎ | ✎ | ✎ | **só quando modal = Aéreo (1)**. 0 Com valor declarado · 1 Já incluída a cobertura… · 2 Sem valor declarado · 3 NDA; default 0 |

**Comissões**

| Rótulo | Campo | Modos | Observações |
|---|---|---|---|
| Vendedor | `cdFuncionario` | todos | select de funcionários |
| Parceiro % | `vlComissaoParceiro` | todos | default 30 |
| Pinho % | `vlComissao` | todos | |
| Vendedor % | `vlComissaoFuncionario` | todos | |
| Valor IRB | `vlIrb` | CE | |
| Moeda IRB | `cdMoedaIrb` | CE | |
| E-mail cobrança | `deEmailCobranca` | PR | |
| Averbação substituida | `deAvervacaoSubordinada` (sic) | PR, DE | referência de averbação substituída |
| Clausula beneficiária | `deClausula` | PR, DE | |

**Coberturas Acessórias**

| Rótulo | Campo | Quando aparece | Bloqueado em PR/DE |
|---|---|---|---|
| **Transbordo** | `flAereo` (sic) | modal = Marítimo (2) | não |
| Guerra e Greve | `flGuerraGreve` | sempre (CI/CE ou qualquer imp/exp) | **sim** |
| Paralisação Maquina/Refrigeração | `flMaquinaRefrigeracao` | sempre | não |
| Carta de Crédito | `flCarta` | exportação | não |
| Despesas | `flDespesas` | importação | **sim** |
| Lucros Esperados | `flLucroEsperados` | importação | **sim** |
| Prêmio Mínimo | `flCalculadoMinimo` | importação | não |
| Adicional Navio Cliente | `flAdicionalPagamentoNavioCliente` | `menu = averbacaoDefinitiva` ou (definitiva e marítimo) | não |

**Impostos** — bloco visível quando `cdTipo == 0` e (CI ou PR ou definitiva)

| Rótulo | Campo | Bloqueado em PR/DE |
|---|---|---|
| I.I · IPI · ICMS · PIS · COFINS | `flIi` · `flIpi` · `flIcms` · `flPis` · `flCofins` | **sim** |
| Adicional navio seguradora | `flAdicionalNavioSeguradora` | não — só aparece na definitiva |

> Consequência: depois de aprovada, **as coberturas e impostos ficam congelados** — provisória e
> definitiva herdam as condições da cotação; só valores (verbas) e dados operacionais mudam.

### 3.6 Resumo (`processo-aba-taxas`, bloco superior)

Visível quando `isProvisoria` **ou** `isCotacaoReprovada`. Todos os campos são somente leitura.

| Rótulo | Campo | Quando |
|---|---|---|
| Saldo | `vlSaldo` | não é cotação |
| Quantidade de embalagem | `qtDefinitiva` (sic — rótulo e campo não batem; provavelmente nº de definitivas emitidas) | não é cotação |
| Valor da mercadoria/embalagem | `vlMercadoriaEmbalagem` | não é cotação |
| Data do cancelamento | `dtCancelada` | provisória cancelada |
| Tipo | `tpMotivo` → 1 Preço · 2 Atendimento · 3 Outros | cotação (reprovada) |
| Motivo do cancelamento | `deMotivo` | cotação reprovada ou provisória cancelada |

### 3.7 Grade de Taxas (`processo-aba-taxas`)

Cabeçalho: **"Taxas %"** (CI, PR, DE) ou **"Cálculo do seguro"** (CE).
Colunas: `Item | Verbas | Cliente: Básica, Adicional, GTM/GMCC, Total, Prêmio | Seguradora: Básica, Adicional, GTM/GMCC, Total, Prêmio`.
Taxas exibidas com 5 casas (`1.5-5`), valores com 2 (`1.2-2`) — **só formatação**.

| Linha | Verba | Taxas Cliente | Prêmio Cliente | Taxas Seguradora | Prêmio Seguradora | Modos |
|---|---|---|---|---|---|---|
| Custo | `vlMercadoria` ✎ | Básica `txBasicaCliente` ✎ · Adicional `txAdicionalCliente` ✎ · GTM `txGuerraGreveCliente` (✎ só se G&G marcado) · Total `vlTotalCliente` | `vlPremioCustoCliente` | `txBasicaSeguradora` ✎ · `txAdicionalSeguradora` ✎ · `txGuerraGreveSeguradora` (✎ se G&G) · `txTotalSeguradora` | `vlPremioCustoSeguradora` | todos |
| Frete | `vlFrete` ✎ | repete as taxas da linha Custo | `vlPremioFreteCliente` | repete | `vlPremioFreteSeguradora` | todos; **na CE a linha mostra só a verba — sem taxas nem prêmio** |
| Valor CIF + "Percentual adicional navio" | `vlCif` ✎ e `vlAdicionalNavio` ✎ (mesma linha) | — | — | — | — | CE, ou DE de exportação |
| Despesas | `vlDespesa` 🔒 | repete | `vlPremioDespesasCliente` | repete | `vlPremioDespesasSeguradora` | CI/PR/DE de importação |
| Lucros esperados | `vlLucroEsperado` 🔒 | repete | `vlPremioLucroEsperadoCliente` | repete | `vlPremioLucroEsperadoSeguradora` | idem |
| Impostos | `vlImpostos` ✎ | ver regra abaixo | `vlPremioImpostoCliente` | ver regra abaixo | `vlPremioImpostoSeguradora` | idem |
| Percentual adicional navio | `vlAdicionalNavio` ✎ | "Taxa adicional navio" `vlTaxaAdicionalNavio` | `vlTaxaAdicionalNavioPremio` | — | — | **DE de importação marítima** |

Regra de exibição da linha **Impostos** (`validaImposto()` = algum de I.I/IPI/ICMS/PIS/COFINS marcado):

| | Algum imposto marcado | Nenhum imposto marcado |
|---|---|---|
| Cliente Básica / Adicional | `txBasicaCliente` / `txAdicionalCliente` | 0 / 0 |
| Cliente GTM | `txGuerraGreveCliente` | `txGuerraGreveImpostoCliente` |
| Cliente Total | `vlTotalCliente` | `vlTotalImpostoCliente` |
| Seguradora Básica | **`vlTxBasicaImpostoSeguradora`** (taxa própria para impostos) | 0 |
| Seguradora GTM | `vlTxGuerraGreveImpostoSeguradora` | 0 |
| Seguradora Adicional / Total | `txAdicionalSeguradora` / `txTotalSeguradora` | 0 / 0 |

Ou seja: sem impostos marcados, a verba de impostos ainda pode ser cobrada do cliente **só pela taxa
de Guerra/Greve**; e a seguradora tem uma **taxa básica diferenciada para impostos**. Ambas regras
são do servidor e não constam no doc 04.

**Totalizadores (rodapé)**

| Rótulo | Verba (I.S.) | Cliente | Seguradora | Tooltip "Taxa utilizada:" |
|---|---|---|---|---|
| Importância segurada / Prêmio total | `vlFinalImpostoSeguradora` | `vlFinalPremioCliente` | `vlFinalPremioSeguradora` | `txDolar` |
| I.S. US$ / Prêmio total US$ | `vlFinalImpostoSeguradoraDolar` | `vlFinalPremioClienteDolar` | `vlFinalPremioSeguradoraDolar` | `txMoeda` |
| I.S. R$ / Prêmio total aproximado R$ | `vlFinalImpostoSeguradoraReais` | `vlFinalPremioClienteReais` | `vlFinalPremioSeguradoraReais` | **`txDolarMaiorPeriodo`** |

> A conversão para R$ usa `txDolarMaiorPeriodo` — o nome indica **a maior cotação do dólar num
> período**, não a do dia. Isso refina o doc 04 §6 ("cotação do dia") e precisa ser validado.
> O tooltip só aparece se a taxa vier preenchida.

### 3.8 Cartas de protesto — só quando `cdStatus == Definitiva`

Ver seção 7.

---

## 4. Botões da tela de processo

Ordem visual (direita→esquerda, `float-right`), todos com condição `ngIf`. Toda ação com confirmação
usa o modal `confirma` (Sim/Não) ou `motivo` (com texto obrigatório). Sucesso mostra *toast* verde
"Atenção!" e, na maioria, `voltar()` (volta à listagem e recarrega).

| Botão | Aparece quando | Confirmação | Método → endpoint | Resultado no cliente |
|---|---|---|---|---|
| **Voltar** (esquerda) | `cdTransacao != null` e `origemTela != "cotacaoImportacao"` | — | `voltar()` | volta à listagem (na cotação de exportação aberta pelo menu não há para onde voltar) |
| **Salvar** | não reprovada, não aprovada, provisória não cancelada, não definitiva e `menu != averbacaoDefinitiva` | — | `salvar()` → `/averbacao/salvarTransacao` (`deParametro=menu`) | substitui a transação pela devolvida; **permanece na tela**; toast "Processo salvo com sucesso!" |
| **Salvar Definitiva** | `isDefinitiva` ou (`menu=averbacaoDefinitiva` e importação) | — | `salvarDefinitiva()` → `/averbacao/salvarDefinitiva` | "Definitiva salva com sucesso!", volta |
| **Cancelar** | `isProvisoria` ou `isDefinitiva` ou (exportação e não cancelada) | `motivo` título "Atenção", obs. "Deseja realmente cancelar esta {status}?", **descrição obrigatória** | `cancelarOK()` → `/averbacao/cancelarTransacao` | "{Status} cancelada com sucesso!", volta |
| **Reprovar** | `isCotacao` e não `isNovoProcesso` e não reprovada e não aprovada | `motivo` "Motivo da reprovação": **Motivo** (Preço/Atendimento/Outros) **e** descrição obrigatórios | `reprovaOK()` → `/averbacao/reprovarTransacao` | "{Status} reprovada com sucesso!", volta |
| **Gerar** | `isProvisoria` e `menu=averbacaoProvisoria` | — | `voltar()` | **não chama nada** — só volta (botão sem efeito) |
| **Concluir** | provisória, `menu=averbacaoProvisoria`, não cancelada | `motivo` título "Motivo do cancelamento", obs. "O saldo será excluído ao continuar, deseja realmente continuar?", descrição obrigatória | `concluirOK()` → `/averbacao/concluiTransacao` | "Dados salvos com sucesso!", volta. **Encerra a provisória zerando o saldo** |
| **Efetuar Cobrança** | idem Concluir | `confirma` "Deseja habilitar essa{status}para cobrança?" | `cobrancaOK()` → `/averbacao/cobrancaTransacao` | "{Status} alterada para cobrança com sucesso!", volta (posição provisória 5 = Cobrança) |
| **Adicionar Definitiva** | idem Concluir | `confirma` "Deseja incluir uma nova definitiva?" | `aprovaDefinitivaOK()` → `/averbacao/aprovaDefinitiva` (`deParametro=menu`) | **não volta**: a tela troca para a definitiva recém-criada (`transacao = resposta.registros[0]`, `menu = resposta.deParametro`) para o operador completar e clicar *Salvar Definitiva* |
| **Aprovar** | `cdPosicao == 2` | `confirma`: importação "Deseja aprovar essa cotação e iniciar uma provisória?"; exportação "Deseja aprovar essa cotação e emitir cobertura?" | `aprovaTransacaoOK()` → `/averbacao/aprovaTransacao` (`deParametro=menu`) | "{Status} aprovada com sucesso!", volta |
| **Renegociar** | `cdPosicao == 2` | `confirma` "Já existe um calculo para essa {status}, deseja alterar?" | `renegociaOK()` → dispara `/averbacao/calculaTransacao` **e em paralelo** `/averbacao/salvarTransacao` | "Calculo salvo com sucesso!", volta. Corrida: o salvar envia a transação **antes** do cálculo terminar |
| **Calcular** | provisória não cancelada (ou seja, quase sempre) | — | `calculaTransacao()` → `/averbacao/calculaTransacao` (`deParametro=menu`) | substitui a transação inteira pela devolvida; toast "Cálculo realizado com sucesso!" só a partir do 2º cálculo (`contador`) |

Métodos existentes **sem botão** (inalcançáveis pela UI): `excluir()` → `/averbacao/removerTransacao`
("Deseja realmente excluir esta {status}?") e `visualizaSinistro()` (abre a aba de sinistros).

> Atenção à condição de **Aprovar/Renegociar**: testa só `cdPosicao == 2`, sem olhar o status. Como
> posição 2 também significa "Sem definitiva" (provisória) e "Numerário enviado" (definitiva), os
> botões podem aparecer fora da cotação.

---

## 5. Máquina de estados

### 5.1 Status (`cdStatus`) e posições (`cdPosicao`)

Tabela canônica tirada de `editar-posicao-infoline.salvar()` (mapa descrição→código usado para gravar):

| Status | Cód. | Posições (`cdPosicao` → descrição) |
|---|---|---|
| **Cotação** | 0 | 0 Pendente · 1 Em cálculo · **2 Proposta em aberto** · 3 Aprovada · 4 Reprovada |
| **Provisória** | 1 | 0 Pendente · 1 Follow-up · 2 Sem definitiva · 3 Parcial · 4 Concluída · 5 Cobrança · 6 Cancelada |
| **Definitiva** | 2 | 0 Follow-up · 1 Falta enviar Numerário · 2 Numerário enviado · 3 Valorizado · 4 Desvalorizado · 5 Atrasado · 6 Recebido · 7 Numerário pago · 8 Prorrogado · 9 IRB Emitido · 10 Acerto · 11 Cancelada |

Divergências no próprio legado (filtro da listagem, `trocaListaPosicoes`):
- Provisória: o filtro **não oferece** "Sem definitiva" (2).
- Definitiva: o filtro chama a posição 6 de **"Recibo"**; a edição chama de **"Recebido"**.
- "Em cálculo" (filtro) vs "Em calculo" (edição).

Constantes na tela: `COTACAO=0`, `PROVISORIA=1`, `DEFINITIVA=2`, `APROVADA=3`, `propostaEmAberto=2`;
tipo `IMPORTACAO=0`, `EXPORTACAO=1`; modal `NAVIO=2`, `AVIAO=1`.

### 5.2 Transições disparadas pelos botões

As transições são decididas **no servidor**; o cliente só chama o endpoint. Abaixo, o efeito
esperado (pelas mensagens e condições), com o que ainda precisa de confirmação marcado com (?).

```
Cotação · Proposta em aberto(2)
   ├─ Salvar / Calcular / Renegociar ............ continua em 2
   ├─ Reprovar (motivo + tipo) ................. → Cotação · Reprovada(4)
   └─ Aprovar
        ├─ importação → Cotação · Aprovada(3)  +  cria PROVISÓRIA (P-####) · Pendente(0)?
        └─ exportação → Cotação · Aprovada(3)  +  emite cobertura = DEFINITIVA (E-#####) (?)
Provisória
   ├─ Adicionar Definitiva ..................... cria DEFINITIVA (D-######) e abre na tela;
   │                                             provisória → Parcial(3)? e consome saldo
   ├─ Efetuar Cobrança ......................... → Provisória · Cobrança(5)
   ├─ Concluir (motivo) ........................ → Provisória · Concluída(4), saldo zerado
   └─ Cancelar (motivo) ........................ → Provisória · Cancelada(6), grava dtCancelada
Definitiva
   ├─ Salvar Definitiva ........................ permanece (Follow-up(0)/Falta enviar Numerário(1)?)
   ├─ Cancelar (motivo) ........................ → Definitiva · Cancelada(11)
   └─ (fora deste escopo) numerário, IRB, prorrogação → posições 1, 2, 6, 7, 8, 9, 10
```

Mudança manual de posição: ver 6.4 (`editarPosicao`).

### 5.3 Regras de cor de linha (`calculaCorLinha`)

```
cor = branco (#ffffff)
se cdStatus == null: cdStatus = 0
se Cotação   e posição == 2 (Proposta em aberto) → #fbfcb7  (amarelo claro)
se Provisória:
     posição == 0 (Pendente)  → #fdacf8  (rosa)
     posição == 4 (Concluída) → #83afff  (azul)
     flTransacaoUnica         → #ffaca6  (salmão) — tem prioridade sobre as duas acima
se Definitiva e posição == 9 (IRB Emitido) → #9cf3d1 (verde-água)
```

Não há cor para Aprovada, Reprovada, Cancelada nem para as definitivas comuns.

---

## 6. Listagem (`processo-selecao`)

### 6.1 Filtros

Enter em qualquer campo do bloco dispara a busca; o botão 🔄 (`oi-reload`) também.

| Rótulo | Campo do filtro | Tipo | Regra |
|---|---|---|---|
| Data período inicial / final | `dtInicialFiltro` / `dtFinalFiltro` | data | final desabilitada até preencher a inicial |
| Processo inicial / final | `cdTransacaoInicialFiltro` / `cdTransacaoFinalFiltro` | texto | ao digitar a inicial, a final é **copiada**; final desabilitada sem inicial |
| Averbação inicial / final | `nuAverbacaoIncialFiltro` (sic) / `nuAverbacaoFinalFiltro` | texto | idem |
| Código do cliente + Descrição | `cdCliente` / `deCliente` | pesquisa | |
| Código do parceiro + Descrição | `cdParceiro` / `deParceiro` | pesquisa | |
| Seguradora | `cdSeguradora` | select ("Todas") | |
| Apólice | `cdApolice` | select ("Todas"), lista com `deParametro="ambos"` | |
| Modal | `cdModal` | select ("Todos") | |
| Tipo | `cdTipo` | Todos(−1) / Importação(0) / Exportação(1) | |
| Status | `cdStatus` | Todos(−1) / Cotação(0) / Provisória(1) / Definitiva(2) | ao trocar, recarrega as opções de Posição |
| Posição | `cdPosicao` | select dependente do status, com "Todas"(−2) | **só é populado ao trocar o status** — com status pré-definido (Em Aberto, Prorrogação) o select abre vazio, embora o filtro esteja aplicado |
| Filtro avançado + Descrição filtro | `filtroCoringa` / `deCoringa` | select + texto | Mercadoria (`deMercadoria`) · Fatura (`deGuia`) · Marca (`deMarca`) · Observação (`deObservacao`) · Referência (`nuReferencia`). Texto desabilitado até escolher |

Envio: `/averbacao/obterTodasTransacoes` com `registros=[filtro]` e `filtro.deMenu = titulo`.
Página de **20** registros. Linha de contagem: "Processos: N Registro(s) - Seguradora: {nome|Todas}".

### 6.2 Colunas (ordenáveis por clique; alterna asc/desc; ▲▼)

| Coluna | Valor exibido | Chave de ordenação |
|---|---|---|
| Ações | botões (6.3) | — |
| Processo | `id.cdTransacao` | `id.cdTransacao` |
| Data | `dtTransacao` dd/MM/yyyy + "-" + `dtHora` HH:mm | `dtTransacao` |
| Cliente | `deCliente` | `deCliente` |
| Parceiro | `deParceiro` | `deParceiro` |
| Tipo | Importação/Exportação | `cdTipo` |
| Status | `deStatus` | `cdStatus` |
| Posição | `dePosicao` | `cdPosicao` |
| Prêmio US$ | `vlFinalPremioClienteDolar` | `vlrPremioOverDolar` (chave diferente do valor exibido) |
| Número averbação | `deStatusSigla` + `nuAverbacao` (vazio se 0) — ex.: P1994, D106493 | `id.nuAverbacao` |
| Moeda | `deMoedaSigla` | `deMoeda` |
| I.S. | se definitiva **ou** exportação: `vlFinalImpostoSeguradora`; senão `vlMercadoria` (só o custo!) | `vlMercadoria` ou `vlFinalImpostoSeguradora` |
| Saldo | `vlSaldo` | `saldo` |
| Percentual | `pcSaldo` | `percentual` |

### 6.3 Ações por linha

| Ícone / tooltip | Aparece quando | Método → endpoint |
|---|---|---|
| ✏️ Editar (também duplo clique na linha) | sempre | `visualizaTransacao` → `/averbacao/obterTransacaoAtualizada` → abre `processo` no modo do registro |
| Editar Posição (amarelo) | **usuário logado = "Infoline"** (suporte do fornecedor) | `editarPosicao` → modal 6.4 |
| 🖨 Imprimir proposta em PDF | `flVerProposta` | `obterTransacaoAtualizada` + `/relatorio/imprimePropostaPDF` |
| 🖨 Baixar proposta em DocX | `flVerProposta` | `obterTransacaoAtualizada` + `/relatorio/imprimePropostaDocX` |
| Imprimir proposta (tela `seguro`) | **nunca** (`ngIf false`) | — (`/relatorio/imprimePropostaHTML` também sem uso) |
| Imprimir recibo | `isRecibo` | abre componente `recibo` |
| Imprimir certificado | `isRecibo` e definitiva e importação | abre `certificado` |
| Emitir Cobertura | definitiva e exportação | abre `cobertura` |

Não existe botão "Novo" na listagem (`incluirNovaTransacao` sem uso) — cotações novas só pelo menu.

### 6.4 Editar posição (`editar-posicao-infoline`)

Modal "Posição" com um select de **descrições** (listas da seção 5.1 conforme `deStatus`) e botão
Salvar. Converte descrição→código pelo mapa do status e chama `/averbacao/salvarPosicaoTransacao`.
Erros: "Selecione uma opção", "Status da transação inválido", "Descrição de posição inválida para o
status selecionado". Sucesso: "Posição alterada com sucesso!". **Muda só a posição, sem regra de
transição** — é a ferramenta de correção manual do suporte.

---

## 7. Sinistros e Cartas de Protesto

### 7.1 Sinistros (`processo-aba-sinistro` + `processo-sinistro`)

Título da tela: **"Registro de Sinistro"**. **Inalcançável na UI atual** (nenhum botão chama
`visualizaSinistro`), mas o fluxo está completo:

Lista (`/averbacao/obterTodosSinistros`, filtro `{idTransacao, nuAverbacao}` da transação aberta):

| Coluna | Campo |
|---|---|
| (✏️ editar / duplo clique) | — |
| Data | `dtSinistro` |
| Destinatario | `deDestinatario` |
| E-mail Destinatario | `deEmailDestino` |
| Contato | `deContato` |
| Setor Contato | `deSetorContato` |
| Texto / Texto 1 / Texto 2 | `deTexto` / `deTexto1` / `deTexto2` |
| Tipo Protesto | `tpSinistro` |

Ordenação e paginação existem no template mas os métodos estão vazios. Botões: **Voltar**,
**Incluir** (novo sinistro com `idTransacao`, `nuAverbacao`, `cdStatusTransacao`).

Formulário:

| Rótulo | Campo | Limite |
|---|---|---|
| Data | `dtSinistro` | data |
| Destinatário | `deDestinatario` | 30 |
| E-mail do destinatário | `deEmailDestino` | 60 |
| Contato | `deContato` | 30 |
| Setor do contato | `deSetorContato` | 30 |
| Tipo do protesto | `tpSinistro` | 0 Advogado · 1 Aereo · 2 Despachante · 3 Eadi · 4 Marítimo · 5 Rodoviário · 6 Rodoviário DTA |
| Texto 1 / Texto 2 / Texto 3 | `deTexto` / `deTexto1` / `deTexto2` | 50 cada |

Botões: Voltar · **Excluir sinistro** (confirma "Deseja realmente excluir este sinistro?" →
`/averbacao/removerSinistro`) · **Salvar sinistro** (`/averbacao/salvarSinistro`). Nenhuma
validação no cliente. Bug: o select compara `tpSinistro` com uma propriedade inexistente, então
ao editar o tipo salvo não aparece selecionado.

### 7.2 Cartas de protesto (`processo-aba-cartas-protesto`) — dentro da definitiva

Grade editável **com autosave** (cada campo grava ao perder o foco):

| Coluna | Campo | Edição |
|---|---|---|
| ✖ Excluir | — | confirma "Deseja realmente excluir esta carta de protesto?" → `/averbacao/excluirCartasProtesto` (devolve a lista atualizada) |
| 🖨 Imprimir Carta de Protesto | — | ver abaixo |
| Data | `dtCarta` | data, *blur* → `/averbacao/salvarCartasProtesto` |
| Master | `nuMaster` | texto, *blur* salva |
| Container | `nuContainer` | texto, *blur* salva |
| Avaria | `deAvaria` | ao focar abre modal de seleção múltipla; grava os itens unidos por `" / "` |
| Destinatários (separar com ";") | `deDestinatarios` | ao focar abre modal; grava unidos por `"; "` |

**+ Incluir** (cabeçalho): `/averbacao/incluirCartasProtesto` com a transação → devolve a lista com
a nova carta em branco. Carga inicial: `/averbacao/listaCartasProtesto`.

**Impressão:** exige ao menos um destinatário ("Adicione ao menos um Destinatário"); divide
`deDestinatarios` por `;` e gera **um PDF por destinatário** (`/relatorio/imprimeCartaProtestoPDF`
com `deParametro = destinatário`). Como a gravação usa `"; "`, os nomes a partir do 2º vão com espaço
à esquerda.

**Modais de cadastro inline** (catálogos separados por tipo de transporte — `M` se modal Marítimo,
senão `A`):

| Modal | Lista / ações | Validação |
|---|---|---|
| "Selecione as Avarias" | checkboxes em 2 colunas · ✖ remover (confirma "Deseja realmente excluir esta avaria?") · **Adicionar** → "Adicionar Avaria Transporte Marítimo/Aéreo" (campo "Descrição Avaria") · **Confirmar** | descrição < 50 caracteres ("A descrição da avaria pode ter até 50 caracteres.") |
| "Selecione os Destinatários" | idem, "Adicionar Destinatario Transporte Marítimo/Aéreo" | < 100 caracteres |

Endpoints (serviço de cadastro): `obterTodasAvarias`, `salvarAvaria`, `removerAvaria`,
`obterTodosDestinatarios`, `salvarDestinatario`, `removerDestinatario`.

---

## 8. Cálculo: o que é cliente e o que é servidor

### 8.1 No cliente — apenas defaults e formatação

Nenhuma fórmula. O cliente faz somente:

**Defaults de um processo novo** (`ngOnInit`, quando `cdTransacao == null`):

| Campo | Cotação importação | Cotação exportação |
|---|---|---|
| `dtTransacao` | hoje | hoje |
| `cdTipo` | 0 | 1 |
| `cdModal` | 1 (Aéreo) | 1 (Aéreo) |
| `flSituacaoMercadoria` | 0 (Nova) | 0 |
| `cdInstrucaoCobranca` | 0 (Coomex) | 0 |
| `vlPercentualDespesa` / `vlPercentualLucroEsperado` | 10 / 10 | 10 / 10 (ocultos) |
| `vlAdicionalCarta` | — | 10 |
| `flGuerraGreve` | **true** | true |
| `flDespesas` / `flLucroEsperados` | **true / true** | — |
| `flCalculadoMinimo` (Prêmio Mínimo) | **true** | — |
| `txBasicaSeguradora` | 0,054 | 0,25 |
| `vlComissaoParceiro` | 30 | 30 |
| `cdContainer` / `nuOrcamento` / `cdAdicionalAereo` | 0 / 0 / 0 | 0 / 0 / 0 |
| `cdMoeda` | 2 (Dólar) | 2 |
| `cdTipoValor` | 3 (CFR) | 3 |
| `cdCobertura` | 0 (nenhuma opção válida) | 1 (Básica Ampla "A") |
| `cdEmbalagem` | — | 30 (ADEQUADA?) |

Demais campos numéricos começam em 0 (construtor do modelo). Arredondamento no cliente: **nenhum**;
só os *pipes* de exibição (`1.5-5` para taxas, `1.2-2` para valores).

### 8.2 No servidor — `/averbacao/calculaTransacao`

**Entrada:** `Paginas{deParametro = menu, registros = [transação completa]}`. Campos que o operador
pode alterar e que, portanto, alimentam o cálculo:

| Grupo | Campos |
|---|---|
| Verbas | `vlMercadoria` (Custo), `vlFrete`, `vlImpostos`, `vlCif` (exp), `vlAdicionalNavio` |
| Taxas | `txBasicaCliente`, `txAdicionalCliente`, `txGuerraGreveCliente`, `txBasicaSeguradora`, `txAdicionalSeguradora`, `txGuerraGreveSeguradora` |
| Percentuais | `vlPercentualDespesa`, `vlPercentualLucroEsperado`, `vlDescontoPadrao`, `vlDescontoPadraoSeguradora`, `vlAdicionalCarta`, `vlOver`, `vlComissaoParceiro`, `vlComissao`, `vlComissaoFuncionario` |
| Flags | `flGuerraGreve`, `flDespesas`, `flLucroEsperados`, `flCalculadoMinimo`, `flCarta`, `flMaquinaRefrigeracao`, `flAereo` (transbordo), `flIi/flIpi/flIcms/flPis/flCofins`, `flAdicionalNavioSeguradora`, `flAdicionalPagamentoNavioCliente`, `flTransacaoUnica` |
| Contexto | `cdTipo`, `cdStatus`, `cdModal`, `cdMoeda`, `cdApolice`, `cdSeguradora`, `cdTipoValor` (Incoterm), `cdAdicionalAereo` (valor declarado), `nuOrcamento` (Taxas/Valores), `cdCobertura`, `cdEmbalagem`, `flSituacaoMercadoria`, `dtTransacao`, `cdNavio` |

**Saída:** `registros[0]` substitui a transação inteira. Campos exibidos que só o servidor preenche:

| Grupo | Campos |
|---|---|
| Verbas derivadas | `vlDespesa`, `vlLucroEsperado` |
| Totais de taxa | `vlTotalCliente`, `txTotalSeguradora`, `txGuerraGreveImpostoCliente`, `vlTotalImpostoCliente`, `vlTxBasicaImpostoSeguradora`, `vlTxGuerraGreveImpostoSeguradora`, `vlTaxaAdicionalNavio` |
| Prêmios por linha | `vlPremio{Custo,Frete,Despesas,LucroEsperado,Imposto}{Cliente,Seguradora}`, `vlTaxaAdicionalNavioPremio` |
| Totais | `vlFinalImpostoSeguradora` (I.S.), `…Dolar`, `…Reais`; `vlFinalPremioCliente`, `…Dolar`, `…Reais`; `vlFinalPremioSeguradora`, `…Dolar`, `…Reais` |
| Câmbio usado | `txDolar`, `txMoeda`, `txDolarMaiorPeriodo` |
| Saldo (prov.) | `vlSaldo`, `pcSaldo`, `qtDefinitiva`, `vlMercadoriaEmbalagem` |

O modelo `Transacao` tem ainda campos que nunca aparecem nesta tela mas indicam regras do servidor:
`vlPremioOverDolar/Real`, `vlrPremioOverDolar` (prêmio com *over*), `vlIrbDolar`,
`vlPremioIrbDolar/Real`, `vlDolarAPagar`, `vlRealAPagar`, `vlDiferencaDolar/Real` (+ `…Exportacao`),
`vlComissaoFidcargoDolar`, `vlComissaoDolar/Real`, `vlProrrogacaoCliente(Real)`,
`vlProrrogadaSeguradoraDolar`, `flMercadoriaNaoCliente`, `flFreteNaoCliente`,
`flDespesaNaoCliente`, `flLucroEsperadoNaoCliente`, `flImpostosNaoCliente` (verbas que **não** são
cobradas do cliente), `flComissaoParcialProgramada`, `flEnvioEmailPendente/Programacao/Laboratorio`.

**Salvar não recalcula no cliente**: `salvarTransacao` envia o objeto como está. Se o operador mudar
um valor e salvar sem clicar *Calcular*, depende do servidor recalcular (a validar).

---

## 9. Diferenças entre os modos

| Aspecto | Cotação importação | Cotação exportação | Provisória | Definitiva |
|---|---|---|---|---|
| Número exibido | Processo | Processo | Processo + Averbação (P-) | Processo + Averbação (D-/E-) |
| Data limite pendência, Contato, Telefone, E-mail | ✔ | ✔ | — | — |
| Provisória única | ✔ | — | ✔ | — |
| Dados do Transporte (navio, conhecimento, datas) | — | — | — | ✔ |
| Modal | na Origem | na Origem | na Origem | em Dados do Transporte |
| Navio/Container/Previsão de saída | — | ✔ (navio/container só marítimo) | — | (navio no Transporte) |
| Outra origem / Outro destino | — | — | ✔ | — |
| Quantidade | — | — | ✔ | ✔ |
| Coberturas, impostos, % despesa/lucro | editáveis | editáveis | **bloqueados** | **bloqueados** |
| E-mail cobrança | — | — | ✔ | — |
| Averbação substituída, Cláusula beneficiária | — | — | ✔ | ✔ |
| Valor IRB / Moeda IRB / Adicional carta | — | ✔ | — | — |
| Linhas da grade | Custo, Frete, Despesas, Lucros, Impostos | Custo, Frete (só verba), Valor CIF + % adic. navio | como importação | importação: + "Percentual adicional navio" se marítimo; exportação: Valor CIF |
| Resumo (saldo) | — | — | ✔ | — |
| Cartas de protesto | — | — | — | ✔ |
| Ações principais | Salvar, Calcular, Aprovar, Reprovar, Renegociar | idem (+ Cancelar) | Salvar, Calcular, Adicionar Definitiva, Efetuar Cobrança, Concluir, Cancelar, Gerar | Salvar Definitiva, Calcular, Cancelar |

**Prorrogação:** não tem modo próprio na tela de processo. A listagem "Definitivas em Prorrogação"
só filtra definitivas na posição 8 e abre a definitiva normal; os campos de prorrogação do modelo
(`vlProrrogacaoCliente`, `vlProrrogadaSeguradoraDolar` etc.) não têm campo na UI deste escopo.

**Transação/Provisória única** (`flTransacaoUnica`): marcada na cotação de importação ou na
provisória; afeta apenas (no cliente) a cor salmão da linha. A regra de negócio (uma única
provisória cobre o processo inteiro? sem controle de saldo?) é do servidor. O código morto de
"modais/países PU" sugere que ela cobriria até 5 modais e 5 países.

**Saldo** (`/averbacao/saldo30`): **não é chamado na tela de processo**. É chamado no **login**,
junto com `/averbacao/cotacoesAguardando`; se o servidor devolver `deMensagem`, o legado mostra um
`alert()` nativo do navegador. Pelo nome, avisa provisórias com saldo há mais de 30 dias e cotações
aguardando resposta. O saldo da provisória (`vlSaldo`, `pcSaldo`) vem calculado em cada transação.

---

## 10. Correções e acréscimos aos docs existentes

| Doc | Afirmação | O que o bundle mostra |
|---|---|---|
| 02, dor 6 | Rótulo "Aeroporto" fixo | O rótulo **é dinâmico**: Aeroporto/Porto/Fronteira/Estação conforme o modal |
| 02 | "Valor declarado" sempre visível | Só aparece com modal **Aéreo** |
| 02 / 03 | Guerra e Greve desmarcado por padrão na importação | O código **marca** G&G, Despesas, Lucros Esperados e Prêmio Mínimo por padrão na importação (a validar — pode ter sido desmarcado na tela observada) |
| 02 | Funcionário, Condição de Venda | Funcionário é texto livre gravado em `cdUsuario`; Condição de Venda vem de `/averbacao/obterListaTipoValor` (`cdTipoValor`) |
| 02 / 03 | Grade com 5 colunas por bloco | Correto; mas na **exportação a linha Frete não tem taxa nem prêmio** |
| 03 | Coberturas da exportação | Faltou **Transbordo** (`flAereo`, só marítimo) e **Paralisação Máquina/Refrigeração** existe nos dois tipos |
| 04 §1–§7 | Fórmulas | São do **servidor**; o cliente não calcula. Acrescentar: taxa básica de seguradora própria para impostos; G&G sobre impostos mesmo sem imposto marcado; conversão R$ por `txDolarMaiorPeriodo` |
| 08 | Posições: cotação "Proposta em aberto · Aprovada"; provisória "Pendente"; definitiva "Follow-up" | Enum completo na seção 5.1 (5 + 7 + 12 posições) |
| 08 | `salvarTransacao` gera a averbação | Quem gera a provisória é **`aprovaTransacao`** ("aprovar essa cotação e iniciar uma provisória"); a definitiva nasce em **`aprovaDefinitiva`** (botão "Adicionar Definitiva") e é completada com `salvarDefinitiva` |
| 08 | Prorrogação "por caminho alternativo" | A rota existe (`#/ProcessosProrrogacoes`) e filtra Definitiva · Prorrogado(8); não há edição específica |
| 08 | Sinistros | Telas completas no bundle, mas **sem ponto de entrada** na UI |
| 01 | `#/NovasCotacoes`, `#/CotacoesAbertas` | Rotas quebradas (código morto) |

---

## 11. Pontos a validar com dado real

1. **Efeito exato de Aprovar** na importação e na exportação: que status/posição a cotação e o novo
   registro assumem; se a exportação pula a provisória e vai direto à definitiva (E-#####).
2. **Adicionar Definitiva**: a posição da provisória depois (Parcial? Sem definitiva?), como o saldo
   (`vlSaldo`, `pcSaldo`) é abatido e se há bloqueio quando o saldo acaba.
3. **Concluir** vs **Cancelar** provisória: posição final, se o saldo é zerado, onde aparece o motivo.
4. **Efetuar Cobrança**: o que muda além da posição 5 (gera numerário? aparece em Solicitar Numerário?).
5. Se **Aprovar/Renegociar** aparecem em provisórias "Sem definitiva" ou definitivas "Numerário
   enviado" (condição só por `cdPosicao == 2`).
6. **Salvar recalcula?** Alterar o Custo, salvar sem *Calcular* e conferir se os prêmios mudaram.
7. **Defaults reais da importação**: G&G, Despesas, Lucros Esperados e Prêmio Mínimo vêm marcados?
   Garantia vem vazia (`cdCobertura = 0`)?
8. **Taxa de câmbio**: confirmar se "Prêmio total aproximado R$" usa a maior taxa do período
   (`txDolarMaiorPeriodo`) — passar o mouse sobre o rótulo mostra "Taxa utilizada: X". Ver também o
   tooltip das linhas US$ (`txMoeda`) e moeda original (`txDolar`).
9. **Linha Impostos sem imposto marcado**: confirmar que cobra G&G (`txGuerraGreveImpostoCliente`) e
   qual é a taxa básica da seguradora para impostos (`vlTxBasicaImpostoSeguradora`).
10. **Provisória única**: o que muda no saldo e na emissão de definitivas; se aceita várias.
11. Mensagens de `saldo30` e `cotacoesAguardando` no login (texto e critério de 30 dias).
12. **"Quantidade de embalagem"** do Resumo (`qtDefinitiva`): é número de definitivas emitidas?
13. Coluna **I.S.** da listagem para cotações/provisórias de importação: mostra só o Custo
    (`vlMercadoria`), não a I.S. total — confirmar.
14. Quais posições de definitiva ocorrem de fato (Valorizado, Desvalorizado, Atrasado, Acerto) e quem
    as define (só Editar Posição do suporte?).
15. Se **"Pendências Provisórias"** traz só provisórias pendentes ou também definitivas (o menu diz
    "Provisória/Definitiva"; o filtro é todo no servidor por `deMenu`).
16. Uso real de **Cartas de Protesto** (há cartas cadastradas? catálogos de avarias/destinatários
    preenchidos?) e se **Sinistros** têm registros (a tela é inalcançável hoje).
17. **Orçamento Taxas/Valores**: o que o servidor faz diferente no modo "Valores".
18. Campos `flMercadoriaNaoCliente`, `flFreteNaoCliente` etc.: existem processos com verbas não
    cobradas do cliente?
19. **Transbordo** (`flAereo`) e **Adicional navio** (cliente/seguradora): impacto no prêmio.
20. `cdEmbalagem = 30` na exportação corresponde a "ADEQUADA"?
