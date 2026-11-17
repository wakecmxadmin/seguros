# Validações contra dado real do legado

Conferências feitas em 16/11/2026 na tela do legado (só leitura), lendo as respostas que a própria tela recebe. Complementa os docs 15–18, que vieram da análise estática do bundle.

## Planilha Produção
- obterTodasTransacoesProducao volta sem registros para 2024-01-01..2026-11-16, Tipo Todos e Importação. Request leva cdEmpresa "Fidcargo" (fixo no login).

## Pendências Provisórias
- 11.080 registros; ícones Cotação: Editar / Imprimir proposta PDF / Baixar proposta DocX; Provisória: só Editar.
- obterTodasTransacoes devolve 254 campos/linha; campos de resultado (prêmio) zerados nas linhas recentes.

## Ranking Clientes (01/11–16/11/2026, 185 processos)
- vlPercentual = vlFinalPremioClienteDolar / total prêmio cliente × 100 (18.642,97/28.564,83 = 65,27%) — NÃO é I.S.
- Último registro = linha de totais (só campos total*), do período inteiro.
- Agrupa por cdCliente (FRESNOMAQ 2720 e 723 em linhas separadas).
- vlResultadoDolar ≠ prêmioCli − prêmioSeg − IRB (946,58 vs 4.559,48) — a investigar (comissão?).

## Ranking Parceiros (mesmo período)
- Resultado US$ = PrêmioCli − PrêmioSeg − ComissãoParceiro + IRB  (conferido exato: FRESNOMAQ 2720 = 18.642,97 − 13.093,49 + 990 − 5.592,90 = 946,58)
- Comissão parceiro = 30% do prêmio cliente (ASCENSUS 23.219,75 → 6.965,94).
- IRB = US$ 10 por processo, entra como RECEITA (1.180 / 118 proc).
- Diferença residual de US$ 7,00 entre soma por parceiro e total por cliente — investigar.
- Linha de totais aparece como linha 5 vazia na grade (bug do legado). Resultado pode ser negativo (PAULO BACH −6,66).
- 4 parceiros no período: ASCENSUS (118 proc, 2 clientes), Pinho (56/15), AGENCIAMENTO (10/8), PAULO BACH (1).

## Nova Cotação Importação — defaults reais (tela aberta e abandonada)
- Marcados: Guerra e Greve, Despesas, Lucros Esperados, Prêmio Mínimo. Desmarcados: Paralisação, I.I, IPI, ICMS, PIS, COFINS, Provisória única.
- Modal Aéreo, Situação Nova, Condição CFR, Moeda Dólar EUA, Cobrança via Coomex, Orçamento Taxas, Valor declarado "Com valor declarado", garantia sem seleção.
- Taxa básica seguradora pré-preenchida 0,05400 em Frete/Despesas/Lucros (Custo 0).
- Apólices no combo: só 3 (027982026000106220000532, ...0206220002687, ...0206220003965). Seguradoras: 9 (Bradesco duplicada, "Fidcargo Insurance System(Fictício)").

## Numerários Pagos (página 1, 35 numerários de importação, todos cdComissaoNumerario=1/NF) — fórmulas conferidas
| Regra | Acerto |
|---|---|
| I.S. = custo + frete + despesas + lucros + impostos (na moeda do processo) | 34/35 (2046 é moeda ≠ USD) |
| Comissão parceiro US$ = round2(prêmioCli US$ × vlComissaoParceiro%) (30%) | 35/35 |
| Prorrogação cliente = round2(prêmioCli US$ × 20%) | 35/35 |
| **A pagar c/ agravo (`vlDolarAPagarAgravo20`) = `vlDolarAPagar` × 0,75 → desconto de 25 %** | 35/35 |
| Diferença US$ = prêmioCli − a pagar c/ agravo | 35/35 |
| Resultado US$ = prêmioCli − prêmioSeg − comissão + IRB | 34/35 (2046: sobra 1,00) |
| Resultado operacional R$ = prêmio R$ − pago seguradora R$ − comissão R$ | 35/35 |
| CIF US$ = custo + frete + prêmioCli | 34/35 |
| NF (cdComissaoNumerario=1): prêmio líquido s/ comissão R$ = prêmio R$ cheio | 35/35 |
| Prêmio mínimo respeitado quando flCalculadoMinimo | 35/35 |
- Conversão R$ no numerário usa **`txDolarNumerario`** (taxa do dia do numerário), não txDolar nem txDolarMaiorPeriodo. Valor R$ = round2(valor US$ já arredondado × taxa).
- `vlDolarAPagar` (10,03) = soma NÃO arredondada das verbas da seguradora, arredondada no fim; `vlFinalPremioSeguradoraDolar` (10,02) = soma das verbas já arredondadas. Os dois coexistem.
- Prêmio por verba = verba × taxa% (sem arredondar por verba no cliente; seguradora arredonda por verba em vlPremio*Seguradora).
