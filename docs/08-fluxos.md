# Fluxos operacionais

## Ciclo de vida do processo

```
                    ┌─────────────────────────────────────────────┐
   Nova Cotação ───►│  COTAÇÃO                                    │
   (Imp ou Exp)     │  posição: "Proposta em aberto"              │
                    └────────────┬────────────────────────────────┘
                                 │ aprovaTransacao / reprovarTransacao
                                 ▼
                    ┌─────────────────────────────────────────────┐
                    │  COTAÇÃO — posição "Aprovada"               │
                    └────────────┬────────────────────────────────┘
                                 │ salvarTransacao (gera averbação)
                                 ▼
                    ┌─────────────────────────────────────────────┐
                    │  PROVISÓRIA   nº  P-####                    │
                    │  posição: "Pendente"                        │
                    │  controla SALDO e PERCENTUAL (inicia 100%)  │
                    └────────────┬────────────────────────────────┘
                                 │ salvarDefinitiva / aprovaDefinitiva
                                 ▼
                    ┌─────────────────────────────────────────────┐
                    │  DEFINITIVA   nº  D-###### (imp)            │
                    │               nº  E-#####  (exp)            │
                    │  posição: "Follow-up"                       │
                    └────────────┬────────────────────────────────┘
                                 │ solicitarNumerario
                                 ▼
                    ┌─────────────────────────────────────────────┐
                    │  FINANCEIRO                                 │
                    │  "Falta enviar Numerário" → "Numerário      │
                    │   enviado" → "Recebido"                     │
                    └────────────┬────────────────────────────────┘
                                 │ solicitarNotaFiscal
                                 ▼
                    ┌─────────────────────────────────────────────┐
                    │  COMISSÃO / Intermediação de Negócios       │
                    │  rateio Parceiro / Pinho / Vendedor         │
                    └─────────────────────────────────────────────┘

   Ramificações:  cancelarTransacao · removerTransacao · concluiTransacao
                  ProcessosProrrogacoes (definitiva prorrogada, flProrrogacao)
                  Sinistros (salvarSinistro / obterTodosSinistros)
                  Cartas de Protesto (incluir/excluir/listar/imprimir PDF)
```

### Enums confirmados

| Campo | Valores |
|---|---|
| `status` | Cotação (0) · Provisória (1) · Definitiva (2) |
| `tipo` | Importação (0) · Exportação (1) |
| `modal` | Aéreo (1) · Marítimo (2) · Terrestre (3) · Ferroviário (4) |
| `posição` (cotação) | Proposta em aberto · Aprovada |
| `posição` (provisória) | Pendente |
| `posição` (definitiva) | Follow-up |
| `posição` (numerário) | Falta enviar Numerário · Numerário enviado · Recebido |

### Numeração de averbações
- `P-####` — Provisória (ex.: P-1994 … P-1998)
- `D-######` — Definitiva de **importação** (ex.: D-106493 … D-106585)
- `E-#####` — Definitiva de **exportação** (ex.: E-50304, E-50305)

Um mesmo processo aparece em **múltiplas linhas** nas listagens (uma por estágio) e uma definitiva pode
ter **várias versões** (coluna `Versão`: 1, 2, 3) — cada emissão de numerário gera uma versão.

---

## Fluxo financeiro (Solicitar Numerário → `#/NumerarioSelecao/Menu`)

Grid com seleção por checkbox e opção **Agrupado**:
`Versão` · `Processo` · `Data Cobrança` · `Forma Cobrança` (Numerário) · `Pagamento Comissão`
(select: Nota Fiscal) · `Cliente` · `Parceiro` · `Tipo` · `Status` · `Posição` · `Prêmio US$` · `Averbação`

Linhas com posição "Falta enviar Numerário" ficam **selecionáveis**; as já enviadas mostram o ícone de edição.
Ação: **`+ Solicitar Numerário`** (em lote).

### Numerários Pagos (`#/NumerariosPagos/Menu`)
Acrescenta `Data Pagamento` e `Recebido R$`; posição "Recebido".

