# Documentos do processo no legado — proposta, recibo, certificado, cobertura

Engenharia reversa **estática** do bundle Angular do Coomex Hub (`main-S4VFPNOX.js`) e dos quatro
modelos `.docx` já baixados em `backend/prisma/data/proposal-templates/`. Nenhuma chamada ao
servidor legado foi feita para este documento.

Componentes analisados: `processo-selecao` (listagem que dispara tudo), `seguro`, `recibo`,
`certificado`, `cobertura`, `app-modelos-propostas`, `app-modelos-propostas-selecao` e o serviço de
impressão (`Ct`, injetado como `printService`/`printerService`).

---

## 1. Visão geral — quem gera o quê

O legado tem **dois mecanismos completamente diferentes** de gerar documento:

| Documento | Onde é montado | Formato final | Endpoint |
|---|---|---|---|
| **Proposta** (PDF / DOCX) | **Servidor** — merge do modelo `.docx` cadastrado (Tipo × Cobertura) com a transação | PDF (abre em aba) ou DOCX (download) | `POST /relatorio/imprimePropostaPDF`, `POST /relatorio/imprimePropostaDocX` |
| Proposta HTML | Servidor | HTML | `POST /relatorio/imprimePropostaHTML` — **método existe, mas nenhum botão o chama** |
| **Recibo** | **Cliente** — template Angular fixo | HTML em nova aba (usuário imprime pelo navegador) | nenhum além de `obterTransacaoAtualizada` |
| **Certificado** (importação definitiva) | **Cliente** — template Angular fixo | HTML em nova aba | idem |
| **Emitir Cobertura** (exportação definitiva) | **Cliente** — template Angular fixo | HTML em nova aba | idem |
| "Processo de Seguro" (`seguro`) | Cliente — proposta de exportação **fixa, da antiga Fidcargo** | HTML | idem — **botão oculto (`*ngIf="false"`)**, código morto |

Os documentos montados no cliente **não fazem nenhuma conta**: todos os valores (prêmios em US$ e R$,
valor por extenso, textos de prêmio/taxa da cobertura) chegam **prontos do servidor** dentro do
objeto da transação. O cliente só aplica *pipes* de formatação (número, data, maiúsculas).

### Fluxo comum (listagem de processos → documento)

Todos os botões de documento da listagem (`processo-selecao`) seguem o mesmo padrão:

```
clique no botão da linha
  → POST /averbacao/obterTransacaoAtualizada   { ...envelope, registros: [linhaDaListagem] }
  ← { registros: [transacaoCompleta], deMensagem }
  → (proposta)  POST /relatorio/imprimeProposta{PDF|DocX}  { ...envelope, registros: [transacaoCompleta] }
  → (demais)    renderiza o componente <recibo|certificado|cobertura> com @Input transacaoSelecionado
```

Ponto importante para a proposta: o servidor recebe **o objeto da transação inteiro no corpo** (o que
acabou de devolver), não apenas o código. O merge provavelmente usa esses valores.

### Visibilidade dos botões na listagem (coluna "Ações")

| Botão (tooltip) | Ícone | Condição de exibição (`*ngIf`) | Método |
|---|---|---|---|
| Editar Posição | lápis | `paginas.cdUsuario == "Infoline"` (só o usuário do fornecedor) | `editarPosicao` |
| Imprimir proposta em PDF | `oi-print` | `linha.flVerProposta` | `imprimePropostaPDF` |
| Baixar proposta em DocX | `oi-print` | `linha.flVerProposta` | `imprimePropostaDocX` |
| Imprimir proposta | `oi-file` | **`false`** (nunca aparece) | `visualizaSeguro` |
| Imprimir recibo | `oi-file` | `linha.isRecibo` | `visualizaRecibo` |
| Imprimir certificado | `oi-box` | `linha.isRecibo && cdStatus == 2 (Definitiva) && cdTipo == 0 (Importação)` | `visualizaCertificado` |
| Emitir Cobertura | `oi-box` | `cdStatus == 2 (Definitiva) && cdTipo == 1 (Exportação)` | `visualizaCobertura` |

`flVerProposta` e `isRecibo` são **calculados no servidor** (não há lógica no cliente). Pelo
comportamento esperado: `flVerProposta` ≈ "existe modelo para Tipo × Cobertura e o processo está em
cotação"; `isRecibo` ≈ "numerário já pago" (o recibo usa `dtPagamentoNumerario`). Ambos a validar.

> Conclusão de produto: **o certificado só existe para importação** e **a "cobertura" só existe para
> exportação** — são o documento equivalente de cada tipo após a definitiva. A cobertura não depende
> do numerário estar pago; o certificado depende (`isRecibo`).

---

## 2. Serviço de impressão (`printService.print(base64, nome, extensao)`)

Implementação única (classe `Ct`) usada por todos os documentos:

```
print(b64, nome, ext):
  se ext == ""  → ext = "txt"
  se nome == "" → nome = "_blank"           // vira o *target* da janela, não um nome de arquivo
  senão se ext == "rtf" → ext = "msword"
  bytes = atob(b64) em blocos de 512
  mime  = "application/" + ext   (ou "text/html" se ext == "html")
  se ext ∈ {pdf, html} → window.open(URL.createObjectURL(Blob(bytes, mime)), nome)   // abre em aba
  se ext == "plain"    → idem com "text/plain"
  senão                → FileSaver.saveAs(Blob(bytes, mime), nome + "." + ext)       // download
```

