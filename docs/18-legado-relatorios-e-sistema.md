# Legado — relatórios, impressões, arquivos e telas de sistema

Engenharia reversa **estática** do bundle Angular do Coomex Hub (`main-S4VFPNOX.js`). Nada foi
executado contra o servidor legado. Complementa [`05-cadastros.md`](05-cadastros.md),
[`08-fluxos.md`](08-fluxos.md) (seção Relatórios), [`09-api-legado.md`](09-api-legado.md) e
[`11-dicionario-dados.md`](11-dicionario-dados.md).

> **Como ler o bundle:** no Angular compilado, as funções de template de um componente ficam
> **antes** da classe. Por isso o arquivo `cmp/<seletor>.js` traz o template do componente seguinte
> (ex.: `cmp/ranking-estado.js` contém a grade do Ranking de Clientes). Os trechos deste documento
> foram lidos juntando "funções anteriores + classe".

---

## Parte A — Relatórios e impressões

### Convenções comuns a todas as telas desta parte

| Item | Comportamento |
|---|---|
| Envelope enviado | `{nuPagina, qtRegistrosPorPagina, nuConsulta:0, qtPaginas, cdEmpresa, cdRestricao, cdUsuario, deParametro, registros:[filtro]}` — o filtro vai como **único elemento** de `registros` |
| Objeto filtro | instância da classe de transação (`xt`) com campos `dtInicialFiltro`, `dtFinalFiltro`, `cdCliente`, `cdParceiro`, `cdTipo`, `cdEstado`, `cdSeguradora`, `cdTransacaoInicialFiltro/FinalFiltro`, `nuAverbacaoIncialFiltro` (sic, "Incial") / `nuAverbacaoFinalFiltro`, `txIrb`, `deImpressao` |
| Período padrão | **hoje − 15 dias** até hoje (rankings, produção, arquivo de definitivas) |
| `cdTipo` | `0` = Importação · `1` = Exportação · `2` = Prorrogada (só produção) · `-1` ou `undefined` = Todos |
| Pesquisa de cliente/parceiro | componente `pesquisa` → `/cadastro/obterTodosClientesPesquisa` e `/cadastro/obterTodosParceirosPesquisa` (código em `id.cdCliente`/`id.cdParceiro`, descrição `deRazaoSocial`) |
| Combo de seguradoras | `serviceCadastro.obterListaSeguradoras` (valor `id.cdSeguradora`, texto `deRazaoSocial`) |
| Combo de UF | `serviceCadastro.obterComboSiglas` (valor `id.idEstado`, texto `cdEstado`) |
| Formatação | pipe `number` com locale `pt` → `1.234,56`; valores monetários `1.2-2`, taxas `1.2-4` / `1.4-4` |
| Download | serviço `printService.print(base64, nome, extensao)`: `pdf`/`html` abrem em nova aba (Blob URL); `plain` abre como `text/plain`; qualquer outra extensão é **baixada** via FileSaver como `<deAnexo>.<extensao>`; extensão vazia vira `txt` |
| Resposta de arquivo | `registros = {arquivo: <base64>, extensao, deAnexo}` — o arquivo é **montado inteiro no servidor** |
| Ordenação | os métodos `ordem()` existem, mas **nenhum cabeçalho de relatório está ligado a eles** — não há ordenação pelo usuário |

### A.1 Ranking de Apólices e Ranking de Estados (`ranking-apolice-estado`)

Um único componente, usado por `ranking-apolice` (`ranking="apolice"`) e `ranking-estado`
(`ranking="estado"`). Títulos: "Ranking de Apolices" / "Ranking de Estados".

**Endpoint:** `POST /relatorio/obterTodasTransacoesApolicesEstados` — chamado no `ngOnInit` e no botão
⟳. O cliente **sobrescreve `deParametro` com `"apolice"` ou `"estado"`**, então qualquer ordenação
seria perdida; é assim que o servidor sabe por qual dimensão agrupar.

| Filtro (rótulo na tela) | Campo | Observação |
|---|---|---|
| "Processo inicial:" | `dtInicialFiltro` | **rótulo errado**: é um `inputdate` (data) |
| "Processo final:" | `dtFinalFiltro` | idem |
| Código do cliente + Descrição | `cdCliente` / `deCliente` | lupa de pesquisa |
| Código do parceiro + Descrição | `cdParceiro` / `deParceiro` | lupa de pesquisa |
| Tipo | `cdTipo` | Todos (`"undefined"`) / Importação (0) / Exportação (1) |

Paginação: **25** por página.

| # | Coluna | Campo | Formato |
|---|---|---|---|
| 1 | (sem título) — posição | `orderLista` | inteiro, vem do servidor |
| 2 | Número *(apólice)* / Estado *(estado)* | `cdApolice` / `deEstado` | — |
| 3 | Percentual % | `vlPercentual` | `1.2-2` + "%" |
| 4 | I.S. U$ | `impSeguradaDolar` | `1.2-2` |
| 5 | Prêmio US$ | `vlFinalPremioClienteDolar` | `1.2-2` |
| 6 | Prêmio R$ | `vlFinalPremioClienteReais` | `1.2-2` |
| 7 | IRB US$ | `vlIrb` | `1.2-2` |
| 8 | IRB R$ | `vlIrbReal` | `1.2-2` |
| 9 | Número Processos | `qtProcesso` | inteiro |

