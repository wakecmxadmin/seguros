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
lucrosEsperados = (custo + frete) × percentualLucroEsperado / 100
```
Conferido: `(7.056,06 + 365,95) × 10% = 742,20` ✔
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

### 4. Prêmio por linha e prêmio total
```
premioLinha = verbaLinha × taxaTotalLinha / 100
premioTotal = Σ premioLinha
```
Conferido (Cliente): `17,64 + 0,91 + 1,86 = 20,41`
Conferido (Seguradora): `3,81 + 0,20 + 0,40 = 4,41` ✔

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

### 7. Margem da corretora
```
margemBruta = premioTotalCliente − premioTotalSeguradora
```
Caso conferido: `30,00 − 4,41 = 25,59` (85 % do prêmio cobrado).
É a diferença entre a **taxa de venda** (bloco Cliente) e a **taxa de custo** (bloco Seguradora).

### 8. Comissionamento
Percentuais aplicados sobre a margem/prêmio: `Parceiro %` (default 30,00), `Pinho %`, `Vendedor %`.
Na **Exportação** somam-se `Valor IRB` + `Moeda IRB` (resseguro).

### 9. Específico da Exportação
- Verbas: **Custo**, **Frete**, **Valor CIF** (não há despesas/lucros/impostos).
- **Percentual adicional navio** — acréscimo de taxa por característica da embarcação.
- **Adicional carta** (default 10,00 %) — vinculado à cobertura *Carta de Crédito*.
- Taxa básica de seguradora observada como default: `0,25000` (importação: `0,05400`).

## Observações de arredondamento
- Verbas e prêmios: **2 casas**; taxas: **5 casas**.
- Padrão numérico pt-BR (vírgula decimal, ponto de milhar).
- I.S. R$ e Prêmio R$ são rotulados como **aproximados** — a conversão definitiva ocorre na averbação.