Consequências:

- **PDF da proposta** abre numa aba (o `deAnexo` devolvido pelo servidor vira o nome da *janela*).
- **DOCX da proposta** é baixado como `<deAnexo>.docx` com MIME incorreto `application/docx`
  (funciona porque o navegador só olha a extensão). Se o servidor não mandar `deAnexo`, o arquivo
  sai como `_blank.docx`.
- Não há `window.print()` automático: recibo/certificado/cobertura abrem o HTML em aba e o usuário
  imprime pelo navegador.
- `download(b64, nome, ext)` é a variante que sempre baixa — usada no "Download modelo" do cadastro.

### Resposta dos endpoints de proposta (`resultImprimir`)

```
resp.deMensagem preenchido → modal de erro
senão:
  d = resp.registros            // atenção: objeto, não array
  print(d.arquivo /*base64*/, d.deAnexo || "", d.extensao /*"pdf" | "docx"*/)
```

`imprimePropostaHTML` é diferente: espera `resp.registros[0]` como **string HTML crua**, faz
`btoa()` no cliente e abre como `html`. Como `btoa` não aceita caracteres fora do Latin-1 (ex.: "–",
aspas tipográficas presentes nos modelos), essa rota provavelmente quebraria — talvez por isso esteja
sem botão.

### Como os documentos montados no cliente viram HTML

Cada componente tem `imprimir()`:

```
html = "<html><head><style>…</style></head><body>" + #impressao.outerHTML + "</body></html>"
recibo/certificado/seguro:  print(btoa(html), "", "html")                       // Latin-1, sem charset
cobertura:                  print(btoa(unescape(encodeURIComponent(html))), "", "html")  // UTF-8 + <meta charset='UTF-8'>
```

`@page { margin: 0.5cm }` em todos. O logo vem de `assets/images/pinhologo.png` convertido em data
URL; se não carregar, aparece o texto "Pinho" em itálico azul `#120a8f` no lugar. (O código concatena
`"data:image/png;base64" + dataURL`, gerando um prefixo duplicado — funciona por tolerância do
navegador.)

---

## 3. Formatação usada (pipes Angular, `LOCALE_ID = "pt"`)

| Pipe no template | Saída | Uso |
|---|---|---|
| `number:'1.2-2'` | `1.234,56` (milhar com ponto, 2 casas, arredondamento *half-even* do Angular → na prática *half-up* para 2 casas) | todos os valores monetários |
| `number:'2.0-0'` | inteiro com no mínimo 2 dígitos: `1` → `01` | sufixo do nº do processo (`nuEmbalagemNumero`) |
| `date:'dd/MM/yyyy'` | `03/07/2026` | datas |
| `date:'yy'` | `26` | sufixo de ano das averbações (`D 106493 /26`) |
| `date:"dd 'de' MMMM 'de' yyyy"` | `16 de novembro de 2026` (nomes de mês em português do locale `pt`) | data do recibo |
| `uppercase` | maiúsculas | cliente, seguradora, mercadoria, valor por extenso |

**Valor por extenso**: não existe no cliente. Vem pronto do servidor nos campos
`vlPremioOverRealExtenso` e `vlPremioLiqOverSComiRealExtenso` (o cliente só aplica `uppercase`).
Só o recibo usa extenso.

**Moeda**: nenhum documento converte câmbio no cliente. Os pares US$/R$ (`vlPremioOverDolar` /
`vlPremioOverReal`, `vlProrrogacaoCliente` / `vlProrrogacaoClienteReal`) chegam calculados.

---

## 4. Recibo (`recibo`) — "Processo de Recibo"

Disponível quando `isRecibo`. Layout de uma página, três caixas com borda cinza (80 % da largura,
centralizadas):

| Seção | Conteúdo | Origem |
|---|---|---|
| Topo | Logo Pinho (ou texto "Pinho") | asset fixo |
| Caixa 1 — emitente | "COOMEX INTELIGENCIA LOGISTICA LTDA" / "CNPJ 67.020.194/0001-68" | **texto fixo** |
| Caixa 2 — corpo | "Recebemos de **{cliente}** a quantia de R$ {valor} ({VALOR POR EXTENSO})" | ver tabela abaixo |
| Caixa 3 — referência | "Ref: Pagamento de Seguro de Transporte Internacional" / "Fatura: {deGuia}" / "Processo: {cdTransacao}-{nuEmbalagemNumero:2.0-0}" | transação |
| Rodapé (à direita) | "Curitiba, {dtPagamentoNumerario por extenso}" / "Emitido por: COOMEX INTELIGENCIA LOGISTICA LTDA" | transação + fixo |

Regra do valor (única condição do documento):