**Linha "Total:"** (exibida se `transacaoSelecionada.qtProcesso > 0`): `totalVlPercentual`,
`totalVlImpSeguradaDolar`, `totalVlFinalPremioClienteDolar`, `totalVlFinalPremioClienteReais`,
`totalVlIrb`, `totalVlIrbReais`, `totalQtProcessos`.

> **De onde vem o total:** `transacaoSelecionada = registros[registros.length − 1]` — o cliente lê os
> campos `total*` **do último registro da página**, sem tirá-lo da lista. Ou o servidor repete os
> totais em todas as linhas, ou a última linha aparece duas vezes (como linha normal e como total).
> Ver "Pontos a validar".

> A coluna "Número" do ranking por apólice mostra `cdApolice` (código interno), não `nuApolice`.

Nenhum cálculo no cliente: percentual, totais, posição e conversões em R$ vêm prontos do servidor.

### A.2 Ranking de Clientes (`ranking-cliente`)

**Endpoint:** `POST /relatorio/obterTodasTransacoesClientes` (+ `obterComboSiglas` para o combo de UF).
`deParametro` = `"<coluna>,<asc|desc>"` ou vazio (nunca preenchido, já que não há ordenação ligada).
Paginação: **50** por página.

Filtros: os mesmos de A.1 (com os mesmos rótulos errados "Processo inicial/final" para datas) **+ UF**
(`cdEstado`, "Todos" + siglas).

| # | Coluna | Campo |
|---|---|---|
| 1 | posição | `orderLista` |
| 2 | Nome | `deCliente` |
| 3 | Percentual % | `vlPercentual` |
| 4 | I.S. U$ | `impSeguradaDolar` |
| 5 | Prêmio US$ | `vlFinalPremioClienteDolar` |
| 6 | Prêmio Seguradora US$ | `vlFinalPremioSeguradoraDolar` |
| 7 | Resultado US$ | `vlResultadoDolar` |
| 8 | IRB US$ | `vlIrb` |
| 9 | Número Processos | `qtProcesso` |

Total: `totalVlPercentual`, `totalVlImpSeguradaDolar`, `totalVlFinalPremioClienteDolar`,
`totalVlFinalPremioSeguradoraDolar`, `totalVlResultadoDolar`, `totalVlIrb`, `totalQtProcessos`
(mesmo mecanismo "último registro" de A.1). Nenhuma fórmula no cliente.

### A.3 Ranking de Parceiros (`ranking-parceiro`)

**Endpoint:** `POST /relatorio/obterTodasTransacoesParceiros`. Mesmos filtros e paginação (50) do
Ranking de Clientes, incluindo UF.

| # | Coluna | Campo |
|---|---|---|
| 1 | posição | `orderLista` |
| 2 | Nome | `deParceiroFantasia` |
| 3 | Percentual % | `vlPercentual` |
| 4 | I.S. U$ | `impSeguradaDolar` |
| 5 | Prêmio US$ | `vlFinalPremioClienteDolar` |
| 6 | IRB US$ | `vlIrb` |
| 7 | Comissão Parceiro US$ | `vlComissaoParceiroDolar` |
| 8 | Resultado US$ | `vlResultadoDolar` |
| 9 | Número Processos | `qtProcesso` |
| 10 | Número Clientes | `qtCliente` |

Total: `totalVlPercentual`, `totalVlImpSeguradaDolar`, `totalVlFinalPremioClienteDolar`, `totalVlIrb`,
`totalVlComissaoParceiroDolar`, `totalVlResultadoDolar`, `totalQtProcessos`, `totalQtClientes`.

> O cmp de 26 KB inclui o template da Planilha Produção (componente seguinte no bundle). O ranking em
> si é do mesmo tamanho dos demais.

#### Diferenças entre os quatro rankings (corrige `08-fluxos.md`)

`08-fluxos.md` lista uma só grade para todos os rankings. Na verdade são três:

| Coluna | Apólice/Estado | Cliente | Parceiro |
|---|---|---|---|
| I.S. U$, Prêmio US$, IRB US$, Nº Processos, Percentual | ✔ | ✔ | ✔ |
| Prêmio R$, IRB R$ | ✔ | — | — |
| Prêmio Seguradora US$ | — | ✔ | — |
| Resultado US$ | — | ✔ | ✔ |
| Comissão Parceiro US$, Nº Clientes | — | — | ✔ |
| Filtro UF | — | ✔ | ✔ |
| Registros/página | 25 | 50 | 50 |

### A.4 Planilha Produção (`relatorio-producao`, rota `RelatorioProducao`)

Título interno: **"Planilha Produção"**. Constantes: `IMPORTACAO=0`, `EXPORTACAO=1`, `PRORROGADA=2`.

**Endpoints:**

