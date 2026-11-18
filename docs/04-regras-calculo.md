# Regras de negócio — cálculo do seguro

Fórmulas **inferidas e conferidas** contra um processo real (nº 2085, importação, AKAD, apólice
`027982026000206220002687`), em 02/09/2026.

## Caso conferido

| Item | Verba | Taxa Cliente | Prêmio Cliente | Taxa Seguradora | Prêmio Seguradora |
|---|---:|---:|---:|---:|---:|
| Custo | 7.056,06 | 0,25000 % | 17,64 | 0,05400 % | 3,81 |
| Frete | 365,95 | 0,25000 % | 0,91 | 0,05400 % | 0,20 |
| Despesas | 742,20 | 0,25000 % | 1,86 | 0,05400 % | 0,40 |
| Lucros esperados | 0,00 | 0,25000 % | 0,00 | 0,05400 % | 0,00 |
| Impostos | 0,00 | 0,00000 % | 0,00 | 0,00000 % | 0,00 |
| **Importância segurada** | **8.164,21** | | **30,00** | | **4,41** |

## Fórmulas

### 1. Verbas derivadas
```
despesas        = (custo + frete) × percentualDespesa / 100
lucrosEsperados = (custo + frete + despesas) × percentualLucroEsperado / 100
```
Conferido: `(7.056,06 + 365,95) × 10% = 742,20` ✔. **Lucros incluem as despesas na base** —
conferido em 385/385 importações (ex.: `(17.512,91 + 9.500 + 2.701,29) × 10% = 2.971,42`; rodada 2,
18/11/2026). O caso 2085 não mostrava isso porque tinha lucros desmarcado.
(`percentualDespesa` e `percentualLucroEsperado` têm default 10,00 no formulário.)

> As verbas **Despesas** e **Lucros esperados** só entram na base quando as coberturas acessórias
> homônimas estão marcadas. No caso conferido, *Despesas* ✔ marcada e *Lucros Esperados* ✘ desmarcada
> (por isso lucros = 0,00 mesmo com percentual 10).

### 2. Importância Segurada (I.S.)
```
importanciaSegurada = custo + frete + despesas + lucrosEsperados + impostos
```
Conferido: `7.056,06 + 365,95 + 742,20 + 0 + 0 = 8.164,21` ✔

### 3. Taxa total por linha
```
taxaTotal = taxaBasica + taxaAdicional + taxaGtmGmcc
```
`GTM/GMCC` = adicional de Guerra/Greve (só entra quando a cobertura "Guerra e Greve" está marcada).

### 4. Prêmio por linha e prêmio total (importação)
```
premioLinha = verbaLinha × (taxaTotalLinha / 100)
premioCliente    = round( Σ premioLinha cru )
premioSeguradora = round( round(custo) + round(frete) + round(lucros) + despesas cru + impostos cru )
baseDoAgravo     = round( Σ premioLinha seguradora cru )        // vlDolarAPagar
```
Conferido (Cliente): `17,64 + 0,91 + 1,86 = 20,41`; (Seguradora): `3,81 + 0,20 + 0,40 = 4,41` ✔.
Em 385/385 importações (rodada 2) as três regras batem centavo a centavo — inclusive a peculiaridade
de a seguradora arredondar só custo, frete e lucros antes de somar, e a base do agravo poder diferir
1 centavo do prêmio da seguradora (10,03 × 10,02).

**A linha de Impostos gera prêmio**, com taxa própria (`txTotalImpostos` / `vlTotalImpostoSeguradora`)
que por padrão é a mesma das demais linhas; em 5/385 o operador zerou a do cliente. A versão anterior
deste documento dizia que impostos não eram tarifados — estava errado.