| `cdComissaoNumerario` | Significado provável (select "Comissão" do numerário: 0 = Direta, 1 = Nota Fiscal) | Valor impresso | Extenso |
|---|---|---|---|
| `0` | comissão "Direta" | `vlPremioOverReal` | `vlPremioOverRealExtenso` |
| `1` | comissão por "Nota Fiscal" | `vlPremioLiqOverSComiReal` (prêmio líquido, sem comissão, em R$) | `vlPremioLiqOverSComiRealExtenso` |
| outro / nulo | — | **nada é impresso** (frase fica "a quantia de R$ " vazia) | — |

Observações:

- Cidade "Curitiba" é fixa; data é a do **pagamento do numerário**, não a da emissão.
- O recibo não distingue importação/exportação nem provisória/definitiva.
- `nuEmbalagemNumero` é usado em todas as listagens financeiras no formato `processo-NN`;
  pelo uso, é o **número da versão/sequência** do processo (campo reaproveitado), não embalagem.

---

## 5. Certificado (`certificado`) — "Processo de Certificado"

Só para **importação definitiva** com `isRecibo`. Layout em tabela de 750 px com bordas azuis
`#6281ca`, fontes Verdana/Times 8–9 pt (estilo de formulário de seguradora).

### Anverso (dados)

| Bloco | Rótulo | Valor | Origem / regra |
|---|---|---|---|
| Título | "Certificado" | — | fixo |
| Cabeçalho | logo + "NR PROCESSO" | `{cdTransacao} -{nuEmbalagemNumero:2.0-0}` | transação |
| Seguradora | — | "COMPANHIA {DESEGURADORA}" | `deSeguradora` em maiúsculas |
| Declaração | "Certificamos que **{CLIENTE}** contratou nessa sociedade, segundo os termos e condições da apólice nr. **{cdApolice}** e averbação definitiva nr. **D {nuAverbacao} /{yy}** de **{dd/MM/yyyy}** o seguro de transportes. DOS BENS ABAIXO IDENTIFICADOS COM OS SEGUINTES VALORES" | `deCliente` (maiúsc.), `cdApolice`, `id.nuAverbacao`, `dtTransacao` (ano e data) |
| Mercadorias | "Mercadorias" | `deMercadoria` | |
| I.S. | "Importância Segurada - {deMoeda}" | `impSegurada` (`1.2-2`) | **na moeda do processo**, pronta do servidor |
| Coberturas | lista | "FOB+Frete" (**sempre**, texto fixo) + "Despesas" se `flDespesas` + "Lucros Esperados" se `flLucroEsperados` + "Impostos ({deImposto})" se `flImposto` | flags da transação |
| Fatura | "Fatura" | `deGuia` | |
| Franquia | "Franquia" | `{cdMercadoriaFranquia:1.2-2}%` | percentual vindo do cadastro de mercadoria (nome do campo engana: é valor, não código) |
| Garantia | "Garantia" | `deCobertura` | ex.: Básica Ampla "A" |
| Local de Início | | `deOrigem` | |
| Destino | | `deDestino` | |
| Meio de Transporte | | `deModal` | |
| Provisória | | `{nuProvisoria} /{yy de dtTransacao}` | |
| Definitiva | | `{nuAverbacao} / {yy}` — ou `PRG- {nuAverbacao} / {yy}` se `flProrrogacao` | |
| Conhecimento | rótulo dinâmico | `{deConhecimentoEmbarque}` (ex.: "BL", "AWB") e abaixo `{nuConhecimentoEmbarque}` | |
| Prêmio Dólar EUA | | `vlPremioOverDolar` — ou `vlProrrogacaoCliente` se `flProrrogacao` | `1.2-2` |
| Prêmio em Real | | `vlPremioOverReal` — ou `vlProrrogacaoClienteReal` se `flProrrogacao` | `1.2-2` |
| Data | "Data" | `dtTransacao` — ou `dtProrrogacao` se `flProrrogacao` | `dd/MM/yyyy` |
| Referência | "Ref.: {nuReferencia}" | `nuReferencia` | ref. do cliente |
| Emissor | "Emitido por: COOMEX INTELIGENCIA LOGISTICA LTDA" | fixo | |
| Selo | "PRORROGAÇÃO DE SEGURO" (vermelho) | só se `flProrrogacao` | |

Observações:

- O ano da **provisória** e da **definitiva** sai do **mesmo** `dtTransacao` — se a provisória foi
  emitida num ano e a definitiva no outro, o sufixo da provisória fica errado.
- "FOB+Frete" é fixo mesmo quando o processo não tem frete.
- Prêmio em US$ e em R$ é o **prêmio "over"** (prêmio do cliente). A taxa de câmbio usada para o R$
  não aparece no documento.

### Verso (texto fixo, "SEGURO DE TRANSPORTES")

Texto **literal** do template `certificado` (extraído do bundle em 18/11/2026, sem correções — inclusive o "(CPC)" que deveria ser CDC, o "De acordo" com maiúscula no meio da frase e "Clausulas" sem acento). Em lista numerada de 7 itens no original. O sistema novo deve reproduzi-lo tal qual; correções de redação só com aval da seguradora/cliente.