| Ação | Endpoint | Payload | Escreve? |
|---|---|---|---|
| Carregar / ⟳ / **clicar no combo Tipo** | `/relatorio/obterTodasTransacoesProducao` | `registros:[filtro]` | não |
| ☁ ao lado de "Nova Tx. Câmbio Seguradora" | `/relatorio/atualizarTxIrb` | `registros:[filtro]` com `filtro.txIrb` | **sim — em lote** |
| Gerar IRBs | `/relatorio/emitirIrbTransacoesProducao` | `registros:[filtro]` | **sim — em lote** |
| Gerar Excel | `/relatorio/gerarExcelRelatorioProducao` | `registros: string[][]` (a tabela raspada da tela) | não |
| Imprimir | nenhum — HTML gerado no cliente | — | não |

> O `(click)` do combo **Tipo** dispara a consulta a cada clique, antes mesmo da troca de valor.

**Filtros:**

| Rótulo | Campo | Regra |
|---|---|---|
| Período inicial / Período final | `dtInicialFiltro` / `dtFinalFiltro` | padrão: hoje − 15 dias |
| Processo inicial / Processo final | `cdTransacaoInicialFiltro` / `cdTransacaoFinalFiltro` | digitar o inicial **copia** o valor para o final; o final fica desabilitado enquanto o inicial está vazio |
| Definitiva inicial / Definitiva final | `nuAverbacaoIncialFiltro` / `nuAverbacaoFinalFiltro` | mesma regra |
| Código do cliente + Descrição | `cdCliente` / `deCliente` | lupa |
| Código do parceiro + Descrição | `cdParceiro` / `deParceiro` | lupa |
| Tipo | `cdTipo` | Todos (−1, padrão) / Importação (0) / Exportação (1) / Prorrogada (2) |
| Seguradora | `cdSeguradora` | "Todas" (null) + lista |
| Nova Tx. Câmbio Seguradora | `txIrb` | 4 casas; usado só pelo botão de atualização em lote |

**Sem paginação na tela:** o componente manda `qtRegistrosPorPagina=50`, mas o template **não tem
`<pagination>`**. Se o servidor respeitar o tamanho de página, a planilha mostra no máximo 50 processos
(e o Excel/impressão só levam esses).

**Linha de totais:** depois da consulta, o cliente faz
`transacaoSelecionada = registros.pop()` — aqui o **último registro é removido da lista** e é tratado
como linha de totais (diferente dos rankings).

#### Colunas — cabeçalho fixo × células condicionais

Cabeçalho (sempre igual, exceto as colunas marcadas):
`Processo` · `Parceiro` · `Definitiva` · `Referência` · `RME` · `Cliente` · `Tx. Câmbio Seguradora` ·
`Tx.Rec.` · [`Prêmio.Cli USD` · `Prêmio.Cli R$` — ocultas quando Tipo = Exportação] ·
`A Pagar Seguradora USD` · `A Pagar Seguradora AGRAVO 25% USD` · `A Pagar R$` · `Dif USD` · `Dif R$` ·
`% de Rentabilidade`

As células de cada linha **não seguem o cabeçalho**: cada uma tem seu próprio `*ngIf` por tipo.

| Célula | Campo | Todos (−1) / Importação (0) | Exportação (1) | Prorrogada (2) |
|---|---|---|---|---|
| Processo | `id.cdTransacao` | ✔ | ✔ | ✔ |
| Parceiro | `deParceiroFantasia` (corta em 25 chars + "..." se > 20) | ✔ | ✔ | ✔ |
| Definitiva | `id.nuAverbacao` (+ " Prg-`nuProrrogacao`" na prorrogada) | ✔ | ✔ | ✔ |
| Referência | `nuReferencia` | ✔ | ✔ | ✔ |
| RME | `cdIrb` | ✔ | ✔ | ✔ |
| Cliente | `deClienteFantasia` (mesmo corte) | ✔ | ✔ | ✔ |
| Tx. Câmbio Seguradora | `txIrb` (`1.2-4`) / `txIrbProrrogada` (`1.4-4`) | `txIrb` | `txIrb` | `txIrbProrrogada` |
| Tx.Rec. | `txDolarNumerario` / `txDolarNumerarioProrrogada` (`1.4-4`) | `txDolarNumerario` | `txDolarNumerario` | `…Prorrogada` |
| Prêmio.Cli USD | `vlPremioOverDolar` | ✔ | — | `vlProrrogadaCliente` |
| Prêmio.Cli R$ | `vlPremioOverReal` | ✔ | — | `vlProrrogadaClienteReal` |
| A Pagar Seguradora USD | `vlDolarAPagar` | ✔ | ✔ | `vlProrrogadaSeguradoraDolar` |
| AGRAVO 25% USD | `vlDolarAPagarAgravo20` | ✔ | ✔ | `vlDolarAPagarProrrogada` |
| A Pagar R$ | `vlRealAPagar` | ✔ | ✔ | `vlRealAPagarProrrogada` |
| Dif USD | `vlDiferencaDolar` | ✔ | — | `vlDiferencaDolarProrrogada` |
| Dif R$ | `vlDiferencaReal` | ✔ | — | `vlDiferencaRealProrrogada` |
| % de Rentabilidade | **calculado no cliente** (abaixo) | ✔ | — | — |

