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

---

# Rodada 2 — 18/11/2026 (tarefas 56–58)

Leitura passiva das respostas que as próprias telas recebem (gravador de XHR na página), mais os
catálogos `/cadastro/obterTod*` pela exceção da tarefa 51 (allowlist testando o caminho inteiro).
Amostras salvas fora do git em `backend/prisma/data/mapeamento/` (contêm CNPJ).

⚠️ **Incidente registrado:** alterar o campo "registros por página" de qualquer listagem dispara
`POST /contaUsuario/salvarQtRegistrosPaginaUsuario` (grava a preferência no perfil do usuário). O
servidor respondeu **HTTP 405** e nada foi gravado. Não mexer nesse campo em trabalho no legado.

## Numerários pagos — exportação (324 numerários, 2021–2026, **todos**)

| Regra | Acerto |
|---|---|
| **Agravo (`vlDolarAPagarAgravo20`) = `vlDolarAPagar` × 0,75 → desconto de 25 % também na exportação** | 324/324 |
| Comissão parceiro US$ = round2(prêmio cliente × %) (20 % ou 30 % por processo) | 324/324 |
| Prorrogação = round2(prêmio cliente × 20 %) | 324/324 |
| Prêmio + IRB (`vlPremioOverDolarIrbDolar`) = prêmio over + IRB | 324/324 |
| R$ = round2(US$ × `txDolarNumerario`) (prêmio, comissão); IRB R$ = IRB × taxa, sem arredondar | 323/324 (E-17, de 2021, sem taxa) |
| **I.S. = (custo + frete) ÷ (1 − taxa total)** — o prêmio entra na própria I.S. ("prêmio sobre prêmio"), qualquer incoterm | 323/324 |
| Prêmio cliente = round2(I.S. × taxa) | 323/324 |
| Diferença US$ = prêmio cliente **+ IRB** − a pagar c/ agravo (na importação não soma o IRB) | 324/324 |
| Resultado US$ = prêmio cliente − prêmio seguradora − comissão + IRB | 315/324 (9 com sobra de US$ 1,00, igual ao 2046 da importação) |
| Prêmio líquido s/ comissão R$ (NF) = round2((prêmio NF + IRB) × taxa) | 314/324 |
| Resultado operacional R$ = prêmio R$ + IRB R$ − pago seguradora R$ − comissão R$ | 261/324 (o resto diverge pelo "prêmio over" abaixo) |

**"Prêmio over" (o que é cobrado no numerário) depende do incoterm** (`deTipoValor`):

| Incoterm | Prêmio cobrado (`vlPremioOverDolar`) | Casos |
|---|---|---|
| CIF, CIP, DAP, DDP | prêmio total (com prêmio sobre prêmio) | 254 |
| CFR, CPT | prêmio do custo + prêmio do frete (sem prêmio sobre prêmio) | 35 (4 CPT fogem) |
| EXW, FCA, FOB | só o prêmio do custo | 23 |

A NF (`vlPremioOverNotaFiscal`) sai sempre com o prêmio total. `vlDiferencaDolarExportacao` =
prêmio over + IRB − prêmio NF (= IRB quando os dois prêmios coincidem). Seguradoras: só AKAD (197) e
ARGO (127). Versões do numerário: 1 (272), 2 (31), 3+ (21).

## Numerários pagos — importação (400 mais recentes de 7.138, 28/09–18/11/2026)

- Agravo × 0,75 em 400/400 (confirma a rodada 1).
- **IRB não é fixo**: é digitado por processo — US$ 10 (352), **US$ 30** (28, só marítimo) e 0 (20).
  O "US$ 10 por processo" da rodada 1 era o valor típico, não regra.
- 100 % AKAD, comissão 30 %, incoterm FOB (352), CFR, EXW, FCA, CIF, CPT. Moedas: USD (385), EUR (11), outras.
- Versão do numerário: 2 (264), 1 (94), 3 (36), 4–5 (6). Uma linha por averbação (um numerário por
  definitiva). O que muda entre versões não aparece na listagem; o detalhe dispara
  `/numerario/calculaNumerario` ao abrir, então **não foi aberto**.