> **SEGURO DE TRANSPORTES**
>
> O presente certificado de seguro representa a comprovação da efetuação da averbação de verbas seguráveis referentes ao seguro de transportes de bens pertencentes à empresa nominada neste documento junto à apólice numerada emitida em favor de terceiros pela Cia de Seguros ambas nominadas no anverso. Averbação dentro das normas específicas com base na proposta previamente enviada e cujo aceite se deu nos termos do artigo 653 e seguintes do Código de Proteção e Defesa do Consumidor (CPC)
>
> **1. Disposições da Apólice**
> As disposições desta apólice aplicam-se aos bens segurados em viagens aquaviárias, terrestres e aéreas, nos percursos nacionais e internacionais, conforme definido na apólice. Consideram-se bens segurados as mercadorias identificadas na averbação. O certificado expressa a garantia da apólice nos limites da importância segurada contratada, De acordo com as condições contratuais deste seguro, o pagamento da indenização dar-se-á ao Segurado indicado no certificado e na averbação, por prejuízos ocorridos e devidamente comprovados, decorrentes dos riscos cobertos. O interesse segurável sobre o objeto segurado estará caracterizado a partir da responsabilidade das partes envolvidas, conforme a negociação efetuada entre elas e representada por documento hábil.
>
> **2. Importância Segurada (IS)**
> É o valor informado pelo Segurado por ocasião da averbação provisória não implicando reconhecimento, por parte da Seguradora ou do Estipulante, da realidade deste valor, devendo este ser provado através de documentos hábeis por ocasião da averbação definitiva, podendo abranger também uma ou mais das seguintes verbas, desde que ratificadas por meio de cobertura adicional, e discriminadas por cláusulas e verbas próprias na apólice e averbação.
>
> **3. Riscos Cobertos**
> Para fins deste seguro, consideram-se riscos cobertos aqueles definidos nas Condições Especiais, para cada cobertura contratada, que fazem parte integrante e inseparável desta averbação.
>
> **4. Franquia**
> Pactuada entre o Segurado e a Seguradora, indicada na apólice, averbação e neste certificado.
>
> **5. Forma de Contratação - Apólice de Averbação**
> Destina-se a cobrir diversos embarques, sendo estes comunicados à Seguradora através de formulário ou meio eletrônico, denominado averbação. Nos casos de apólices por averbação, o não pagamento da fatura na data indicada poderá acarretar a proibição de novas averbações, porém os bens referentes aos prêmios já pagos continuarão com cobertura até o fim da vigência prevista na apólice.
>
> **6. Pagamento do Prêmio**
> Caso o prêmio venha a ser pago por risco decorrido, será o mesmo cobrado por via executiva, nos termos do Artigo 27 do Decreto-Lei n.º 73, de 21.11.66, sujeito a débito, além da atualização monetária, aos juros mensais previstos na legislação em vigor, calculados "pro rata die", até o efetivo pagamento, acrescido, ainda, do débito da multa penal, conforme legislação vigente, incidente sobre o total da dívida, sem prejuízo do ressarcimento das despesas que a Estipulante tiver de arcar para o recebimento de seu crédito. Por conta de eventual dívida, o Segurado desde já autoriza o Estipulante a emitir Letra de Câmbio, podendo, inclusive, designar-se Tomador, obrigando-se a aceitá-la e pagá-la, ainda que apresentada por terceiro dela endossatário.
>
> **7. Clausulas**
> Ratificam-se os dizeres das Condições, Coberturas e Cláusulas constantes nesta apólice.

---

## 6. Emitir Cobertura (`cobertura`) — "Processo de cobertura"

Só para **exportação definitiva**. É uma **solicitação de cobertura à seguradora**, não um documento
para o cliente. Caixa com borda arredondada, logo grande centralizado, tabela "rótulo – valor".

| Linha | Valor | Condição |
|---|---|---|
| Frase de abertura | "Solicitamos Cobertura imediata para o embarque de exportação - Apólice : {cdApolice}" | sempre |
| COBERTURA Nº | `E- {nuAverbacao}` | sempre |
| PROCESSO | `cdTransacao` (sem o sufixo de versão) | sempre |
| EMPRESA | `DECLIENTE` | sempre |
| MERCADORIA | `DEMERCADORIA` | sempre |
| INICIO | `DEORIGEM` | sempre |
| DESTINO | `DEDESTINO` | sempre |
| TRANSPORTE | `DEMODAL` | sempre |
| NAVIO | se `deNomeNavio == ""` → `DENAVIO` (do cadastro) + ` / {vlClassificacaoNavio} %` se ≠ 0; senão → `DENOMENAVIO` (digitado) + ` / {vlAdicionalNavio} %` se `vlClassificacaoNavio` ≠ 0 | só `cdModal == 2` (Marítimo) |
| GARANTIA | `DECOBERTURA` + " + GUERRA E GREVE" (se `flGuerraGreve` e modal ≠ Terrestre) / " + GREVE" (se `flGuerraGreve` e Terrestre) + " + PARALISAÇÃO DE MÁQUINAS FRIGORÍFICAS" (se `flMaquinaRefrigeracao`) | sempre |
| FATURA | `deGuia` | sempre |
| {deConhecimentoEmbarque} | `nuConhecimentoEmbarque` | modal ≠ Marítimo |
| PLACA | `deNomeNavio` (campo do navio reaproveitado para placa) | só Terrestre (3) |
| MOTORISTA | `DENOMEMOTORISTA` | só Terrestre (3) |
| DATA DE SAIDA | `dtSaida` `dd/MM/yyyy` | sempre |
| VALOR {deTipoValor} | `deCoberturaImpressao` | sempre — **string pronta do servidor** |
| PRÊMIO | `dePremio` | sempre — **string pronta do servidor** |
| TAXA | `deTaxa` | sempre — **string pronta do servidor** |