Resultado na tela:
- **Todos/Importação:** 16 células para 16 cabeçalhos — alinhado.
- **Exportação:** 11 células para 14 cabeçalhos — `Dif USD`, `Dif R$` e `%` ficam vazios.
- **Prorrogada:** 15 células para 16 cabeçalhos, e **os rótulos não batem** (ex.: sob "A Pagar
  Seguradora AGRAVO 25% USD" aparece `vlDolarAPagarProrrogada`; sob "Prêmio.Cli USD" aparece
  `vlProrrogadaCliente`).

#### Linha "Totais"

Sete células vazias + "Totais" sob `Tx.Rec.`, depois:

| Ordem | Campo de total | Exibido quando |
|---|---|---|
| 1 | `totalVlIrbDolar` | Exportação |
| 2 | `totalVlPremioOverDolar` | Todos/Importação |
| 3 | `totalVlPremioOverReal` | Todos/Importação |
| 4 | `totalVlProrrogadaCliente` | Prorrogada |
| 5 | `totalVlProrrogadaClienteReal` | Prorrogada |
| 6 | `totalVlProrrogadaSeguradoraDolar` | Prorrogada |
| 7 | `totalVlPremioOverDolar` | Exportação |
| 8 | `totalVlFinalPremioSeguradoraDolar` | Todos/Importação *(fica sob "A Pagar Seguradora USD", cuja célula é `vlDolarAPagar`)* |
| 9 | `totalVlPremioOverDolarIrbDolar` | Exportação |
| 10 | `totalVlPremioOverDolarIrbReal` | Exportação |
| 11 | `totalVlFinalPremioSeguradoraDolar` | Exportação |
| 12 | `totalVlDolarAPagarAgravo20` | Tipo ≠ Prorrogada |
| 13 | `totalVlRealAPagar` | Tipo ≠ Prorrogada |
| 14 | `totalVlDiferencaDolar` | Todos/Importação |
| 15 | `totalVlDiferencaReal` | Todos/Importação |
| 16 | % de rentabilidade total (fórmula abaixo) | Todos/Importação |
| 17 | `totalVlDiferencaDolarExportacao` | Exportação |
| 18 | `totalVlDiferencaRealExportacao` | Exportação |
| 19–22 | `totalVlDolarAPagarProrrogada`, `totalVlRealAPagarProrrogada`, `totalVlDiferencaDolarProrrogada`, `totalVlDiferencaRealProrrogada` | Prorrogada |
| 23 | `totalVlDiferencaDolarProrrogada` **(repetido)** | Prorrogada |

Na exportação a linha de totais tem **17 células para 14 colunas** e mostra totais (`IRB`, `Over IRB`,
`Diferença Exportação`) que não existem em nenhuma linha — informação que **só aparece no total**.

#### Fórmulas calculadas no cliente

São as **únicas** contas feitas no navegador em toda a Parte A:

```
% de Rentabilidade (linha)  = vlDiferencaReal / vlPremioOverReal * 100          → formato 1.2-2
% de Rentabilidade (total)  = totalVlDiferencaReal / totalVlPremioOverReal * 100 → formato 1.2-2
```

Sem proteção contra divisão por zero (prêmio zero → `NaN`/`Infinity` exibido como vazio ou "∞").
`vlDiferenca*`, `vlDolarAPagar*`, `vlRealAPagar`, agravo, conversões e todos os `total*` vêm prontos do
servidor.

#### Exportações

| Botão | O que faz de fato |
|---|---|
| **Imprimir** | pega o `outerHTML` de `#impressao`, embrulha num HTML com CSS (`@page landscape`, margem 0,5 cm, bordas cinza), converte em base64 e abre em **nova aba** como `text/html` (`print(b64, "relatorio-producao", "html")`). Não é PDF. |
| **Gerar Excel** | percorre os `<tr>` da tabela na tela; de cada linha guarda os `innerText` dos `<th>` (se houver) ou dos `<td>`; envia essa matriz de strings ao servidor, que devolve o `.xlsx` em base64. Os números chegam ao Excel **já formatados como texto pt-BR** (`1.234,56`) e com os mesmos desalinhamentos da tela. |
| **Gerar IRBs** | confirmação "Deseja emitir IRB para todas as transações da seleção?" → `emitirIrbTransacoesProducao` com o filtro. **Escrita em lote.** |
| ☁ (Nova Tx. Câmbio) | exige `txIrb` preenchido ("É necessário inserir um valor de taxa antes de usar esta função!"); confirmação "Deseja atualizar as Taxas IRB de todos os registros abaixo para X,XXXX?" → `atualizarTxIrb` com o filtro. **Escrita em lote** sobre o filtro, não sobre as linhas visíveis. |

> Correção a `08-fluxos.md`: a Planilha Produção não exporta PDF; "Imprimir" abre HTML no navegador.

### A.5 Impressão de Provisórias (`impressao-provisoria`)

| Filtro | Campo | Regra |
|---|---|---|
| Provisória inicial | `nuAverbacaoIncialFiltro` | copia para o final ao digitar |
| Provisória final | `nuAverbacaoFinalFiltro` | desabilitado enquanto o inicial está vazio |
| Seguradora | `cdSeguradora` | "Todas" + lista |

