# Legado — módulo Financeiro (numerário, IRB/RME, intermediação, NF)

Engenharia reversa **estática** do bundle Angular do Coomex Hub (`main-S4VFPNOX.js`), sem acesso ao
servidor. Cobre as telas do menu *Financeiro* e as telas de apoio que elas abrem. Complementa
[`08-fluxos.md`](08-fluxos.md) (fluxo financeiro), [`11-dicionario-dados.md`](11-dicionario-dados.md)
(campos) e [`09-api-legado.md`](09-api-legado.md) (endpoints).

> **Conclusão principal:** o cliente **não calcula nada** no financeiro. Todo valor monetário
> (totais, comissão, IRB, diferença cambial, valor solicitado e valor por extenso) vem pronto do
> servidor Java (`/numerario/calculaNumerario`, `/averbacao/calculaTransacao`, `/numerario/obter*`).
> O front só formata (`number:'1.2-2'`, `'1.4-4'`), escolhe colunas por `ngIf` e monta o HTML de
> impressão. As fórmulas da seção 6 são, portanto, **hipóteses** derivadas dos rótulos e de
> casos já conferidos; precisam ser validadas com dados reais (seção 9).

Convenções do legado usadas abaixo:
- Toda chamada é `POST` com o envelope `paginas` (`nuPagina`, `qtRegistrosPorPagina`, `cdEmpresa`,
  `cdRestricao`, `cdUsuario`, `deParametro` = `"coluna,asc|desc"`, `registros: [...]`). A resposta
  traz `deMensagem` (erro de negócio, exibido em modal) e `registros`.
- `cdTipo`/`tpIrb`: `0` = Importação, `1` = Exportação. `cdStatus`: `0` Cotação, `1` Provisória, `2` Definitiva.
- Checkbox marcado = `flCheckBoxSelecionada == -1`.
- "Telas" internas (detalhe, impressão) não são rotas: são componentes filhos trocados por `ngIf`
  (`selecao = false`). Voltar = evento `resposta`.

---

## 1. Mapa das telas e do fluxo

| Menu / rota | Componente (seletor) | Papel |
|---|---|---|
| Solicitar numerário · `#/NumerarioSelecao` | `numerario-selecao` (modo padrão) | lista definitivas, gera numerário em lote |
| Numerários Pagos · `#/NumerariosPagos` | `numerarios-pagos` → `numerario-selecao` com `isNumerarioPago=true` | consulta de numerários baixados |
| Emissão IRB · `#/NumerariosChequeIRB` | `numerarios-cheque-IRB` → `numerario-selecao` com `isNumerarioChequeIRB=true` | seleciona exportações/importações e emite IRB (RME) |
| (filho) | `numerario` | detalhe do numerário: calcular, salvar, baixar |
| (filho) · `#/NumerarioImpressao` | `numerario-impressao` | carta de solicitação de numerário (impressão) |
| (modal) | `editar-infoline` | estorno de baixa — só para o usuário `Infoline` |
| `#/IrbEmitidaSelecao` (fora do menu) | `irb-emitida-selecao` | lista de IRBs/RMEs emitidos |
| (filho) · `#/IrbEmitida` | `irb-emitida` ("Alterar IRB") | registra cheque/taxa do IRB |
| (filho) · `#/PlanilhaIrb` | `planilha-irb` | planilha dos processos de um RME |
| (filho) · `#/EmissaoRme` | `emissao-rme` | Recibo de Pagamento em Moeda Estrangeira (6 vias) |
| Pagamento de Intermediação de Negócios · `#/PagamentoComissaoSelecao` | `pagamento-comissao-selecao` | seleciona comissões e solicita NF |
| Intermediação de Negócios Emitidas · `#/ComissaoEmitidaSelecao` | `comissao-emitida-selecao` | lista as solicitações de comissão |
| (filho) | `comissao-emitida` | detalhe: imprimir solicitação de NF, registrar pagamento |
| Emissão NF · `#/Nf` | `nota-fiscal` | fechamento por período (Recebido/IRB/Comissão/Resultado) |
| NF's Emitidas · `#/NfEmitida` | `NfEmitida` | lista de fechamentos gerados; reabre o `nota-fiscal` |

```
 Definitiva (posição "Falta enviar Numerário")
   │  NumerarioSelecao: marca linhas, escolhe "Pagamento Comissão" (Direta/NF) por linha,
   │  opcional "Agrupado" → [Solicitar Numerário]  POST /numerario/solicitarNumerario
   ▼
 Numerário criado (versão 1) — posição "Numerário enviado"
   │  [Editar] → tela numerario → calculaNumerario automático → [Ver Numerário] → imprimir carta
   │  cliente/parceiro paga → operador informa Data de pagamento, Taxa dólar, Valor Recebido
   │  [Calcular] (/numerario/calculaNumerario) → [Baixar] (/numerario/baixarNumerario)
   │      └─ se servidor devolve mensagem (diferença) → confirma Sim/Não → dif=1/-1 → baixar de novo
   ▼
 Numerário pago — aparece em Numerários Pagos (posição "Recebido"/"Numerário pago")
   │
   ├─► Exportação/IRB: NumerariosChequeIRB → [Emitir IRB] (/numerario/emitirIrb)
   │       └─ IrbEmitidaSelecao → Editar (cheque, taxa, apólice) / Planilha IRB → Imprimir RME
   │
   └─► Comissão por NF (cdComissao = 1): PagamentoComissaoSelecao → [Solicitar Nota Fiscal]
           (/numerario/solicitarNotaFiscal) → ComissaoEmitidaSelecao → Imprimir solicitação NF
           (/numerario/imprimirSolicitacaoNF) → informar Data de pagamento → Salvar (/numerario/salvarComissao)

 Fechamento do período: Nf → [Gerar] (/NotaFiscal/obterTodasNf) → NfEmitida lista os gerados
```

### 1.1 Endpoints usados pelo módulo

| Método do service | Endpoint | Tipo | Chamado por |
|---|---|---|---|
| `obterTodasTransacoes` | `/numerario/obterTodasTransacoes` | leitura | numerario-selecao (3 modos) |
| `obterNumerario` | `/numerario/obterNumerario` | leitura | numerario-selecao, numerario-impressao |
| `obterTransacoesNumerario` | `/numerario/obterTransacoesNumerario` | leitura | numerario-selecao (processos do numerário) |
| `solicitarNumerario` | `/numerario/solicitarNumerario` | **escrita** | numerario-selecao |
| `calculaNumerario` | `/numerario/calculaNumerario` | cálculo (retorna objeto; não se sabe se persiste) | numerario, numerario-impressao |
| `salvarNumerario` | `/numerario/salvarNumerario` | **escrita** | numerario |
| `baixarNumerario` | `/numerario/baixarNumerario` | **escrita** | numerario |
| `salvarNumerarioEditarInfoline` | `/numerario/salvarNumerarioEditarInfoline` | **escrita** | editar-infoline |
| `calculaTransacao` | `/averbacao/calculaTransacao` | cálculo | numerario-impressao (uma chamada por processo) |
| `emitirIrb` | `/numerario/emitirIrb` | **escrita** | numerario-selecao (modo IRB) |
| `obterTodasIrbs` | `/numerario/obterTodasIrbs` | leitura | irb-emitida-selecao |
| `obterTransacoesIrbs` | `/numerario/obterTransacoesIrbs` | leitura | irb-emitida-selecao |
| `salvarIrb` | `/numerario/salvarIrb` | **escrita** | irb-emitida |
| `obterListaApolice` | `/cadastro/obterListaApolice` | leitura | irb-emitida (select Apólice) |
| `obterListaApoliceTransacao` | `/numerario/obterListaApoliceTransacao` | leitura | planilha-irb |
| `obterListaApoliceTransacaoProrrogacao` | `/numerario/obterListaApoliceTransacaoProrrogacao` | leitura | planilha-irb |
| `obterListaTransacaoRme` | `/numerario/obterListaTransacaoRme` | leitura | emissao-rme |
| `obterTodasTransacoesPagamentosComissoes` | `/numerario/obterTodasTransacoesPagamentosComissoes` | leitura | pagamento-comissao-selecao |
| `solicitarNotaFiscal` | `/numerario/solicitarNotaFiscal` | **escrita** | pagamento-comissao-selecao |
| `obterTodasComissoes` | `/numerario/obterTodasComissoes` | leitura | comissao-emitida-selecao |
| `obterComissao` | `/numerario/obterComissao` | leitura | comissao-emitida-selecao (definido, não usado no fluxo) |
| `obterTransacoesComissoes` | `/numerario/obterTransacoesComissoes` | leitura | comissao-emitida |
| `salvarComissao` | `/numerario/salvarComissao` | **escrita** | comissao-emitida |
| `imprimirSolicitacaoNF` | `/numerario/imprimirSolicitacaoNF` | gera arquivo (base64) | comissao-emitida |
| `obterTodasNf` | `/NotaFiscal/obterTodasNf` | provável escrita (gera fechamento) | nota-fiscal |
| `listarNfEmitida` | `/NotaFiscal/listarNfEmitida` | leitura | NfEmitida |
| `atualizarTxIrb` | `/relatorio/atualizarTxIrb` | **escrita em lote** | relatorio-producao |
| `emitirIrbTransacoesProducao` | `/relatorio/emitirIrbTransacoesProducao` | **escrita em lote** | relatorio-producao |