Observações:

- Os três valores financeiros chegam **já formatados como texto** (`de*`), então moeda, casas
  decimais e se a taxa é cliente ou seguradora são decisão do servidor — não dá para inferir do
  bundle. `deTipoValor` vem do combo `/averbacao/obterListaTipoValor` (ex.: "CIF", "FOB"…).
- Bug no ramo "navio digitado": a condição testa `vlClassificacaoNavio` mas imprime
  `vlAdicionalNavio`.
- No marítimo **não** sai o nº do conhecimento (BL); só no aéreo/terrestre/ferroviário.

---

## 7. Proposta — modelos `.docx` com merge no servidor

### 7.1 Cadastro de Modelos de Propostas (`#/ModelosPropostaSelecao/Menu`)

Chave do modelo: **`cdTipo` × `cdCobertura` × `dtVersao`** (classe `Pu { id: { cdTipo, cdCobertura, dtVersao } }`).

| Campo | Valores |
|---|---|
| `cdTipo` | `"0"` Importação · `"1"` Exportação |
| `cdCobertura` | `"1"` Básica Ampla "A" · `"2"` Básica Restrita "C" · `"3"` Básica Restrita "B" (nunca usado nos 63 registros reais) |
| `dtVersao` | data de vigência (gravada como `…00:00:01`); default = hoje |
| `deArquivo` | nome do arquivo sem extensão (vem do `file.name.split(".")[0]`) |
| `imDocx64` | conteúdo do `.docx` em base64 (só carregado sob demanda) |
| `flArquivoDisponivel` | indica que há binário |

Comportamento da tela:

| Ação | O que faz | Endpoint (serviço de cadastro — ver nota) |
|---|---|---|
| Listar | filtros Tipo, Cobertura, período (default: **último ano**); 21 por página | `/cadastro/obterTodosModelosPropostas` (confirmado em 09-api-legado) |
| Download modelo | baixa o `.docx` como `<deArquivo>.docx` | `/cadastro/obterArquivoModeloProposta` → `registros[0].imDocx64` |
| Excluir (lixeira) | **só aparece para versões com `dtVersao` futura** (`verificandoDatas`: `dtVersao > hoje 00:00`) — versões já vigentes não podem ser excluídas | `removerModelosProposta` |
| Upload / Trocar modelo | lê o arquivo no navegador (`readAsDataURL`), guarda o base64 em `imDocx64` | — (vai no salvar) |
| Salvar | envia o registro com o base64 | `salvarModelosPropostas` |
| **Palavras Chaves** | pede ao servidor e mostra a resposta (`deMensagem`) num modal de **sucesso** — é a lista de placeholders aceitos pelo merge | `palavrasChaves` |

> Nota: o serviço de cadastro (injetado como `he`) **não está presente no bundle capturado** —
> os nomes dos métodos aparecem só nas chamadas. As rotas exatas de `salvar`, `remover` e
> `palavrasChaves` não puderam ser confirmadas estaticamente (o padrão sugere `/cadastro/<método>`).

Versionamento: 63 linhas reais (`backend/prisma/data/legacy-modelos-propostas.json`), 27 de
IMP×A, 16 de IMP×C, 11 de EXP×A, 9 de EXP×C. Há variantes com nome "… 2024 Unico" (abr/2024) e
"ARIAL/times PROP …" — testes de fonte e possivelmente modelo para "provisória única", mas a chave
não distingue isso. **A regra de escolha da versão não está no cliente** — o servidor recebe a
transação e escolhe; o mais provável é "maior `dtVersao` ≤ data de referência", o que explica
proibir exclusão de versões já vigentes.

### 7.2 Merge

- Feito **no servidor** (Java) em `imprimePropostaPDF` / `imprimePropostaDocX`; o cliente não vê o
  modelo nesse fluxo.
- Sintaxe: **`[nomeDoCampo]`** em texto corrido do `.docx` (sem `MERGEFIELD`, sem campos do Word).
  Os placeholders estão inteiros dentro de um único `<w:t>` nos quatro modelos atuais, o que indica
  substituição por texto simples no XML. Os nomes são os **mesmos nomes dos atributos da transação**
  (`deCliente`, `cdApolice`…) mais um conjunto de chaves calculadas (`fobFr*`, `cnpj`).
- Saída PDF: provavelmente conversão DOCX → PDF no servidor (LibreOffice/docx4j); não há como
  confirmar pelo bundle.

### 7.3 Placeholders encontrados nos modelos 2026