Botão 🖨 → `POST /relatorio/imprimeProvisoria` com `registros:[filtro]` e `qtRegistrosPorPagina=20`.
Resposta `{arquivo, extensao, deAnexo}` → `printService.print`. Sem grade, sem pré-visualização, sem
validação de faixa: com tudo vazio o pedido vai assim mesmo. O documento é gerado no servidor
(provavelmente PDF, que abre em nova aba).

### A.6 Impressão de Definitivas (`impressao-definitiva`)

Igual à de provisórias, mais o filtro **Tipo** (Importação 0 — padrão / Exportação 1), e rótulos
"Definitiva inicial/final". Endpoint: `POST /relatorio/imprimeDefinitiva`.

### A.7 Arquivo de Provisórias (`arquivo-provisoria`) — título "Gerar Arquivo de Provisórias"

| Filtro | Campo | Valores |
|---|---|---|
| Provisória inicial / final | `nuAverbacaoIncialFiltro` / `nuAverbacaoFinalFiltro` | mesma regra de cópia/desabilitação |
| Seguradora | `cdSeguradora` | "Todas" + lista |
| Tipo | `deImpressao` | **CSV** (`csv`, padrão) · **Normal** (`normal`) · **Separador** (`separador`) |

Botão "Gerar" → `POST /relatorio/imprimeArquivoProvisoria`, com `deParametro = deImpressao` e
`registros:[filtro]`. O arquivo volta pronto (`arquivo` base64 + `extensao` + `deAnexo`) e é baixado.

**Layout do arquivo: não está no cliente.** O front só escolhe o formato. Pelos nomes, "Normal" deve
ser texto de largura fixa (posicional) e "Separador" texto delimitado, mas o layout campo a campo, a
extensão e se segue um padrão de seguradora só podem ser vistos no arquivo gerado ou no código Java.
Não há indício de CNAB (nenhum termo de banco, header/trailer ou registro tipado no front).

Bugs: a tela usa o **buffer de minimização da tela de Definitivas** (`bufferArquivoDefinitiva`) e, ao
minimizar, cria um atalho chamado "Gerar Arquivo de Definitivas" apontando para `/ArquivoDefinitiva`.

### A.8 Arquivo de Definitivas (`arquivo-definitiva`) — título "Gerar Arquivo de Definitivas"

Filtros **diferentes** da provisória (corrige `08-fluxos.md`, que diz "mesmos filtros + Tipo CSV"):

| Filtro | Campo | Regra |
|---|---|---|
| Data período inicial / final | `dtInicialFiltro` / `dtFinalFiltro` | padrão hoje − 15 dias; final desabilitado sem inicial |
| Seguradora | `cdSeguradora` | "Todas" + lista |
| Rádio Importação / "Exportacao" (sem acento) | `cdTipo` | `0` / `1`; **nenhum vem marcado** — sem escolha, `cdTipo` vai `undefined` |

Não tem faixa de definitivas nem combo de formato. Botão **"Excel"** → `imprimirExcel()` →
`POST /relatorio/imprimeArquivoDefinitiva` com `registros:[filtro]` (`deParametro` fica vazio). O
servidor decide o formato (o rótulo indica `.xls/.xlsx`). Existe também um método
`imprimeArquivoDefinitiva()` que usa `deImpressao`, mas não está ligado a nenhum botão.

Layout: igual à provisória — **montado no servidor**, não há colunas no cliente.

---

## Parte B — Cadastros e telas de sistema (só o que é novo ou diverge de `05-cadastros.md`)

### B.1 E-mails (`emails-selecao`, título "Cadastro de e-mails")

| Item | Detalhe novo |
|---|---|
| Chave | o próprio e-mail é a chave primária (`id.deEmail`) |
| Cobertura | **texto livre** (`deCobertura`, até 200 caracteres), não é seleção do cadastro de Coberturas |
| Filtros | `E-mail` e `Cobertura` + "Pesquisar" (Enter também pesquisa) |
| Validações | "Preencha o e-mail antes de salvar" · "Preencha a cobertura antes de salvar" · "Salve o último registro incluído antes de adicionar um novo e-mail!" |
| Estado vazio | "Não há Emails cadastradas!" / 'Cadastre Emails clicando em "Adicionar"' |
| Endpoints | `obterTodosEmails`, `salvarEmail`, `removerEmail` (cadastro) |
| Paginação | 15 cards |

Como o e-mail é a chave, editar o e-mail de um card existente e salvar provavelmente **cria outro
registro** em vez de renomear. Não há validação de formato de e-mail. Nenhuma outra tela do bundle
lê esse cadastro (só ele mesmo).

### B.2 Transportadoras (`transportadoras-selecao` + `transportadoras` + abas)

`05-cadastros.md` supôs padrão B (cards). **É padrão A** (grade + tela de edição com abas), igual a
Clientes/Parceiros.