### 5. Prêmio Mínimo
Com a cobertura **Prêmio Mínimo** marcada, o prêmio do **Cliente** é elevado ao piso da apólice:
```
premioTotalCliente = max(Σ premioLinha, premioMinimoApolice)
```
Conferido: soma = 20,41 → cobrado **30,00**. Logo `premioMinimoApolice = 30,00` (na moeda da apólice, USD).
**O prêmio mínimo não se aplica ao lado Seguradora** (permaneceu 4,41).

### 6. Conversão cambial
```
taxaCambio      = cotacaoDoDia(moedaProcesso → BRL)   // Cadastro de Taxas Cambiais Diárias
valorEmReais    = valorEmMoeda × taxaCambio
```
Conferido: `44.855,80 / 8.164,21 = 5,4942` e `30,00 × 5,4942 = 164,83` ✔ (rótulo: "Prêmio total **aproximado** R$").

### 7. Agravo, diferença e resultado
```
aPagarComAgravo = round( baseDoAgravo × (1 − agravo/100) )       // agravo = 25 % nos dois ramos
diferenca       = round( premioCliente (+ IRB na exportação) − baseDoAgravo × (1 − agravo/100) )
resultado       = premioCliente − premioSeguradora − comissaoParceiro + IRB
```
O "a pagar" é guardado cru no legado e só arredondado na exibição; a diferença usa o valor cru.
Conferido: 385/385 importações e 314/315 exportações em US$ (rodada 2). O agravo é **desconto**
concedido pela seguradora e vale **25 % também na exportação** (324/324) — o "0,30" informado pelo
cliente não aparece nos dados (tarefa 69).

O **IRB** é digitado por processo (US$ 0, 10 ou 30) nos dois ramos e entra como receita no resultado.

### 8. Comissionamento
Percentuais aplicados sobre o **prêmio do cliente** (total, não o cobrado): `Parceiro %` (default
30,00), `Pinho %`, `Vendedor %`. `comissao = round(premioCliente × (pct / 100))` — 698/700.

### 9. Específico da Exportação
- Verbas: **Custo**, **Frete** e **Valor CIF**, que **não é digitado**: é o prêmio sobre prêmio.
  ```
  I.S.             = round( (custo + frete) ÷ (1 − taxaCliente/100) )
  valorCIF         = I.S. − (custo + frete)
  premioCliente    = round( I.S. × taxaCliente/100 )
  premioSeguradora = round( I.S. × taxaSeguradora/100 )      // não é a soma das linhas
  ```
  Conferido em 314/315 exportações em US$ (rodada 2; a exceção, E-50031, já foge no legado).
- **Prêmio cobrado no numerário depende do incoterm** (a NF e as comissões usam o total):

  | Incoterm | Cobrado |
  |---|---|
  | CIF, CIP, DAP, DDP (e DAT, DDU, CI) | prêmio total |
  | CFR, CPT | `round((custo + frete) × taxa)` |
  | EXW, FCA, FOB (e FAS) | `round(custo × taxa)` |

  Com o prêmio mínimo aplicado, cobra-se o mínimo.
- **Percentual adicional navio** — acréscimo de taxa por característica da embarcação.
- **Adicional carta** (default 10,00 %) — vinculado à cobertura *Carta de Crédito*.
- Taxa básica de seguradora observada como default: `0,25000` (importação: `0,05400`).

## Observações de arredondamento
- Verbas e prêmios: **2 casas**; taxas: **5 casas**.
- O legado (Java) arredonda **meio para cima sobre o valor exato do double**, e calcula percentuais como
  `valor × (pct / 100)`. Por isso 55,55 × 30 % sai 16,66 (o double é 16,66499…), não 16,67. Com essa regra
  a comissão bate em 698/700 e o prêmio de custo da seguradora em 700/700. Implementado em
  `backend/src/common/money.ts` — usar sempre esse helper em contas de seguro.
- Padrão numérico pt-BR (vírgula decimal, ponto de milhar).
- I.S. R$ e Prêmio R$ são rotulados como **aproximados** — a conversão definitiva ocorre na averbação.