| Placeholder | IMP | EXP | Significado provável | Origem |
|---|:-:|:-:|---|---|
| `[deCliente]` | ✔ (2×) | ✔ (2×) | razão social do cliente | transação |
| `[deContato]` | ✔ | ✔ | contato ("Á CARGO DE: Sr (a)") | transação |
| `[cdApolice]` | ✔ (2×) | ✔ (2×) | nº da apólice | transação |
| `[cdTransacao]` | ✔ | ✔ | nº do processo | transação |
| `[cnpj]` | ✔ | ✔ | CNPJ do cliente — **não é atributo da transação**, chave calculada | servidor |
| `[deSeguradora]` | ✔ | ✔ | seguradora | transação |
| `[deMercadoria]` | ✔ | ✔ | mercadoria | transação |
| `[deGuia]` | ✔ | ✔ | fatura / invoice | transação |
| `[deModal]` | ✔ | ✔ | modal | transação |
| `[deOrigem]` / `[deDestino]` | ✔ | ✔ | início / destino | transação |
| `[deEmbalagem]` | ✔ | ✔ | embalagem | transação |
| `[deMoedaSigla]` | ✔ (2×) | ✔ (4×) | sigla da moeda do processo | transação |
| `[deObservacao]` | ✔ | — | observação | transação |
| `[vlPeso]` | — | ✔ | peso | transação |
| `[vlMercadoria]` | — | ✔ | custo | transação |
| `[vlFrete]` | — | ✔ | frete | transação |
| `[vlFinalPremioCliente]` | — | ✔ | prêmio do cliente (rótulo "Seguro") | transação |
| `[deTipoValor]` | — | ✔ | rótulo do tipo de valor (ex.: CIF) | transação |
| `[vlFinalImpostoSeguradora]` | — | ✔ | **I.S.** final (é o mesmo campo que a listagem mostra como "I.S." para exportação/definitiva) | transação |
| `[fobFrIs]` / `[fobFrPr]` | ✔ | — | I.S. / prêmio de **Custo+Frete** | servidor |
| `[fobFrDesIs]` / `[fobFrDesPr]` | ✔ | — | Custo+Frete+Despesas | servidor |
| `[fobFrDesLucIs]` / `[fobFrDesLucPr]` | ✔ | — | Custo+Frete+Despesas+Lucros Esperados | servidor |
| `[fobFrImpIs]` / `[fobFrImpPr]` | ✔ | — | Custo+Frete+Impostos (II, IPI, ICMS, PIS, COFINS) | servidor |
| `[fobFrDesImpIs]` / `[fobFrDesImpPr]` | ✔ | — | Custo+Frete+Despesas+Impostos | servidor |
| `[fobFrDesLucImpIs]` / `[fobFrDesLucImpPr]` | ✔ | — | Custo+Frete+Despesas+Lucros+Impostos | servidor |

Os pares A/C de cada tipo são idênticos exceto pelo título ("Cobertura Básica AMPLA A" /
"Restrita C") e, no IMP, por um espaço. A lista completa aceita pelo servidor é a que o botão
**Palavras Chaves** devolve — os modelos podem usar só parte dela.

### 7.4 Cálculos da estimativa (importação) — **inferidos**, feitos no servidor

A tabela "ESTIMATIVA DE SEGURO" da importação oferece **seis cenários** de composição da I.S., cada
um com I.S. e prêmio e uma caixa "( )" para o cliente marcar. Nenhuma dessas contas está no
bundle; pela regra de cálculo documentada em [04-regras-calculo.md](04-regras-calculo.md), o
esperado é:

```
base        = vlMercadoria + vlFrete                          // custo + frete
despesas    = base × pcDespesa / 100                           // default 10 %
lucros      = base × pcLucroEsperado / 100                     // default 10 %
impostos    = vlImposto (II+IPI+ICMS+PIS+COFINS)
taxa        = txBasicaCliente + txAdicionalCliente (+ txGuerraGreveCliente se marcado)

fobFrIs           = base                               fobFrPr           = premio(fobFrIs)
fobFrDesIs        = base + despesas                    fobFrDesPr        = premio(fobFrDesIs)
fobFrDesLucIs     = base + despesas + lucros           fobFrDesLucPr     = premio(fobFrDesLucIs)
fobFrImpIs        = base + impostos                    fobFrImpPr        = premio(...)
fobFrDesImpIs     = base + despesas + impostos         fobFrDesImpPr     = premio(...)
fobFrDesLucImpIs  = base + despesas + lucros + impostos  fobFrDesLucImpPr = premio(...)

premio(is) = arred2(is × taxa / 100)      // possivelmente max(…, prêmio mínimo da apólice)
```

Pontos em aberto: se os impostos usam `txImposto` (taxa própria) em vez da taxa geral; se o prêmio
mínimo é aplicado em cada cenário; o formato numérico (o modelo não tem símbolo de moeda, só a sigla
no cabeçalho da coluna).

Textos fixos relevantes do bloco de estimativa (IMP): "Cálculo efetuado sobre a moeda de negociação
de compra (Importação) do seguro. Quando do pagamento do prêmio ou da indenização, os valores serão
convertidos para USD." e **"Proposta válida para câmbio de abertura +6% spread"** — a regra de
PTAX + 6 % já implementada no sistema novo.