| Parte | Conteúdo |
|---|---|
| Filtros | Razão Social/Nome · CNPJ/CPF · País · Endereço · Cidade · Estado (`deEstadoCalculado`) |
| Colunas (todas ordenáveis) | Código · Razão Social · Telefone · Nome Fantasia · Endereço · Cidade · Estado · País · Cnpj/Cpf · E-mail |
| Ações por linha | ✏ editar (ou duplo clique) · 🖨 imprimir — **o botão de imprimir não faz nada** (`imprimirCliente(){}`) |
| Paginação | **21** por página |
| Cabeçalho da edição | Código (desabilitado) · Razão Social (máx. 50) |
| Aba **Geral** | CNPJ/CPF (15) · Nome Fantasia (50) · CEP (8) · Endereço (50) · Complemento (50) · País / Estado / Cidade (combos encadeados via `obterCombosCidadesEstadosPaisesTransportadoras`) · Site (50) · E-mail (50) · DDD (3) · Telefone (10) · DDD Fax (3) · Fax (15) |
| Aba **Contatos** | grade "Contatos Gerais" (Nome · Telefone · E-mail · Setor) + "Novo Contato" → modal com Nome/Telefone/E-mail/Setor (50 cada), Salvar/Excluir/Voltar (`obterTodasTransportadorasContatos`, `salvarTransportadoraContato`, `removerTransportadoraContato`) |
| Botões | Voltar · Salvar · Excluir (com confirmação "Deseja realmente excluir esta transportadora?") |
| Validações | **nenhuma no cliente** — sem obrigatoriedade, sem validação de CNPJ |

O cadastro está vazio em produção (`09-api-legado.md`), então isso só importa como referência de
modelo.

### B.3 Observações (`app-observacao-selecao` + `app-observacao`, rota `ObservacaoSelecao`) — não documentado antes

Cadastro de textos padrão. Fora do menu.

| Parte | Conteúdo |
|---|---|
| Filtros | Código · Descrição + "Pesquisar" |
| Colunas | Código (`cdObservacao`) · Observação (`deObservacao`), ambas ordenáveis |
| Edição | Código (**digitado pelo usuário**, sem autonumeração) · texto em `textarea` de 7 linhas |
| Validação | "A descrição é obrigatória." — só barra string vazia; registro novo com campo nunca tocado (`undefined`) passa |
| Endpoints | `obterObservacao`, `salvarObservacao`, `excluirObservacao` |

Bugs: a mensagem "Observação salva com sucesso!" aparece **mesmo que o servidor devolva erro**
(`deMensagem` é ignorado no salvar); se a validação falha, o loader fica travado. Nenhuma outra tela
do bundle usa `cdObservacao` — o cadastro não alimenta nada no domínio de seguros.

### B.4 Empresas (`EmpresaSelecao` + `empresa`) — não documentado antes

É a **configuração do tenant do ERP Infoline**, compartilhada com o produto de seguros.

- Lista: filtros Código Empresa / Descrição Empresa; colunas Código / Empresa; impressão da lista em
  PDF, Excel 2007, Word, RTF, HTML, CSV ou Texto (`relEmpresaSelecao`). Endpoints `listarPesquisaEmpresa`,
  `obterEmpresaCompleta`, `salvarEmpresa`.
- O botão **"Incluir Empresa" só aparece para o usuário `Infoline`** (comparação literal de nome).
- Edição com dezenas de abas: Geral (CNPJ, IEs por UF, IM), Endereço (com busca de CEP
  `/global/buscaCep`), Endereço Entrega, Responsável, Contabilista e **Parâmetros** com subabas de ERP
  (Gerais, Comercial, Produtos, Contábil, Speed, DP, E-mail/SMTP, Suprimentos, Qualidade, PCP, Fiscal,
  Workflow/ROI, Faturamento, Financeiro, Locação, Email/Sms, contratos de locação, Logotipo,
  Correios, Impostos Gráfica, Proposta).

Os únicos pontos que tocam o produto de seguros:

| Campo | Onde | Por que importa |
|---|---|---|
| `flGloPermissaoPorMenu` ("Utiliza Permissão Por Menu") | Parâmetros › Gerais | liga/desliga o filtro de menus por perfil (B.6) |
| `nuIpRestrito` ("IP Restrito") | Parâmetros › Gerais | restrição de acesso por IP no nível da empresa |
| `imEmpCabecalhoProposta64` ("Logo Cabeçalho Proposta") | aba Proposta | provável imagem do cabeçalho das propostas geradas |
| `imEmpLogotipo64`, `…Retangulo64`, `…Monocromatica64` | aba Logotipo | logos usados em relatórios |
| SMTP (servidor, porta, SSL/TLS, e-mail de cópia) | Parâmetros › E-mail | provável conta de envio de e-mails do sistema |

O login **fixa `cdEmpresa = "Fidcargo"`** no código (`retornoValidacao`), então na prática só existe
um tenant.

### B.5 Perfis (`PerfilSelecao` + `perfil`) — divergências