## Comissão "Direta" não é usada
Nos 724 numerários pagos analisados (324 exp + 400 imp), `cdComissaoNumerario = 1` (Nota Fiscal) em
**todos**. A forma "Direta" existe no código e na tela, mas não tem uso real.

## IRB / RME — nunca usado
- `IrbEmitidaSelecao`: `/numerario/obterTodasIrbs` devolve **0 registros**, sem filtro.
- "Emissão IRB" (`NumerariosChequeIRB`): **7.465 processos** aguardando — exatamente todos os
  numerários pagos (7.138 imp + 324 exp + 3). Nenhum IRB/RME foi emitido na história do tenant.
- Posição de definitiva "IRB Emitido": 0 processos.

## Intermediação de negócios
- "Pagamento de Intermediação" (aguardando solicitar NF): **5.602** comissões.
- "Intermediação Emitidas": **24** solicitações desde 2021, todas de parceiro, status
  "Solicitada NF", **nenhuma com data de pagamento**. Ex.: ASCENSUS, 20/10/2026, prêmio US$ 10.078,80,
  R$ 51.915,36. O registro traz `vlImposto` (≈ 19,7 % da comissão em R$ no exemplo — a investigar).

## Notas fiscais (fechamento)
- "NF's Emitidas": 90 fechamentos, do `cdNf 1` (04/2006) em diante, mensais, usuários antigos
  (marcelo, sandra, artur). **A tela não tem paginação** e ignora o filtro de data: mostra sempre os
  15 primeiros (2006–2007). Os fechamentos recentes, se existem, são inalcançáveis pela UI.
- "Gerar" da Emissão NF **não foi clicado** (ver doc 20, item 5).

## Distribuição real de status × posição (Pendências, `deMenu = pedenciaProvisoria`, 11.116 linhas)

| Status | Posição | Qtde | | Status | Posição | Qtde |
|---|---|---|---|---|---|---|
| Cotação (2.191) | Pendente | 0 | | Definitiva (7.762) | Follow-up | 47 |
| | Em cálculo | 0 | | | Falta enviar Numerário | 28 |
| | Proposta em aberto | 4 | | | Numerário enviado | 38 |
| | Aprovada | 1.480 | | | Valorizado / Desvalorizado / Atrasado | 0 / 0 / 0 |
| | Reprovada | 707 | | | Recibo ("Recebido") | 7.462 |
| Provisória (1.163) | Pendente | 220 | | | Numerário pago | 1 |
| | Follow-up | 0 | | | Prorrogado | 0 |
| | Parcial | 403 | | | IRB Emitido | 0 |
| | Concluída | 467 | | | Acerto | 0 |
| | Cobrança | 0 | | | Cancelada | 186 |
| | Cancelada | 73 | | | | |

- A posição 6 da definitiva se chama **"Recibo"** no filtro e **"Recebido"** na linha.
- Posições que **nunca ocorrem**: Pendente/Em cálculo (cotação), Follow-up/Cobrança (provisória),
  Valorizado, Desvalorizado, Atrasado, Prorrogado, IRB Emitido e Acerto (definitiva). "Efetuar
  Cobrança" da provisória, portanto, não é usado.
- **Definitivas em Prorrogação: 0.** A prorrogação existe só como campo calculado (`vlProrrogacaoCliente`).
- O menu Pendências traz **todos os status** (cotação, provisória e definitiva).
- Listas: "Novas cotações" = últimos 15 dias, todos os status (325); "Em aberto" = cotações em
  "Proposta em aberto" (4); "Solicitar Numerário" = 66 (as 28 "Falta enviar" + as 38 "Enviado").

## Processo × averbações e saldo da provisória
- O **processo é o `cdTransacao`**; cotação, provisórias e definitivas são linhas dele, com
  `nuAverbacao` 0 (cotação), P-nnnn e D-nnnnnn/E-nnnnn. Aprovar mantém a cotação como linha
  "Aprovada" e cria a provisória no mesmo processo. Um processo pode ter **mais de uma provisória**
  (2168: P-2088 Pendente e P-2068 Parcial).