Sem uso em nenhuma tela: `/numerario/removerNumerario`, `/numerario/obterImagemBase64`.
Note o prefixo `/NotaFiscal/` (maiúsculo) da NF de seguros, diferente do `/notaFiscal/` do ERP Infoline.

---

## 2. Numerário

### 2.1 `numerario-selecao` — "Solicitar Numerário" / "Numerários Pagos" / "Solicitação de Cheque IRB"

Um único componente com três modos, controlados por `filtroTransacao.isNumerarioPago` e
`filtroTransacao.isNumerarioChequeIRB` (as rotas `NumerariosPagos` e `NumerariosChequeIRB` são
wrappers de 1 linha que só setam esses flags). Título da página muda conforme o modo.
Carrega na abertura (`ngAfterViewInit → obterTodasTransacoes`), 35 registros por página,
componente `paginacao`. Enter em qualquer filtro pesquisa.

**Filtros** (todos os modos; enviados como `registros[0]` = `filtroTransacao`):

| Rótulo | Campo | Observação |
|---|---|---|
| Data inicial: | `dtInicialFiltro` | |
| Data final: | `dtFinalFiltro` | desabilitado até preencher a inicial |
| Processo inicial: | `cdTransacaoInicialFiltro` | ao digitar, copia o valor para o final |
| Processo final: | `cdTransacaoFinalFiltro` | desabilitado até preencher o inicial |
| Averbação inicial: | `nuAverbacaoIncialFiltro` (sic) | copia para o final |
| Averbação final: | `nuAverbacaoFinalFiltro` | desabilitado até preencher o inicial |
| Código do cliente: + Descrição | `cdCliente` / `deCliente` | lupa → `/cadastro/obterTodosClientesPesquisa` |
| Código do parceiro: + Descrição | `cdParceiro` / `deParceiro` | lupa → `/cadastro/obterTodosParceirosPesquisa` |
| Tipo: | `cdTipo` | Todos / Importação (0) / Exportação (1); zerado ao abrir |
| Situação: | `cdPosicao` | **só no modo Solicitar**: Todos / "Numarários à emitir" (1) / "Numarários atrasados" (2) — grafia "Numarários" no original; zerado ao abrir |

**Colunas** (ordem real; `IRB` = modo Cheque IRB, `Pago` = modo Numerários Pagos):

| # | Cabeçalho | Valor | Formato | Visível em |
|---|---|---|---|---|
| 1 | (ações) | botão **Editar** (lápis azul) se `idNumerario != null` e não-IRB · botão **Editar Infoline** (amarelo) se `cdUsuario == "Infoline"` · checkbox se `idNumerario == null` **ou** modo IRB | — | todos |
| 2 | Versão | `cdVersao` | texto | Solicitar, Pago |
| 3 | Processo ↕ | `id.cdTransacao` | texto | todos (ordenável) |
| 4 | Data Transação | `dtTransacao` | dd/MM/yyyy | IRB |
| 5 | Data Cobrança | `dtNumerario` | dd/MM/yyyy | Solicitar, Pago |
| 6 | Data Pagamento ↕ | `dtPagamentoNumerario` | dd/MM/yyyy | Pago (ordenável) |
| 7 | Forma Cobrança | texto fixo "Numerário" se ainda sem numerário; senão `deFormaCobranca` | — | Solicitar, Pago |
| 8 | Pagamento Comissão | **select editável** `cdComissaoTransacao` (Direta = 0 / Nota Fiscal = 1) se sem numerário; senão `deComissao` | — | Solicitar, Pago |
| 9 | Cliente | `deCliente` | | todos |
| 10 | Parceiro | `deParceiro` | | todos |
| 11 | Tipo ↕ | `cdTipo==0 ? "Importação" : "Exportação"` | | todos |
| 12 | Status ↕ | `deStatus` | | todos |
| 13 | Posição | `dePosicao` | | todos |
| 14 | Prêmio US$ | `vlFinalPremioClienteDolar` | 1.2-2 | todos |
| 15 | Averbação | `deStatusSigla` + `id.nuAverbacao` (vazio se 0) | ex. "D 106493" | todos |
| 16 | Moeda | `deMoedaSigla` | | IRB |
| 17 | I.S. | `vlMercadoria` | 1.2-2 | IRB |
| 18 | Recebido R$ | `vlFinalPremioClienteReais` | **sem formatação** (bug) | Pago |

Rodapé (só modo Pago): linha "**Total:**" (colspan 14) com `filtroTransacao.vlTotalFinalPremioClienteReais`
(1.2-2). Esse total **não é somado no cliente**: é lido do **último registro** da página
(`listaTransacao[length-1].vlTotalFinalPremioClienteReais`) — o servidor injeta o total em cada linha.

**Botões e ações**

| Botão | Condição | Método → endpoint | Comportamento |
|---|---|---|---|
| ↻ (reload) | sempre | `obterTodasTransacoes` → `/numerario/obterTodasTransacoes` | pesquisa |
| **+ Solicitar Numerário** | modo Solicitar | `solicitarNumerario` → `/numerario/solicitarNumerario` | ver regra abaixo; toast "Numerário solicitado com sucesso!" e recarrega |
| ☐ **Agrupado** (checkbox) | modo Solicitar | grava `filtroTransacao.isAgrupado` | enviado só no último item selecionado |
| **✓ Emitir IRB** | modo IRB | `emitirIrb` → `/numerario/emitirIrb` | envia as linhas marcadas; toast "IRB emitido com sucesso!" |
| Editar (lápis) | linha com numerário, não-IRB | `visualizaNumerario` → `/numerario/obterNumerario` + `/numerario/obterTransacoesNumerario` | abre `numerario` após 500 ms |
| Editar Infoline | usuário `Infoline` | idem + abre modal `editar-infoline` | |
| Ordenar | cabeçalhos Processo, Tipo, Status, Data Pagamento | `deParametro = "coluna,asc/desc"` | |

**Regra do `solicitarNumerario` (cliente):**
```
selecionadas = listaTransacao.filter(l => l.flCheckBoxSelecionada == -1)
selecionadas[último].isAgrupado = filtroTransacao.isAgrupado      // flag só no último item
erros = Σ validacaoTransacao(l) para cada selecionada
se erros ≠ "" → modal "Verificar seguintes informações:" + erros; não envia
senão POST /numerario/solicitarNumerario { registros: selecionadas }   // cada uma leva cdComissaoTransacao
```
`validacaoTransacao` só valida **Importação Definitiva** (`cdTipo==0 && cdStatus==2`):