Exportação: não há cenários; o bloco lista Custo, Frete, Seguro (prêmio) e "{deTipoValor}" (I.S.)
na moeda do processo, mais Peso. O modelo EXP 2026 contém **lixo de teste** que vai para o cliente:
"Taxa de contrato de câmbio para compra da moeda estrangeira = USD10,00", "spreed teste" e a frase
"moeda de negociação de compra (Importação)" num documento de exportação.

### 7.5 Estrutura do modelo (IMP, ~45 KB de texto; EXP, ~40 KB)

| # | Seção | Dinâmico? |
|---|---|---|
| 1 | Destinatário: "Á {deCliente}", "Á CARGO DE: Sr (a) {deContato}" | sim |
| 2 | Ref.: PROPOSTA DE SEGURO DE TRANSPORTE INTERNACIONAL {IMPORTAÇÃO/EXPORTAÇÃO} – APÓLICE Nº {cdApolice} – Cobertura Básica {AMPLA A / Restrita C} | apólice |
| 3 | Objeto do seguro; nota "VIDROS → Restrita C" (IMP) | fixo |
| 4 | Bens não compreendidos (lista de exclusões) | fixo |
| 5 | Âmbito geográfico; países com cobertura suspensa | fixo |
| 6 | Meios de transporte (marítimo: navios ≤ 20 anos, classificados; aéreo; terrestre com ANTT/RNTRC; ferroviário) | fixo |
| 7 | Importância segurada e coberturas adicionais 200/201/202/204 | fixo |
| 8 | Limite máximo de garantia (US$ 2 mi por viagem; R$ 5/2/1 mi viagem preliminar rodoviária) e LMI US$ 5 mi | fixo |
| 9 | Riscos cobertos, coberturas básicas (01, 03, 12, 4, 6), adicionais 200–225, cláusulas específicas 301–315 | fixo |
| 10 | Início e fim dos riscos; cláusula de contingência CIF/CIP/DAT/DAP (IMP) | fixo |
| 11 | Prejuízos indenizáveis / não indenizáveis; moeda da apólice US$ | fixo |
| 12 | Averbações (dados a informar 24 h antes do embarque) | fixo |
| 13 | Franquia (1 %, mínimo USD 250 por embarque) | fixo |
| 14 | Gerenciamento de risco: análise de perfil, regras AKAD, rastreamento, REC, bloqueador, Radar Akad, municípios proibidos | fixo |
| 15 | Dispensa de direito de regresso (transportadores da PINHOSEG LTDA) | fixo |
| 16 | Vistorias; Sinistros (e-mail de avarias da Pinho) | fixo |
| 17 | **Estimativa de seguro** — ficha do processo + tabela de valores (§ 7.3/7.4) | sim |
| 18 | Observações (marítimo/aéreo/rodoviário), declaração de não ter outra apólice, "SEGURO DEVERÁ SER EFETUADO OBRIGATORIAMENTE 24HRS ANTES DO INÍCIO DO RISCO" | fixo |
| 19 | Aceite: "Local e Data" / "Assinatura" | fixo |