| Item | `05-cadastros.md` | O código |
|---|---|---|
| Coluna "Empresa" | tratada como empresa | o cabeçalho diz "Empresa", mas a célula é **`dePerfil`** (descrição do perfil) |
| Incluir perfil | não citado | botão **só para o usuário `Infoline`** |
| Validação | — | "Cód. do Perfil é obrigatório!" (código digitado à mão) |
| Usuários disponíveis/permitidos | transferência dupla | cada clique (✔/✖ ou duplo clique) **grava na hora** (`adicionaUsuarioPermitido` / `removeUsuarioPerfil`, com `deParametro = cdPerfil`) — não espera o Salvar |
| Aba Permissões | 2 checkboxes | campos `flPortadoresImpressao` e `flPermiteAcessoExterno` |
| Aba Menu | "itens sem rótulo" | explicado em B.6 |

### B.6 Menu lateral e permissões por menu (`app-component-menu`, `treeviewMenus`)

**Estrutura do nó de menu** (vem pronta do servidor em `/contaUsuario/buscaMenu`, chamado logo após o
login):

| Campo | Uso |
|---|---|
| `cdMenu` | id do nó |
| `deMenu` | rótulo |
| `routerLink` | rota; o link é sempre `[routerLink, "Menu"]` → `#/<Rota>/Menu` |
| `deLink` | se `"emContrucao"`, mostra "Em Construção" em azul; senão mostra o próprio `deLink` em vermelho ao lado do rótulo |
| `deIcone` | se preenchido, o item vira **card de atalho** na Home (`populaMenu` varre até 6 níveis e ordena por `deMenu`) |
| `subMenus` | filhos; um item com filhos é só expansor, sem rota |

- **O filtro de permissão é todo do servidor**: o front desenha o que `buscaMenu` devolve.
- **Não há guardas de rota** (nenhum `canActivate` no bundle). Esconder do menu não bloqueia o acesso:
  qualquer rota funciona digitando a URL — foi assim que `PerfilSelecao` foi aberta no mapeamento.
- No cabeçalho, o atalho para **Comandos SQL** (`/ComandosSqlSelecaoComponent`) só aparece para o
  usuário `Infoline`, mas a rota também não tem guarda.

**Editor de permissões (`treeviewMenus`, aba Menu do perfil):**

- Cada nó tem `flPermitido` = `"sim"`/`"nao"`, um selo "Permitido"/"Não Permitido" e um botão ✔/✖.
- O clique chama `/perfil/alteraMenu` com `{id:{cdEmpresa, cdPerfil, cdMenu}}`; o servidor **alterna**
  o estado e devolve o novo valor em `deParametro`. Grava na hora.
- A lista vem de `/perfil/obterMenus` como **JSON dentro de string** (`registros.listaMenusDisponiveis`,
  lido com `JSON.parse`).
- **Por que os itens aparecem sem rótulo** (observado em `05-cadastros.md`): a condição que exibe o
  rótulo de um nó com filhos é `listaMenu != null && !listaMenu && listaMenu.length != 0`, que é
  sempre falsa para um array. E o nó folha só aparece se `listaMenu` for nulo/vazio. Resultado: **nós
  com filhos ficam sem rótulo e sem botão de expandir**, e os filhos ficam num `collapse` fechado.
  Na prática só dá para alternar a permissão dos nós de primeiro nível, sem saber qual é qual.

### B.7 Usuários (`ContaUsuarioSelecao` + `contaUsuario`) — divergências

| Item | Detalhe novo |
|---|---|
| Listagem | `/contaUsuario/obterTodosUsuariosEmpresaSelecao`, 15 por página; confere com o doc |
| Chave | `id.cdContaUsuario` é o **login** e é editável na tela; "Código" exibido é `usuCodigo` (só leitura) |
| Validação | só "Código do Usuário é obrigatório." (login vazio) |
| **Zerar Senha** | faz `deSenha = ""` e chama o mesmo `salvarContaUsuario` — a senha fica **vazia** (não gera senha temporária nem envia e-mail) |
| Token | campo `deToken` editável à mão |
| Código morto | o componente tem métodos de horários de acesso, foto do usuário e "representante de vendas" herdados do ERP, sem nada no template |

### B.8 Alterar imagem do usuário (`AlteracaoImagemUsuario`)

Tela de upload com recorte (`image-cropper`, PNG, proporção fixa), pré-visualização, download e
remoção. Salvar chama `/contaUsuario/salvarContaUsuario`.

**Bug grave:** `obterUsuarioComFoto()` só preenche `deParametro` e **nunca busca o usuário**. O objeto
salvo é um usuário **vazio** com apenas `imUsuario64`. Dependendo do servidor, salvar pode falhar,
criar um registro sem login ou sobrescrever dados. Não testar em produção.

### B.9 Alterar senha (`app-alterar-senha`)

Fluxo em duas etapas: (1) "Para continuar, primeiro confirme que é realmente você: Digite sua senha" →
`authService.validaLogin`; (2) "Digite sua nova senha" / "Redigite sua nova senha" →
`authService.alterarSenha` (valida "As senhas não coincidem!"; sucesso = `deMensagem` que não começa
com "Erro", mostrado num `alert()`, seguido de logout).

**Bug:** `retornoValidaSenha` só desliga o loader e **nunca liga `senhaOK`**, então a etapa 2 nunca
aparece. A tela parece inutilizável pelo front. Não há regra de força de senha.