| Campo exigido | Mensagem |
|---|---|
| `cdModal` | Campo modal é obrigatório! |
| `cdPaisOrigem` | Campo País Origem é obrigatório! |
| `cdCidadeOrigem` | Campo Cidade Origem é obrigatório! |
| `cdPais` | Campo País Destino é obrigatório! |
| `cdCidade` | Campo Cidade Destino é obrigatório! |
| `dtEmbarque` | Campo Data de **Saida** é obrigatório! |
| `dtSaida` | Campo Data de **Chegada** é obrigatório! (nome do campo invertido em relação ao rótulo) |
| `cdNavio` se `cdModal == 2` (marítimo) | Campo Código do navio é obrigatório! |

Prefixo de cada bloco: `Transação:<cdTransacao>`. Exportações e provisórias passam sem validação.

Não há botão de excluir numerário (o endpoint `removerNumerario` existe, mas nenhuma tela o chama).

### 2.2 `numerario` — detalhe ("Solicitar Numerário")

Recebe `numerarioSelecionado` e `listaTransacaoNumerario`. **Ao abrir, chama `calculaNumerario`
automaticamente** (silencioso na 1ª vez; nas seguintes, toast "Cálculo realizado com sucesso!").

**Campos do formulário**

| Rótulo | Campo | Tipo / regra |
|---|---|---|
| Forma de cobrança: | `cdFormaCobranca` | select com uma opção: Numerario (0) |
| Comissão: | `cdComissao` | Direta (0) / Nota Fiscal (1) |
| Carta: | `cdCarta` | 1 / 2 / 3 (número da carta de cobrança) |
| Data da 1ª solicitação: | `dtPrimeira` | sempre desabilitado |
| Data da última solicitação: | `dtNumerario` | desabilitado se `isNumerarioPago` |
| Data de pagamento: | `dtPagamento` | desabilitado se `isNumerarioPago` |
| Versão | `cdVersao` | desabilitado |
| Taxa dolar | `txDolar` | 4 decimais, editável |
| Valor Recebido: | `vlRecebido` | editável; botão **Calcular** (ícone calculadora) ao lado |
| Valor do Prêmio US$: | `vlFinalPremioClienteDolar` | desabilitado |
| Cheque IRB R$: | `vlIrbReal` | desabilitado; só se `cdTipo == 1` (exportação) |
| Valor Diferença US$: | `vlDiferenca` | desabilitado; só se `vlDiferenca != 0` |
| Valor da Comissao R$: | `vlTotalComissaoParceiroReal` | **editável**; só se `cdComissao == 0` (Direta) |
| Valor à Receber R$: | `vlPremioOverReal` | **editável**; só se `cdComissao == 0` (Direta) |
| Situação: | `validaSituacao()` | "Pendente" se sem `dtPagamento`; senão o texto literal **"Status"** (bug) |

**Grade de processos do numerário** (15 por página, `pagination`): Processo (`id.cdTransacao`) ·
Data (`dtTransacao`, dd/MM/yyyy) · Tipo · Averbação (`id.nuAverbacao`) · Cliente (`deCliente`) ·
**Valor Real** (`vlProrrogacaoClienteReal`, 1.2-2) só se `cdComissao == 1 && flProrrogacao`.

**Botões**

| Botão | Condição | Método → endpoint | Efeito |
|---|---|---|---|
| Voltar | sempre | emite `resposta` | volta à lista e recarrega |
| 🖨 Ver Numerário | sempre | troca para `numerario-impressao` | |
| Calcular | sempre | `/numerario/calculaNumerario` com o numerário inteiro | substitui `numerarioSelecionado` pelo retorno |
| 📖 Salvar | `!isNumerarioPago` | `/numerario/salvarNumerario` | toast "Numerário salvo com sucesso!" |
| 📖 Baixar | `!isNumerarioPago` | `/numerario/baixarNumerario` | exige `dtPagamento` ("Preencha o campo da data de pagamento antes de continuar"); sucesso → "Numerário baixado com sucesso!" e volta |

**Baixa com diferença** (`baixar` → `difOK`):
```
resp = POST /numerario/baixarNumerario {numerario}
se resp.deMensagem vazio → sucesso
senão → confirma(titulo "Atenção", mensagem = resp.deMensagem)
        Sim → numerario.dif = 1 ; Não → numerario.dif = -1 ; chama baixar() de novo
```
O texto da pergunta vem do servidor; o flag `dif` diz ao servidor como tratar a diferença entre
valor recebido e valor cobrado (provavelmente: gerar nova versão/cobrança da diferença ou aceitar).

### 2.3 `editar-infoline` — estorno de baixa (modal "Numerário")

Visível só para `cdUsuario == "Infoline"` (o fornecedor). Campo **Data de pagamento** (desabilitado),
botões **Limpar Data** (`dtPagamento = undefined`, só no cliente) e **Salvar**
(`/numerario/salvarNumerarioEditarInfoline`). Na prática é o único meio de "desbaixar" um numerário.

### 2.4 `numerario-impressao` — carta de solicitação de numerário

Ao abrir (após 100 ms): `obterNumerario` → em seguida `calculaNumerario`; em paralelo,
**uma chamada `/averbacao/calculaTransacao` por processo** de `listaTransacaoNumerario`, empurrando
cada retorno em `listaTransacaoNumerarioCalculada` (a ordem das linhas impressas é a ordem de chegada
das respostas, não a do processo — bug latente). Logo: `assets/images/pinhologo.png`.
**Imprimir** gera HTML (Arial 13px, margem 0,5 cm, borda arredondada) e abre em nova aba via blob
(`printService.print(base64,"","html")`) — nada vai ao servidor.

**Layout (de cima para baixo)**