### Pagamento de Intermediação de Negócios (`#/PagamentoComissaoSelecao/Menu`)
`Processo` · `Definitiva` · `Cliente` · `Parceiro` · `Prêmio US$` · `Comissão US$` · `Comissão R$`
Ação: **`+ Solicitar Nota Fiscal`** (em lote, por checkbox).

**Conferido com dados reais:** comissão = **30 % do prêmio** — bate com o default `Parceiro % = 30,00`.

| Processo | Prêmio US$ | Comissão US$ | % |
|---|---:|---:|---:|
| 2046 | 83,25 | 24,98 | 30,0 % |
| 2052 | 10,18 | 3,05 | 30,0 % |
| 2039 | 90,44 | 27,13 | 30,0 % |
| 2071 | 133,08 | 39,92 | 30,0 % |

### Intermediação de Negócios Emitidas (`#/ComissaoEmitidaSelecao/Menu`)
`Tipo` · `Favorecido` · `Data Cobrança` · `Data Pagamento` · `Prêmio US$` · `Recebido R$` · `Status`
Filtro default: últimos **5 anos**.

### Emissão IRB (`#/NumerariosChequeIRB/Menu`)
Resseguro. Campos `Valor IRB` / `Moeda IRB` vêm da cotação de exportação; endpoints
`emitirIrb`, `salvarIrb`, `obterTodasIrbs`, `atualizarTxIrb`, telas `PlanilhaIrb` e `IrbEmitida`.

---

## Relatórios

### Planilha Produção (`#/RelatorioProducao/Menu`) — o relatório gerencial mais rico
Filtros: período, processo inicial/final, definitiva inicial/final, cliente, parceiro, tipo, seguradora.
Campo **`Nova Tx. Câmbio Seguradora`** com botão de aplicação — permite **reprocessar a taxa de câmbio
em lote** sobre os registros filtrados.

Colunas: `Processo` · `Parceiro` · `Definitiva` · `Referência` · `RME` · `Cliente` ·
`Tx. Câmbio Seguradora` · `Tx.Rec.` · `Prêmio.Cli USD` · `Prêmio.Cli R$` · `A Pagar Seguradora USD` ·
**`A Pagar Seguradora AGRAVO 25% USD`** · `A Pagar R$` · `Dif USD` · `Dif R$` · **`% de Rentabilidade`**

> Regras de negócio novas reveladas aqui: existe um **agravo de 25 %** sobre o valor a pagar à seguradora,
> e a **rentabilidade por processo** é calculada como a diferença entre o prêmio do cliente e o custo da
> seguradora. Exportações: PDF e Excel (`gerarExcelRelatorioProducao`).

### Rankings (`RankingCliente` / `RankingApolice` / `RankingEstado` / `RankingParceiro`)
Colunas: `Nome` · `Percentual %` · `I.S. U$` · `Prêmio US$` · `Prêmio Seguradora US$` ·
`Resultado US$` · `IRB US$` · `Número Processos`
Filtro default: últimos 15 dias (curto demais para um ranking).

### Impressões (`ImpressaoProvisoria` / `ImpressaoDefinitiva`)
Filtros: faixa de averbação (inicial/final) + Seguradora → botão de impressão.

### Arquivos (`ArquivoProvisoria` / `ArquivoDefinitiva`)
Mesmos filtros + **`Tipo`** (CSV) → botão `Gerar`.
Geração do arquivo de remessa para a seguradora.

### Notas Fiscais (`#/Nf/Menu`)
Apenas `Data Inicial` · `Data Final` · botão `Gerar`. `NfEmitida` lista as geradas.

---

## Definitivas em Prorrogação (`#/ProcessosProrrogacoes/Menu`)
Tela **não exposta no menu**. Mesma listagem, com `Status` fixo em *Definitiva*.
Campos correlatos no modelo: `flProrrogacao`, `vlProrrogacaoCliente`, `vlProrrogadaSeguradoraDolar`,
`vlDiferencaDolarProrrogada`, `txDolarNumerarioProrrogada`, `obterListaApoliceTransacaoProrrogacao`.

> Prorrogação = estender a vigência de uma averbação definitiva, recalculando prêmio e diferença cambial.
> Sem tela no menu, provavelmente é feita por caminho alternativo ou está abandonada.