- **Saldo = custo da provisória − Σ custo das definitivas** do processo; % = saldo ÷ custo da
  provisória × 100. Conferido: 2113 (2.778,43 − 2.618,27 = 160,16 → 5,76 %) e 1617
  (23.923,92 − 24.298,92 = **−375,00** → −1,57 %).
- O saldo **pode ficar negativo** (definitivas acima da provisória não são barradas) e **zerar não
  muda a posição**: continua "Parcial" até o operador clicar *Concluir*. Há "Concluídas" com 100 %
  de saldo (encerradas sem definitiva).
- O saldo é **por processo**: as duas provisórias do 2168 mostram o mesmo saldo (498.750 = 99,75 %,
  que só fecha com custo + frete da provisória − custo da definitiva em outra moeda — caso a investigar).
- Provisórias "de limite" são comuns: valores redondos de 1.000.000 e 500.000 com 100 % de saldo.
- Na listagem, as colunas Prêmio US$ e I.S. vêm **zeradas** para todas as linhas recentes; só o
  detalhe (`obterTransacaoAtualizada`, 325 campos) traz os valores.
- Abrir um processo pelo lápis só dispara leituras (`obterTransacaoAtualizada`, combos,
  `listaCartasProtesto`, avarias, destinatários).
- O botão **"Gerar"** da provisória (`menu == averbacaoProvisoria`) só chama `voltar()` — não gera nada.

## Cartas de protesto — em uso
Catálogos preenchidos e mantidos pelos operadores (salvos em
`backend/prisma/data/legacy-cartas-protesto-catalogos.json`):
- Avarias marítimas: 74 (do "ABERTO" ao "SUJO", inclusive termos em inglês e um item vazio);
  aéreas: 16 ("A - Diferença de peso" … "O - Outros", "Sujo").
- Destinatários: ~120 no marítimo e ~115 no aéreo (armadores, agentes de carga, cias aéreas,
  terminais, portos, aeroportos), com espaços sobrando no início e no fim dos nomes.
- A definitiva aberta (D-107201) não tinha cartas; a quantidade de cartas por processo não é
  listável sem abrir processo a processo.

## Motor de cálculo decifrado por completo (18/11/2026, análise offline das amostras)

Conferido rodando o motor novo (`quote-calculator.ts`) contra as amostras — testes em
`quote-calculator.spec.ts`, que se pulam sem os arquivos de `backend/prisma/data/mapeamento/`.

- **Arredondamento:** HALF_UP sobre o valor exato do double, percentuais como `valor × (pct/100)`.
  55,55 × 30 % = 16,66 (não 16,67). Comissão 698/700, prêmio de custo da seguradora 700/700.
- **Importação (385/385 em US$):** lucros = (custo + frete + **despesas**) × %; **impostos são
  tarifados** (taxa própria, padrão = a das linhas); prêmio do cliente = round(Σ linhas cruas);
  prêmio da seguradora = round(custo, frete e lucros arredondados + despesas e impostos crus);
  base do agravo = round(Σ linhas cruas da seguradora); a pagar = round(base × 0,75);
  diferença = round(prêmio cliente − base × 0,75).
- **Exportação (314/315 em US$):** I.S. = round((C + F) ÷ (1 − t)); prêmios = round(I.S. × taxa) dos
  dois lados (não a soma das linhas); diferença soma o IRB.
- **Estimativa da proposta (`fobFr*`, 385/385):** usa despesas, lucros e impostos da própria
  cotação, zera o cenário cuja verba não existe, tarifa impostos e aplica o piso:
  prêmio = max(round(base × t + impostos × t_imp), mínimo). Responde o ponto 2 do doc 16.
- Processos em moeda ≠ USD: o legado guarda comissão e resultado já convertidos para US$; a
  conferência foi feita só em USD.