| Bloco | Conteúdo | Origem |
|---|---|---|
| Cabeçalho | logo (ou "COOMEX" em azul #120a8f se a imagem falhar); "seguro@coomexhub.com"; linha | fixo |
| Data | "Curitiba, dd de MMMM de yyyy" | `dtNumerario` |
| Aviso | "**ESTA SOLICITAÇÃO SUBSTITUI A ANTERIOR**" (vermelho) | se `flCartaCobranca` |
| Destinatário | "À" + nome em MAIÚSCULAS | `cdInstrucaoCobranca == 0` → `deCliente`; `== 1` → `deParceiro` |
| Referência | "REF. SEGURO DE TRANSPORTE INTERNACIONAL - IMPORTAÇÃO/EXPORTAÇÃO" (+ " - CLIENTE" se cobrança via parceiro) · na prorrogação: "REF. PRORROGAÇÃO SEGURO DE TRANSPORTE INTERNACIONAL" | `cdTipo`, `flProrrogacao`, `cdInstrucaoCobranca` |
| Pedido | "Solicitamos nos enviar o valor de **R$ {vlSolicitado}** {deSolicitado}" | `vlSolicitado` **sem formatação**; `deSolicitado` = provável valor por extenso, vindo do servidor |
| Tabela | ver abaixo | linhas = `calculaTransacao`; totais = numerário |
| Câmbio | "Taxa de Conversão : {txDolar}" | 1.4-4 |
| Prorrogação | "Valor a cobrar do cliente R$ {vlTotalProrrogadaReal}" e "Valor a depositar R$ {Direta: vlTotalPremioLiquido · NF: vlTotalProrrogadaReal}" (vermelho) | só se `flProrrogacao` |
| Validade | "* ESTE VALOR É VÁLIDO PARA PAGAMENTO ATÉ dd/MM/yyyy ÀS 16:00 H" | `dtPrevista` |
| Textos fixos | "* IMPRESCINDÍVEL O ENVIO DO COMPROVANTE DE DEPÓSITO VIA E-MAIL"; cláusula de variação cambial (devolução se a maior, cobrança da diferença se a menor); "O Comprovante de pagamento e o certificado de seguro lhes serão enviados logo após o recebimento do valor acima." | fixo |
| Dados bancários | COOMEX INTELIGENCIA LOGISTICA LTDA · CNPJ 67.020.194/0001-68 · Banco Bradesco · Agência 1205-0 · Conta corrente 30234-1 · Chave PIX 67020194000168 | **fixo no código** |
| Fecho | "Ficamos a sua inteira disposição para qualquer esclarecimento." | fixo |

O cabeçalho da cobrança via parceiro vem do campo **"Cobrança via:"** da cotação
(`cdInstrucaoCobranca`: 0 = Coomex Inteligencia Logistica Ltda, 1 = Parceiro).

**Tabela — colunas por cenário** (`Imp`/`Exp` = `cdTipo`; `Dir`/`NF` = `cdComissao` 0/1; `Pr` = `flProrrogacao`)

| Coluna | Valor por linha | Imp·Dir | Imp·NF | Exp·Dir | Exp·NF | Pr |
|---|---|:-:|:-:|:-:|:-:|:-:|
| Processo | `cdTransacao` + "-" + `nuEmbalagemNumero` (2 dígitos, ex. 2085-01) | ✔ | ✔ | ✔ | ✔ | ✔ |
| Averbação | Imp: "P {nuProvisoria} / D {nuAverbacao}" (definitiva) ou "P {nuAverbacao}" (provisória); Exp: "E {nuAverbacao}" | ✔ | ✔ | ✔ | ✔ | ✔ |
| Prorrogação | `nuProrrogacao` | | | | | ✔ |
| Exportador | `deMarca` | ✔ | ✔ | | | Imp |
| Ref. | `nuReferencia` | ✔ | ✔ | ✔ | ✔ | ✔ |
| Fatura | `deGuia` | ✔ | ✔ | ✔ | ✔ | ✔ |
| AWB\CRT\BL | `nuConhecimentoEmbarque` | ✔ | ✔ | | | Imp |
| Prêmio US$ | `vlFinalPremioClienteDolar` (Pr: `vlProrrogacaoCliente`) | ✔ | ✔ | ✔ | ✔ | ✔ |
| Prêmio R$ | `vlFinalPremioClienteReais` (Pr: `vlProrrogacaoClienteReal`) | ✔ | ✔ | ✔ | ✔ | ✔ |
| Com.R$ | `vlComissaoParceiroReal` (Pr: **`vlComissaoParceiroDolar`** — dólar na coluna R$, bug) | ✔ | | ✔ | | Dir |
| Cheque IRB R$ | `vlIrbReal` | | | ✔ | ✔ | |
| Prêmio Total R$ | Imp·Dir e Exp·Dir: `vlPremioOverReal` · Exp·NF: `vlPremioLiqOverSComiReal` · Pr·Imp·Dir: `vlProrrogacaoClienteReal` | ✔ | | ✔ | ✔ | Imp·Dir |

> Bug de layout na prorrogação: a linha tem uma célula a mais (`nuConhecimentoEmbarque` formatado
> como número, 1.2-2) do que o cabeçalho, deslocando as colunas de valor.

**Linhas de total** (valores do **numerário**, não somados no cliente)

| Linha | Condição | Células |
|---|---|---|
| **Total** | sem prorrogação | `vlTotalDolar` · `vlTotalReal` · [Dir: `vlTotalComissaoParceiroReal`] · [Exp: `vlIrbReal`] · [Dir: `vlTotalPremioLiquido`] · [Exp·NF: `vlTotalPremioComissao`] |
| **Total** | prorrogação | `vlTotalProrrogada` · `vlTotalProrrogadaReal` · [Dir: `vlTotalComissaoParceiroReal`, `vlTotalPremioLiquido`] |
| **Pagamento Anterior** | `vlPagamentoAnterior != 0` | `vlPagamentoAnterior` (US$) · `vlPagamentoAnteriorReal` · [Dir: "-" · `vlPagamentoAnteriorReal`] |
| **A Pagar** | `vlPagamentoAnterior != 0` | `subTotal` (US$) · `subTotalReal` · [Dir: "-" · `vlTotal`] |

As linhas "Pagamento Anterior"/"A Pagar" aparecem nas **versões 2+** (complemento de diferença
cambial): o valor já pago é abatido e só a diferença é cobrada.

### 2.5 Numerários Pagos e Solicitação de Cheque IRB

São o mesmo `numerario-selecao` (2.1). Diferenças:
- **Pagos**: sem filtro Situação, sem botões de ação em lote, colunas Data Pagamento e Recebido R$,
  linha Total. Editar abre o detalhe com Salvar/Baixar ocultos e datas travadas (`isNumerarioPago`).
- **Cheque IRB**: checkbox em todas as linhas (inclusive as que já têm numerário), sem Versão/Data
  Cobrança/Forma/Pagamento Comissão, com Data Transação, Moeda e I.S.; botão Emitir IRB. O filtro
  de quais processos entram (presumivelmente exportações pagas sem IRB) é feito **no servidor** a
  partir do flag `isNumerarioChequeIRB`.

---

## 3. IRB / resseguro e RME

No bundle, **IRB emitido = RME**: a chave `id.cdIrb` é exibida como "RME" / "RME Nº". Um IRB agrupa
vários processos; cada processo guarda `txIrb`, `vlIrbDolar`, `vlIrbReal` etc.

Há **duas formas de emitir**: (a) tela Emissão IRB (seleção manual, `/numerario/emitirIrb`) e
(b) Planilha Produção, botão "Emitir IRB" com confirmação "Deseja emitir IRB para todas as transações
da seleção?" (`/relatorio/emitirIrbTransacoesProducao`, usa o **filtro**, não uma seleção). A Planilha
Produção também tem "atualizar Taxa IRB" em lote (`/relatorio/atualizarTxIrb`), com confirmação
"Deseja atualizar as Taxas IRB de todos os registros abaixo para X,XXXX?" e erro "É necessário inserir
um valor de taxa antes de usar esta função!".

### 3.1 `irb-emitida-selecao` — "IRB's Emitidos"

21 por página (`pagination`). Pesquisa automática ao abrir. **Filtro default: data do IRB nos últimos
15 dias** (`dtInicialFiltroIrb = hoje − 15`, `dtFinalFiltroIrb = hoje`).

| Bloco | Rótulo | Campo |
|---|---|---|
| Filtro IRB | Tipo: | `tpIrb` (Todos / Importação / Exportação) |
| | Data Inicial (IRB): / Data Final (IRB): | `dtInicialFiltroIrb` / `dtFinalFiltroIrb` (final travada sem inicial) |
| | RME: | `id.cdIrb` |
| Processos | Período inicial: / Período final | `dtInicialFiltro` / `dtFinalFiltro` |
| | Processo inicial:/final:, Averbação inicial:/final: | como no numerário |
| | Código do cliente:/Descrição:, Código do parceiro:/Descrição: | lupas de cadastro |

| # | Coluna | Valor | Formato |
|---|---|---|---|
| 1 | (ações) | **Editar** → `irb-emitida`; **Visualizar Planilha IRB** → `planilha-irb` (duplo clique na linha = Editar) | |
| 2 | RME | `id.cdIrb` | |
| 3 | Data | `dtIrb` | dd/MM/yyyy |
| 4 | Data Cheque | `dtPagamento` | dd/MM/yyyy |
| 5 | Taxa IRB | `txIrb` (nulo → "0,00") | **1.2-2** (a taxa é digitada com 5 casas — truncamento só visual) |
| 6 | Valor | `vlTotalIrb` | 1.2-2 |
| 7 | Tipo | `tpIrb` | Importação/Exportação |
| 8 | Status | sem `dtPagamento` → **"Enviado ao financeiro"**; com → **"Enviado à seguradora"** | |

Ao abrir Editar ou Planilha: `/numerario/obterTransacoesIrbs` com `{cdIrb}`; o **último registro**
da lista vira `transacaoSelecionada`, que carrega os totais (`totalVl*`) calculados no servidor.

### 3.2 `irb-emitida` — "Alterar IRB"

| Rótulo | Campo | Regra |
|---|---|---|
| Data: | `dtIrb` | desabilitado |
| Data cheque: | `dtPagamento` | editável **só se ainda vazio** (`isDtPagamentoVazia`) |
| Taxa US$: | `txIrb` | 5 decimais |
| Crédito: | `vlCredito` | 2 decimais |
| Número cheque: | `nuCheque` | máx. 10 caracteres |
| Apólice: | `nuApolice` | select de `/cadastro/obterListaApolice` |
| Situação | status (como acima) | desabilitado |

Grade: Processo · Data (`dtTransacao`) · Averbação · Cliente (`deNomeFantasia`) · Valor R$
(`vlFinalPremioClienteReais`, 1.2-2). Botões: Voltar; **Salvar** (`/numerario/salvarIrb`, só se
`dtPagamento` estava vazio) → "Irb salva com sucesso!" e trava o formulário. Depois de informada a
data do cheque, o IRB vira somente leitura no front.

### 3.3 `planilha-irb` — "Planilha IRB" (impressão)

Título: "Processos - RME Nº {cdIrb}". Tabela `#planilhaIrb` com os processos do RME:

| Coluna | Valor | Formato | Tipo |
|---|---|---|---|
| Parceiro | `deParceiroFantasia` | | ambos |
| Definitiva | `id.nuAverbacao` | | ambos |
| Cliente | `deClienteFantasia` | | ambos |
| Tx IRB | `txIrb` | 1.4-4 | ambos |
| Tx Rec. | `txDolarNumerario` (câmbio do numerário) | 1.4-4 | ambos |
| Prêmio.Cli US$ | `vlPremioOverDolar` | 1.2-2 | Imp |
| Prêmio.Cli R$ | `vlPremioOverReal` | 1.2-2 | Imp |
| Cheque IRB US$ | `vlIrbDolar` | 1.2-2 | Exp |
| Prêmio Seg US$ (Imp) / Prêmio US$ (Exp) | `vlPremioSeguradora` | 1.2-2 | ambos |
| Prêmio + IRB US$ | `vlPremioIrbDolar` | 1.2-2 | Exp |
| Prêmio + IRB R$ | `vlPremioIrbReal` | 1.2-2 | Exp |
| A pagar US$ | `vlDolarAPagar` | 1.2-2 | ambos |
| A pagar R$ | `vlRealAPagar` | 1.2-2 | ambos |
| Dif US$ | `vlDiferencaDolar` | 1.2-2 | ambos |
| Dif R$ | `vlDiferencaReal` | 1.2-2 | ambos |
| C.Cor US$ | `vlComissaoFidcargoDolar` (comissão de corretagem) | 1.2-2 | ambos |
| I.S. US$ | `vlFinalImpostoSeguradoraDolar` (nome do campo sugere imposto, não I.S.) | 1.2-2 | ambos |

Rodapé "**Totais:**" (colspan 5) com `transacaoSelecionada.totalVlPremioOverDolar`,
`totalVlPremioOverReal`, `totalVlIrbDolar`, `totalVlPremioSeguradora`, `totalVlPremioIrbDolar`,
`totalVlPremioIrbReal`, `totalVlDolarAPagar`, `totalVlRealAPagar`, `totalVlDiferencaDolar`,
`totalVlDiferencaReal`, `totalVlComissaoFidcargoDolar`, `totalVlFinalImpostoSeguradoraDolar`
(mesmas condições de tipo) — **totais do servidor**.

Quadro lateral **"Apólices"** (`/numerario/obterListaApoliceTransacao`) e **"Apólices - Prorrogação"**
(`/numerario/obterListaApoliceTransacaoProrrogacao`): uma linha por apólice com `cdApolice` ·
`totalVlAPagarApolice` · `totalVlApolice` · botão **Imprimir RME** (abre `emissao-rme` para aquela
apólice, levando `cdIrb`, `dtIrb` e `cdTipo = tpIrb`). Ou seja: **um RME impresso por apólice**.

Botões: Voltar; **Imprimir** (HTML com tabela bordada, margem 0,5 cm, nova aba).

### 3.4 `emissao-rme` — "Recibo de Pagamento em Moeda Estrangeira"

Dados: `/numerario/obterListaTransacaoRme` com a apólice selecionada. Imprimir abre o HTML
(`emissaoRme`) com quebra de página entre vias. **6 vias**, mesmo corpo, rodapés diferentes:

| Via | Rodapé | Texto próprio |
|---|---|---|
| 1ª | Aviso ao Segurado | cobrança "por meio de cheque em moeda estrangeira, emitido a favor do Irb Brasil Resseguros S/A … conforme comunicado GECAM nº"; cláusula de cancelamento por falta de pagamento |
| 2ª | Recibo do Segurado | "Recebemos do Segurado a quantia em reais registrada mecanicamente…"; "O presente recibo só é valido mediante autenticação mecânica"; "BANCO" |
| 3ª | Banco Vendedor - Ficha de Lançamento por Caixa | "a caixa receberá a quantia de … sendo R$ … valor do contrato de câmbio R$ … corretagens e emolumentos" (valores **em branco**) |
| 4ª | Aviso a Seguradora | "recebemos do Segurado o valor … O correspondente cheque de nossa emissão vai aqui incluso" |
| 5ª | Aviso ao IRB | — |
| 6ª | Carta Remessa ao Banco do Brasil S/A. | "cujo valor se servirão creditar ao Irb Brasil Resseguros S/A Conta"; "IRB BRASIL RESSEGUROS S/A" |

Corpo comum de cada via:

| Campo | Valor | Origem |
|---|---|---|
| Logo | JPEG embutido em base64 | fixo |
| RME Nº | `transacaoSelecionada.cdIrb` | IRB |
| Seguradora | "BRADESCO AUTO RE CIA DE SEGUROS" | **fixo no código** |
| Segurado | "PINHO S.A - A/F DE TERCEIROS" | **fixo** |
| Endereço | "Rua Mal. Deodoro, 503 - 16 Andar - Curitiba - PR" | **fixo** |
| Apólice e/ou Certificado de Seguro nº | `cdApolice` | apólice |
| Data de Emissão | `dtIrb` | dd/MM/yyyy |
| Ramo | Importação/Exportação | `cdTipo` |
| Objeto do Seguro | lista "D-{nuAverbacao}" de cada processo | `listaTransacaoRme` |
| Importância Segurada em Moeda Estrangeira - USD | `totalVlApolice` | 1.2-2 |
| Valor do Prêmio a pagar em moeda estrangeira USD | `totalVlAPagarApolice` | 1.2-2 |
| Taxa de Câmbio · Prazo para Pagamento · Cheque nº - IRB · Data de Emissão · Banco Emitente · Banco Sacado e Praça | **somente rótulos, sem valor** (preenchidos à mão) | — |

---

## 4. Intermediação de negócios (comissões)

### 4.1 `pagamento-comissao-selecao` — "Pagamento de Intermediação de Negocios"

35 por página, pesquisa automática (100 ms). Lupas usam `/cadastro/obterTodosClientesPesquisaFiltro`
e `/cadastro/obterTodosParceirosPesquisaFiltro` (variantes "Filtro").

Filtros: Data inicial:/final:, Processo inicial:/final:, Averbação inicial:/final:, Código do
cliente:/Descrição:, Código do parceiro:/Descrição:; botões 🔍 **Pesquisar** e **Limpar Filtro**
(`filtroTransacao = new Transacao()` e pesquisa).

| # | Coluna | Valor | Formato |
|---|---|---|---|
| 1 | ☐ | `flCheckBoxSelecionada` (input nativo) | |
| 2 | Processo ↕ | `id.cdTransacao` | |
| 3 | Definitiva | `id.nuAverbacao` | |
| 4 | Cliente | `deCliente` | |
| 5 | Parceiro | `deParceiro` | |
| 6 | Prêmio US$ | `vlPremioOverDolar` | 1.2-2 |
| 7 | Comissão US$ | `vlComissaoParceiroDolar` | 1.2-2 |
| 8 | Comissão R$ | `vlComissaoParceiroReal` | 1.2-2 |

Sem rodapé de totais (o front lê `vlTotalFinalPremioClienteReais` do último registro, mas não exibe).

Seleção **persiste entre páginas** em `listaTransacaoSelecionada` (ao recarregar, remarca linhas
cujo `cdTransacao + nuAverbacao` estejam na lista). Bug: `gravaListaSelecionados` faz `push` em
**qualquer** mudança do checkbox — desmarcar também adiciona (a linha vai duplicada no envio).

| Botão | Condição | Endpoint | Efeito |
|---|---|---|---|
| **Limpar Seleção** | `listaTransacaoSelecionada.length > 0` | — | zera a seleção e pesquisa |
| **+ Solicitar Nota Fiscal** | sempre | `/numerario/solicitarNotaFiscal` com `registros = listaTransacaoSelecionada` | toast "Nota fiscal emitida com sucesso!" (o que é criado é uma **solicitação de comissão**, não uma NF-e) |

Duplo clique na linha chama `visualizaNumerario`, que está **vazio** (sem efeito).

### 4.2 `comissao-emitida-selecao` — "Intermediação de Negocios Emitidas"

21 por página. **Filtro default: últimos 5 anos** (aplicado se `dtInicialFiltro` vazio; final =
hoje 23:59:59).

Filtros: Período inicial/final, Processo, Averbação, Cliente, Parceiro, **Tipo:** com opções
Todos/Importação/Exportação ligadas a `tpComissao` — mas `tpComissao` significa **Parceiro (0) /
Funcionário (1)** na grade (rótulos trocados, bug).

| # | Coluna | Valor | Formato |
|---|---|---|---|
| 1 | Editar | abre `comissao-emitida` (também duplo clique) | |
| 2 | Tipo | `tpComissao==0 ? "Parceiro" : "Funcionário"` | |
| 3 | Favorecido | `deParceiroFantasia` (Parceiro) ou `deFuncionario` | |
| 4 | Data Cobrança | `dtComissao` | dd/MM/yyyy |
| 5 | Data Pagamento | `dtPagamento` | dd/MM/yyyy |
| 6 | Prêmio US$ | **`vlComissaoParceiroDolar`** (rótulo errado: é a comissão) | 1.2-2 |
| 7 | Recebido R$ | **`vlComissaoParceiroReal`** (idem) | 1.2-2 |
| 8 | Status | ver seção 7 | |

### 4.3 `comissao-emitida` — detalhe

| Rótulo | Campo | Regra |
|---|---|---|
| Favorecido | `deParceiroFantasia` (tp 0) ou `deFuncionario` | desabilitado |
| Data Comissão | `dtComissao` | desabilitado |
| Comissão R$ | `vlComissaoParceiroReal` | desabilitado |
| Comissão US$ | `vlComissaoParceiroDolar` | desabilitado |
| Data de pagamento | `dtPagamento` | editável só se vazio |
| Situação | status | desabilitado |

Grade (40 por página, `/numerario/obterTransacoesComissoes` com `{cdComissao}`): Processo · Data
(`dtTransacao`) · Averbação · Cliente · Valor R$ (`vlFinalPremioClienteReais`) · Valor US$
(`vlFinalPremioClienteDolar`) — valores do **prêmio** dos processos que compõem a comissão.

| Botão | Condição | Endpoint | Efeito |
|---|---|---|---|
| Voltar | sempre | — | |
| 🖨 **Imprimir** | sempre | `/numerario/imprimirSolicitacaoNF` | servidor devolve `{arquivo (base64), extensao, deAnexo}` e o front abre/baixa |
| 📖 **Salvar** | `dtPagamento` estava vazio | `/numerario/salvarComissao` | "Comissão salva com sucesso!"; trava o formulário |

O **layout da "Solicitação de NF" é gerado no servidor** (formato desconhecido — PDF/RTF/DOC);
nada dele está no bundle.

---

## 5. Notas fiscais (fechamento do período)

Apesar do nome, **não há emissão de NF-e no cliente**: "Emissão NF" é um **fechamento de resultado
por período**, guardado e reaberto por `cdNf`.

### 5.1 `nota-fiscal` — "Notas Fiscais" (`#/Nf`)

Sem fechamento carregado: filtros **Data Inicial** / **Data Final** (`paginas.dtInicial/dtFinal`) e
botão **Gerar** → `/NotaFiscal/obterTodasNf` (`deParametro = ""`, sem registros). Reaberto pela NfEmitida:
`deParametro = emissaoNF.id.cdNf`. Resposta `registros[0]` = `{emissaoNF, listaTransacaoImportacao,
listaTransacaoImportacaoProgramada (não exibida), listaTransacaoExportacao,
listaTransacaoImportacaoPinhoProgramada, listaTransacaoExportacaoPinho}`.

Relatório exibido (sem botão de imprimir):

1. "Período {DataIni} à {DataFim}" e quadro-resumo (R$, 1.2-2): **Recebido** `TotRecebido` ·
   **IRB** `TotIRB` · **Com.Parc.** `TotComissaoParc` · **Rs. Operacional** `TotProcessosResOp` ·
   **Vetor** `TotVetor` · **Resultado** `Resultado`.
2. Tabela **Importação** e tabela **Exportação** — colunas:

| Coluna | Campo | Formato |
|---|---|---|
| Processo | `id.cdTransacao` + " - " + `nuEmbalagemNumero` | |
| Parceiro | `deNomeFantasiaParceiro` | |
| Definitiva | `id.nuAverbacao` | Imp: **1.2-2** (bug: sai "106.493,00"); Exp: texto |
| Referência | `nuReferencia` | |
| Cliente | `deClienteFantasia` | |
| Recebido | `vlPremioLiqOverSComiReal` | 1.2-2 |
| Prêmio Seg. | `vlFinalPremioSeguradoraReais` | 1.2-2 |
| IRB | `vlPgSegReal` (rótulo IRB, campo "pago seguradora R$") | 1.2-2 |
| Com.Parc | `vlComissaoParceiroReal` | 1.2-2 |
| Rs.Operac | `vlResultadoOperacional` | 1.2-2 |
| Vetor | `vlComissaoVetor` | 1.2-2 |
| Resultado | `vlResultado` | 1.2-2 |

3. Quadro-resumo **"Importação"** (Pinho): `TotRecebidoPinho`, `TotIRBPinho`, `TotComissaoParcPinho`
   (1.2-2) e `TotProcessosResOpPinho`, `TotVetorPinho`, `ResultadoPinho` (**sem formatação**).
4. Tabelas **Importação Pinho** e **Exportação Pinho** — mesmas colunas, campos `*Pinho`:
   `cdTransacaoPinho - nuEmbalagemNumeroPinho`, `deNomeFantasiaParceiroPinho`, `qtDefinitivaPinho`
   (1.2-2), `nuReferenciaPinho`, `deClienteFantasiaPinho`, `vlPremioOverRealPinho`,
   `vlFinalPremioSeguradoraReaisPinho`, `vlIrbPinho`, `vlComissaoParceiroRealPinho`,
   `vlResultadoOperacionalPinho` (só Importação), `vlComissaoVetorPinho` (só Importação),
   `vlResultadoPinho`. A Exportação Pinho tem 10 células para 12 cabeçalhos (sem Rs.Operac e Vetor).

### 5.2 `NfEmitida` — "Notas Fiscais Emitidas"

Filtros Data Inicial/Data Final + **Pesquisar** → `/NotaFiscal/listarNfEmitida` (não pesquisa ao abrir).
Colunas: botão **Visualizar** · **Emissão** (`dtEmissao`, sem formatação) · **"Perído"** (sic)
`dtInicial a dtFinal` (sem formatação). Visualizar abre o `nota-fiscal` com o `emissaoNF`.

---

## 6. Cálculos

### 6.1 Feitos no cliente

| Onde | Cálculo | Detalhe |
|---|---|---|
| numerario-selecao | nenhum | total da coluna Recebido R$ lido do último registro |
| numerario | nenhum | só envia o objeto e substitui pelo retorno |
| numerario-impressao | nenhum | concatena `cdTransacao-nuEmbalagemNumero` com pad de 2 dígitos |
| irb-emitida-selecao | data default `hoje − 15 dias` | |
| comissao-emitida-selecao | data default `hoje − 5 anos` | |
| relatorio-producao | `txIrb.toFixed(4)` só para a mensagem de confirmação | |
| todos | formatação: valores 2 casas, taxas 4 (impressão/planilha) ou 5 (entrada `txIrb`), `txDolar` entrada com 4 | `DecimalPipe` pt-BR |

**Não existe no cliente**: soma de totais, rateio Parceiro/Pinho/Vendedor, IR/IRRF, ISS, descontos,
agravo, conversão cambial, arredondamento explícito, valor por extenso. Os parâmetros de retenção
(`pcIrrfRetencao`, `vlFatMinimoRetencaoIrrf`, `pcIss`, `pcCsllRetencao`, `pcCofinsRetencao`,
`pcPisRetencao`, `vlFatAcumuladoRetencao`) aparecem **apenas** no cadastro de Empresa do ERP Infoline
(`EmpresaSelecao`, bloco "Retenções para faturamento por nota"), nunca nas telas financeiras de seguros.

### 6.2 Feitos no servidor — contrato observado

| Endpoint | Payload (`registros`) | Campos usados do retorno |
|---|---|---|
| `/numerario/obterTodasTransacoes` | `[filtroTransacao]` com flags `isNumerarioPago`, `isNumerarioChequeIRB`, `cdPosicao`, `cdTipo`, faixas | lista de transações + `vlTotalFinalPremioClienteReais` em cada linha |
| `/numerario/solicitarNumerario` | transações marcadas (cada uma com `cdComissaoTransacao`; a última com `isAgrupado`) | só `deMensagem` |
| `/numerario/calculaNumerario` | numerário inteiro (`txDolar`, `vlRecebido`, `cdComissao`, `cdFormaCobranca`, `cdCarta`, datas…) | `vlFinalPremioClienteDolar`, `vlIrbReal`, `vlDiferenca`, `vlTotalComissaoParceiroReal`, `vlPremioOverReal`, `vlSolicitado`, `deSolicitado`, `vlTotalDolar`, `vlTotalReal`, `vlTotalPremioLiquido`, `vlTotalPremioComissao`, `vlTotalProrrogada`, `vlTotalProrrogadaReal`, `vlPagamentoAnterior`, `vlPagamentoAnteriorReal`, `subTotal`, `subTotalReal`, `vlTotal`, `dtPrevista`, `flCartaCobranca`, `cdInstrucaoCobranca`, `flProrrogacao`, `deCliente`, `deParceiro` |
| `/averbacao/calculaTransacao` | uma transação do numerário | `vlFinalPremioClienteDolar/Reais`, `vlComissaoParceiroReal/Dolar`, `vlIrbReal`, `vlPremioOverReal`, `vlPremioLiqOverSComiReal`, `vlProrrogacaoCliente/Real` e dados descritivos |
| `/numerario/baixarNumerario` | numerário + `dif` (1/-1 na 2ª chamada) | numerário atualizado ou `deMensagem` (pergunta de diferença) |
| `/numerario/emitirIrb` | transações marcadas | só `deMensagem` |
| `/numerario/obterTransacoesIrbs` | `{cdIrb}` | linhas da planilha; última linha = totais `totalVl*` |
| `/numerario/obterListaApoliceTransacao*` | `transacaoSelecionada` (`cdIrb`) | por apólice: `cdApolice`, `totalVlAPagarApolice`, `totalVlApolice` |
| `/numerario/solicitarNotaFiscal` | transações selecionadas | só `deMensagem` |
| `/NotaFiscal/obterTodasNf` | `dtInicial`, `dtFinal` ou `deParametro=cdNf` | `emissaoNF` (totais) + 4 listas |

### 6.3 Fórmulas prováveis (hipóteses a validar)

Derivadas de rótulos, nomes de campos e dos casos já conferidos em
[`04-regras-calculo.md`](04-regras-calculo.md) e [`08-fluxos.md`](08-fluxos.md). Arredondar a 2 casas
por linha antes de somar (o legado exibe 2 casas; ponto exato do arredondamento desconhecido).

```
// Comissão do parceiro — CONFERIDA em 4 processos (30 %)
vlComissaoParceiroDolar = vlPremioOverDolar × vlComissaoParceiro / 100        // "Parceiro %", default 30
vlComissaoParceiroReal  = vlComissaoParceiroDolar × txDolarNumerario          // hipótese: câmbio do numerário
// Pinho % (vlComissao) e Vendedor % (vlComissaoFuncionario) existem na cotação,
// mas nenhuma tela financeira exibe o valor resultante; o pagamento a funcionário (tpComissao=1)
// está "em construção".

// Conversões
vlFinalPremioClienteReais = vlFinalPremioClienteDolar × txDolar(numerário)
vlIrbReal                 = vlIrbDolar × txIrb (ou txDolar)                   // a validar
vlRealAPagar              = vlDolarAPagar × txIrb                              // planilha mostra "Tx IRB" ao lado
vlPremioOverReal (planilha Imp) = vlPremioOverDolar × txDolarNumerario         // "Tx Rec."

// Numerário — por linha (impressão)
Imp·Direta:  PrêmioTotal_R$ = vlPremioOverReal         ≈ Prêmio_R$ − Com_R$ ?
Exp·Direta:  PrêmioTotal_R$ = vlPremioOverReal         ≈ Prêmio_R$ − Com_R$ + ChequeIRB_R$ ?
Exp·NF:      PrêmioTotal_R$ = vlPremioLiqOverSComiReal ≈ Prêmio_R$ + ChequeIRB_R$ ?
// Direta = o parceiro retém a comissão e deposita o líquido ("Valor a depositar" = vlTotalPremioLiquido);
// NF     = cobra-se o prêmio cheio e a comissão é paga depois contra NF do parceiro (seção 4).

// Numerário — totais e versões
vlTotalDolar = Σ Prêmio_US$ ; vlTotalReal = Σ Prêmio_R$
vlSolicitado = (Direta ? vlTotalPremioLiquido : vlTotalReal/vlTotalPremioComissao) − vlPagamentoAnteriorReal ?
subTotal     = vlTotalDolar − vlPagamentoAnterior        // linha "A Pagar" da versão 2+
vlDiferenca  = (vlRecebido / txDolar) − vlFinalPremioClienteDolar ?             // "Valor Diferença US$"

// IRB / seguradora
vlPremioIrbDolar  = vlPremioSeguradora + vlIrbDolar      // "Prêmio + IRB US$"
vlDolarAPagar     = vlPremioSeguradora × (1 − agravo%) ? // desconto da seguradora: imp 0,25 %, exp 0,30 %
                                                          // (ver 11-dicionario-dados, vlDolarAPagarAgravo20)
vlDiferencaDolar  = vlPremioOverDolar − vlDolarAPagar ?  // margem em US$
vlDiferencaReal   = vlPremioOverReal − vlRealAPagar ?    // inclui ganho/perda cambial (Tx Rec. × Tx IRB)
vlComissaoFidcargoDolar = corretagem sobre o prêmio da seguradora (percentual desconhecido)

// Fechamento (Emissão NF)
Rs.Operac = Recebido − Prêmio Seg.(ou IRB/pago seguradora) − Com.Parc ?
Resultado = Rs.Operac − Vetor ?
```

---

## 7. Estados e transições

### 7.1 Posição da definitiva (`cdPosicao` com `cdStatus = 2`)

Enum completo (componentes `processo-selecao` e `editar-posicao-infoline`):

| cd | Posição | Gatilho provável |
|---|---|---|
| 0 | Follow-up | definitiva emitida |
| 1 | Falta enviar Numerário | definitiva pronta para cobrança (filtro "Numarários à emitir") |
| 2 | Numerário enviado | após `solicitarNumerario` (filtro "Numarários atrasados" usa o código 2) |
| 3 | Valorizado | baixa com recebimento a maior? |
| 4 | Desvalorizado | baixa com recebimento a menor? |
| 5 | Atrasado | vencido `dtPrevista`? |
| 6 | Recebido (na lista de filtro aparece "Recibo") | após `baixarNumerario` |
| 7 | Numerário pago | |
| 8 | Prorrogado | prorrogação |
| 9 | IRB Emitido | após `emitirIrb` (linha verde `#9cf3d1` na lista de processos) |
| 10 | Acerto | acerto de diferença |
| 11 | Cancelada | |

A posição também pode ser alterada **manualmente** pelo usuário `Infoline`
(`/averbacao/salvarPosicaoTransacao`).

### 7.2 Numerário

| Estado (derivado) | Como se reconhece | Ações |
|---|---|---|
| A emitir | transação sem `idNumerario` | checkbox + escolha Direta/NF por linha → Solicitar |
| Emitido / pendente | `idNumerario` preenchido, `dtPagamento` vazio — Situação "Pendente" | Editar, Calcular, Salvar, Baixar, Ver Numerário |
| Nova versão | `cdVersao > 1`, `vlPagamentoAnterior ≠ 0`, `flCartaCobranca` | carta com "SUBSTITUI A ANTERIOR" e linhas Pagamento Anterior/A Pagar |
| Pago | `dtPagamento` preenchido — aparece em Numerários Pagos | só visualizar; estorno via Editar Infoline |

### 7.3 IRB / RME

| Status exibido | Condição | Transição |
|---|---|---|
| Enviado ao financeiro | `dtPagamento` (data do cheque) vazio | criado por `emitirIrb` / `emitirIrbTransacoesProducao` |
| Enviado à seguradora | `dtPagamento` preenchido | Salvar em Alterar IRB com Data cheque; depois fica somente leitura |

### 7.4 Comissão (intermediação)

| Status exibido | Condição |
|---|---|
| Solicitada NF | `dtPagamento` vazio e `tpComissao == 0` (Parceiro) |
| Solicitado Pagamento | `dtPagamento` vazio e `tpComissao == 1` (Funcionário) |
| Pagamento Efetuado | `dtPagamento` preenchido (Salvar em `comissao-emitida`) |

Entrada no fluxo: transação com `cdComissao = 1` (Nota Fiscal) listada em Pagamento de Intermediação
→ `solicitarNotaFiscal` cria o registro de comissão.

### 7.5 Fechamento NF

Sem status: gerado (`obterTodasNf` sem `cdNf`) → listado em NfEmitida → reaberto por `cdNf`.

---

## 8. Problemas do legado a não repetir

- Totais lidos do último registro da página em vez de um campo de resumo da resposta.
- Ordem das linhas da carta depende da ordem de chegada de N requisições paralelas.
- Rótulos trocados: "Prêmio US$"/"Recebido R$" mostram comissão; filtro "Tipo" Imp/Exp ligado a
  Parceiro/Funcionário; "IRB" mostra `vlPgSegReal`; "I.S. US$" mostra imposto da seguradora;
  "Data de Saida"/"Data de Chegada" invertidos; Situação "Status".
- Formatação inconsistente (valores crus em "Recebido R$", `vlSolicitado`, totais Pinho; número de
  averbação com casas decimais; Taxa IRB com 2 casas).
- Coluna extra na tabela de prorrogação da carta; Com.R$ mostrando dólar.
- Checkbox que adiciona ao desmarcar (comissões).
- Dados da empresa, banco, PIX, seguradora (Bradesco Auto/RE) e segurado (Pinho S.A.) **fixos no código**.
- Estorno de baixa restrito a um login específico, sem trilha de auditoria.
- `Gerar` de "Emissão NF" provavelmente grava um registro sem confirmação.

---

## 9. Pontos a validar com dado real

1. **Fórmulas do numerário** (6.3): pegar um numerário Imp·Direta, um Imp·NF, um Exp·Direta e um
   Exp·NF já pagos e conferir `vlPremioOverReal`, `vlPremioLiqOverSComiReal`, `vlTotalPremioLiquido`,
   `vlTotalPremioComissao` e `vlSolicitado` contra Prêmio R$, Com.R$ e Cheque IRB R$.
2. **Câmbio** usado em cada coluna R$: `txDolar` do numerário, `txDolarNumerario` da transação ou
   `txIrb`? Conferir `vlRealAPagar / vlDolarAPagar` e `vlPremioOverReal / vlPremioOverDolar` na Planilha IRB.
3. **Comissão em R$**: `vlComissaoParceiroReal = vlComissaoParceiroDolar × qual taxa?`
4. **"A pagar US$" e agravo**: confirmar se `vlDolarAPagar = vlPremioSeguradora × (1 − 0,25 %/0,30 %)`
   ou outra regra; e o percentual de `vlComissaoFidcargoDolar` (C.Cor). O que é "Fidcargo"?
5. **I.S. US$ da planilha IRB** = `vlFinalImpostoSeguradoraDolar`: é mesmo importância segurada ou imposto?
6. **Agrupado**: com o flag, sai **um** numerário para todos os processos selecionados (mesmo cliente?
   clientes diferentes?) ou o servidor agrupa por cliente/parceiro?
7. **Baixa com diferença**: qual mensagem o servidor devolve, o que `dif = 1` e `dif = -1` fazem
   (nova versão? posição Valorizado/Desvalorizado/Acerto?) e qual a tolerância.
8. **`vlDiferenca`**: fórmula (recebido convertido − prêmio?) e em que moeda.
9. **Situação "Numarários atrasados"** envia `cdPosicao = 2` (que é "Numerário enviado"): o servidor
   reinterpreta como "enviado e vencido" ou o filtro está errado?
10. **`dtPrevista`** (validade "ATÉ … ÀS 16:00 H"): regra de cálculo (D+N úteis? fim do mês?).
11. **`deSolicitado`**: é o valor por extenso? Gerado no servidor?
12. **`cdCarta` 1/2/3 e `flCartaCobranca`**: significado (1ª/2ª/3ª cobrança?) e quando o servidor marca.
13. **Quais transações entram em "Solicitação de Cheque IRB"** (só exportação? só pagas? sem IRB?) e
    em "Pagamento de Intermediação" (só `cdComissao = 1`? só numerário pago?).
14. **`solicitarNotaFiscal`** cria uma comissão por parceiro ou uma por seleção? Funciona com
    parceiros diferentes no mesmo envio?
15. **Layout da Solicitação de NF** (`/numerario/imprimirSolicitacaoNF`): obter um exemplar impresso
    (formato e campos) — não está no bundle.
16. **IRB**: `vlIrbDolar` vem de "Valor IRB" da cotação ou é calculado (taxa × I.S.)? Relação entre
    `txIrb` digitado em Alterar IRB e os valores R$ já gravados (recalcula?). `vlCredito` é usado onde?
17. **RME**: seguradora fixa "BRADESCO AUTO RE" — ainda é a única seguradora com RME? O processo de
    cheque em moeda estrangeira ao IRB ainda existe (comunicado GECAM)?
18. **"Vetor"** (`vlComissaoVetor`) e o bloco **"Pinho"** do fechamento NF: quem é Vetor, o que
    diferencia uma transação "Pinho" (programada?) das demais, e as fórmulas de Rs.Operac/Resultado.
19. **`Gerar` em Emissão NF** grava um registro (cdNf) a cada clique? Pode haver fechamentos sobrepostos?
20. **IR/IRRF/ISS**: confirmar que não há retenção calculada no financeiro de seguros (os parâmetros
    só existem no cadastro de Empresa do ERP) ou se o servidor aplica ao gerar a solicitação de NF.
21. **Pinho % e Vendedor %**: onde esses valores são pagos/usados hoje (nenhuma tela financeira os mostra).
22. Dados bancários e CNPJ fixos na carta (Bradesco ag. 1205-0, c/c 30234-1) continuam válidos?