Cabeçalho/rodapé dos modelos 2026: identidade **coomex hub** ("o ecossistema que movimenta o mundo ·
Curitiba · Paraná · Brasil | contato@coomexhub.com | coomexhub.com").

---

## 8. "Processo de Seguro" (`seguro`) — código morto

Componente de 772 nós com uma **proposta de exportação inteira escrita no template**, da época em
que a operação era da **Fidelidade Corretora (Fidcargo)** — endereço Rua Marechal Deodoro 503,
Curitiba, SUSEP 059318.1.015482-2, links `fidcargo.com.br`. Oito páginas: carta de proposta (Ampla
"A"), procedimentos (aceite → averbação provisória → numerário com câmbio do dia e acerto de variação
após 24 h → definitiva e certificado), condições da Cobertura Básica Ampla A, procedimento de avarias,
Cláusula Especial nº 2 (consulta a cadastro de motoristas) e lista de coberturas/cláusulas 100–312.

Campos dinâmicos: `dtTransacao` (impresso **sem formatação** em dois lugares e como `dd/MM/yyyy` nos
cabeçalhos de página), `deContato`, `cdApolice`, `deSeguradora`, `deCobertura`. **Sem valores.**
O botão que o abre está com `*ngIf="false"`. Serve apenas como histórico; foi substituído pelos
modelos `.docx`.

---

## 9. Documentos vizinhos (fora deste escopo, só para referência)

| Documento | Componente | Endpoint | Retorno |
|---|---|---|---|
| Impressão de provisórias em lote (faixa de averbação + seguradora) | `impressao-provisoria` | `/relatorio/imprimeProvisoria` | `{arquivo, extensao, deAnexo}` → `printService` |
| Impressão de definitivas em lote | `impressao-definitiva` | `/relatorio/imprimeDefinitiva` | idem |
| Arquivo de remessa (CSV) | `arquivo-provisoria` / `arquivo-definitiva` | `/relatorio/imprimeArquivo{Provisoria,Definitiva}` | idem |
| Carta de protesto | `processo-aba-cartas-protesto` | `/relatorio/imprimeCartaProtestoPDF` | idem |
| Solicitação de numerário (cobrança) | `numerario-impressao` (75 KB) | — | template no cliente |

---

## 10. Implicações para o sistema novo

1. **Proposta**: manter o modelo `.docx` por Tipo × Cobertura com vigência (`validFrom`), merge no
   backend com sintaxe `[campo]` compatível (para reaproveitar os modelos atuais), saída DOCX e PDF.
   Expor a lista de placeholders na própria tela de modelos (o "Palavras Chaves" do legado) e
   **validar o modelo no upload** (placeholder desconhecido = erro), o que evitaria o texto de teste
   que hoje vai para o cliente.
2. **Recibo / certificado / cobertura**: são simples o bastante para virar templates HTML → PDF no
   backend, com os valores calculados no domínio (não strings pré-formatadas como `dePremio`).
3. Valor por extenso precisa de um helper próprio (pt-BR, "reais"/"centavos") — o legado faz no
   servidor e não dá para copiar.
4. Corrigir as armadilhas conhecidas: ano da provisória derivado da data da definitiva, "FOB+Frete"
   fixo, `vlAdicionalNavio` × `vlClassificacaoNavio`, recibo vazio quando `cdComissaoNumerario` é nulo,
   cidade "Curitiba" fixa.

---

## 11. Pontos a validar com dado real

| # | Ponto | Como validar |
|---|---|---|
| 1 | Regra de escolha da versão do modelo (maior `dtVersao` ≤ hoje? ≤ data do processo?) | gerar proposta de processo antigo e comparar com o modelo vigente na época |
| 2 | Fórmulas de `fobFr*Is` / `fobFr*Pr` (taxa usada para impostos, prêmio mínimo por cenário, arredondamento) | baixar o DOCX de uma cotação de importação conhecida (ex.: processo 2085) e recalcular |
| 3 | Lista completa de palavras-chave aceitas no merge | botão "Palavras Chaves" na tela de modelos (somente leitura, mas é endpoint fora da allowlist — pedir ao usuário) |
| 4 | Semântica de `flVerProposta` e `isRecibo` | conferir na listagem em quais estágios/posições cada botão aparece |
| 5 | `cdComissaoNumerario` 0/1 ↔ Direta/Nota Fiscal e qual valor o recibo mostra em cada caso | abrir recibo de um processo de cada tipo |
| 6 | O que é `vlPremioLiqOverSComiReal` (prêmio líquido sem comissão?) e a taxa de câmbio por trás de `vlPremioOverReal` (`txDolarNumerario`?) | comparar recibo × numerário pago do mesmo processo |
| 7 | `nuEmbalagemNumero` é mesmo a versão do processo | comparar com a coluna "Versão" do numerário |
| 8 | Conteúdo e formato de `deCoberturaImpressao`, `dePremio`, `deTaxa`, `deTipoValor` na "Emitir Cobertura" | abrir a cobertura de uma exportação definitiva |
| 9 | Origem de `cdMercadoriaFranquia` (percentual de franquia por mercadoria?) e de `impSegurada` (moeda do processo?) | certificado de uma importação definitiva |
| 10 | O PDF da proposta é conversão do DOCX (layout idêntico) ou outro template | gerar os dois para o mesmo processo |
| 11 | Formatação numérica dos valores no DOCX (casas, separadores) | idem item 2 |
| 12 | Se a acentuação do recibo/certificado sai correta (HTML Latin-1 sem `charset`) | abrir e inspecionar a aba gerada |
| 13 | Comportamento com processo prorrogado (`PRG-`, prêmio de prorrogação, selo) | certificado de processo em "Definitivas em Prorrogação" |

### Respostas da rodada 2 (18/11/2026)

- **4 (`isRecibo`):** `true` em todos os 724 numerários pagos analisados — coerente com "numerário pago".
- **5 (`cdComissaoNumerario`):** 1 = Nota Fiscal em **100 %** dos numerários pagos; "Direta" (0) não é usada.
- **6 (`vlPremioLiqOverSComiReal`):** com NF é o prêmio cheio em R$ (importação) ou (prêmio NF + IRB) × taxa
  (exportação); a taxa de `vlPremioOverReal` é **`txDolarNumerario`**.
- **8 (Emitir Cobertura):** `deCoberturaImpressao` = `" USD 122.874,30"` (I.S. na moeda, com espaço à esquerda),
  `dePremio` = `" USD 307,19"`, `deTaxa` = `"0,2500000% + 0,0000000%  = 0,2500000%"` (taxa do cliente
  básica + adicional, 7 casas, dois espaços antes do "="). Na importação o mesmo campo vem com `"null 8.343,80"`
  (bug: moeda nula).
- **Verso do certificado:** transcrito literalmente na seção 5.
- **2 (fórmulas `fobFr*`):** decifradas contra 385 importações — ver doc 19, "Motor de cálculo decifrado".
  Impostos **são** tarifados nos cenários; cenário de verba ausente sai zerado.
- Seguem abertos: 1, 3 (precisa de autorização — `/cadastro/palavrasChaves` está fora da allowlist), 7, 9–13.