### B.10 Console SQL (`comandos-sql-selecao`, rota `ComandosSqlSelecaoComponent`)

Título "Comandos SQL". Três `textarea`: **SQL** (entrada), **Retorno da query** (JSON formatado com
indentação 5) e **Status da query** (mensagem de erro, em vermelho). O botão "Executar" manda o texto
digitado em `deParametro` para `POST /cadastro/executaScriptSql`; o retorno vem em
`registros[0].deJson`. **SQL arbitrário, sem allowlist nem confirmação.** Fica no cabeçalho para o
usuário `Infoline` e a rota não tem guarda (B.6). Reaproveita por engano o buffer da tela de Empresas.
Nada disso foi executado.

---

## Implicações para o sistema novo

- **Relatórios:** o legado calcula tudo no servidor (exceto o % de rentabilidade) e manda os totais
  "pendurados" no último registro. No novo, cada relatório deve ter um endpoint que devolva
  `{rows, totals, pagination}` separados, com colunas iguais para todos os tipos (vazias quando não
  se aplicam), em vez de colunas que somem e desalinham.
- **Excel** gerado a partir dos dados (números como número), não raspando a tela.
- **Ações em lote que escrevem** (`atualizarTxIrb`, `emitirIrbTransacoesProducao`) não devem morar
  dentro de um relatório; viram ações explícitas, com pré-visualização dos processos afetados e
  auditoria.
- **Arquivos de provisórias/definitivas:** o layout precisa ser levantado de um arquivo real antes de
  implementar (ver pontos a validar).
- **Permissões:** checar no backend (guardas por rota e por endpoint), não só no menu; nada de
  privilégio por nome de usuário literal (`"Infoline"`).
- **Fora de escopo para portar:** Empresas (ERP), Observações (sem uso), Console SQL.

---

## Pontos a validar com dado real

1. **Totais dos rankings:** o último registro de `obterTodasTransacoes{ApolicesEstados,Clientes,Parceiros}`
   é uma linha de totais (que então aparece duplicada na grade) ou todas as linhas trazem os campos
   `total*`? E os totais são da página ou do período inteiro?
2. **`vlPercentual` nos rankings:** é a participação sobre o total de prêmio, de I.S. ou de processos?
   É sobre o período inteiro ou só a página?
3. **`vlResultadoDolar`:** no ranking de clientes é `prêmio cliente − prêmio seguradora`? No de
   parceiros desconta também `vlComissaoParceiroDolar` e IRB?
4. **Agrupamento por estado:** é a UF do cliente ou o destino/origem da carga? E a coluna "Número" do
   ranking por apólice (`cdApolice`) equivale a qual apólice do cadastro?
5. **Planilha Produção sem paginação:** com mais de 50 processos no período, o servidor devolve tudo
   ou só 50? O Excel sai completo?
6. **Relação entre `vlDolarAPagar`, `vlFinalPremioSeguradoraDolar` e `vlDolarAPagarAgravo20`:** a
   coluna "A Pagar Seguradora USD" soma `vlDolarAPagar`, mas o total exibe
   `totalVlFinalPremioSeguradoraDolar`. São o mesmo valor? E o agravo é
   `vlDolarAPagar × (1 − 0,25 %)` na importação e `× (1 − 0,30 %)` na exportação (`11-dicionario-dados.md`)?
7. **`vlDiferencaReal`:** é `vlPremioOverReal − vlRealAPagar`? (Usado no % de rentabilidade.)
8. **Exportação na Planilha Produção:** confirmar o desalinhamento (11 células, 14 cabeçalhos,
   17 totais) e o significado de `totalVlPremioOverDolarIrbDolar/Real` e
   `totalVlDiferencaDolar/RealExportacao`.
9. **`cdTipo = "undefined"` (string)** nos rankings: quando o usuário volta para "Todos", o servidor
   trata a string como "todos" ou filtra errado?
10. **Arquivo de Provisórias:** baixar um arquivo de cada formato (CSV, Normal, Separador) para
    documentar o layout campo a campo, a extensão e qual seguradora o consome.
11. **Arquivo de Definitivas:** qual o formato real do "Excel" e o que acontece sem escolher
    Importação/Exportação (`cdTipo` indefinido)?
12. **Impressões:** confirmar que `imprimeProvisoria`/`imprimeDefinitiva` devolvem PDF e qual o
    modelo (certificado de averbação da seguradora?). Com a faixa vazia, imprime tudo?
13. **Menu por perfil:** `flGloPermissaoPorMenu` está ligado no tenant Fidcargo? Se não, o perfil
    "Operacional" e suas permissões de menu não têm efeito algum.
14. **Alterar senha / Alterar imagem:** confirmar com a Infoline se as duas telas estão de fato
    quebradas (não testar o salvar em produção).
15. **E-mails:** editar o e-mail de um card cria um registro novo? (consultar, não testar em produção).
16. **Console SQL:** confirmar com a Infoline se `/cadastro/executaScriptSql` está ativo em produção e
    se o servidor restringe o usuário — é um risco de segurança independente do front.
