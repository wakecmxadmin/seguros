# Tela: Nova Cotação — Importação (`#/CotacaoImportacao/Menu`)

Título exibido: **"Importação"**. É o coração operacional do sistema: gera o *processo* (cotação), que
depois evolui para **Provisória** e **Definitiva** (averbação).

Layout atual: formulário único, longo, em coluna, com rótulos alinhados à direita e blocos separados por
títulos. Sem abas, sem wizard, sem validação visível por etapa. Dois botões no fim: **Calcular** e **Salvar**.

---

## Bloco 1 — Identificação do processo

| Campo | Tipo | Observações |
|---|---|---|
| Processo | texto (readonly) | número sequencial gerado pelo sistema (ex.: 2078) |
| Data | texto/data | preenchido com a data corrente |
| Data limite pendência | texto/data | prazo para regularizar a pendência |
| Apólice | select | lista apenas apólices vigentes do ramo (2 opções ativas na importação) |
| Seguradora | select | 10 seguradoras cadastradas |
| Código do cliente + 🔍 | texto + busca modal | preenche "Descrição" (readonly) |
| Código do parceiro + 🔍 | texto + busca modal | preenche "Descrição" (readonly) |
| Provisória única | checkbox | define se o processo gera uma única provisória |
| Contato | texto | |
| Telefone | texto | |
| E-mail | texto | |

## Bloco 2 — Origem

| Campo | Tipo |
|---|---|
| Modal | select: Aéreo(1), Ferroviário(4), Marítimo(2), Terrestre(3) |
| País | select (~220 países cadastrados) |
| Estado | select dependente de País |
| Cidade | select dependente de Estado |
| Aeroporto/Porto | select dependente de Cidade (rótulo muda conforme o modal) |

## Bloco 3 — Destino
Mesma estrutura da Origem (País → Estado → Cidade → Aeroporto/Porto), sem campo Modal.

## Bloco 4 — Dados do Produto

| Campo | Tipo | Observações |
|---|---|---|
| Mercadoria | textarea | descrição livre |
| Observação | textarea | sai na proposta/apólice |
| Observação Interna | textarea | uso interno |
| Situação | select: Nova(0), Usada(1) | afeta taxação |
| NCM | texto | |
| Marca | texto | |
| Peso (kg) | decimal | |
| Proforma/Comercial | texto | número da fatura |
| Código da mercadoria + 🔍 | texto + busca modal | preenche "Descrição" |
| Garantia | select: Básica Ampla "A"(1), Básica Restrita "B"(3), Básica Restrita "C"(2) | cláusulas ICC |
| Embalagem | select (47 opções) | ADEQUADA, CONTAINER, CX. MADEIRA, GRANEL-LIQUIDO/SOLIDO, TAMBORES…, SEM EMBALAGEM |

## Bloco 5 — Dados Financeiros

| Campo | Tipo | Default |
|---|---|---|
| Condição de Venda (Incoterm) | select: FOB(1), CIF(2), CFR(3), FCA(4), FAS(5), CPT(6), CIP(7), DDU(8), DDP(9), EXW(10), CI(11), DAP(12), DAT(13) | CFR |
| Moeda | select: Real(1), Dólar EUA(2), Iene(3), Euro(4), Franco Suíço(5), Coroa Sueca(6), Libra(7), Dólar Canadense(8), Iuan(9), Dólar Australiano(10), Coroa Norueguesa(11), Coroa Dinamarquesa(12) | Dólar EUA |
| Over | % | 0,00 |
| Referência | texto | |
| Cobrança via | select: Coomex(0) / Parceiro(1) | Coomex |
| Cliente desconto | % | 0,00 |
| Desconto seguradora | % | 0,00 |
| Percentuais despesa | % | **10,00** |
| Percentuais lucro esperado | % | **10,00** |
| Orçamento | select: Taxas(0) / Valores(1) | Taxas — alterna o modo de entrada da grade |
| Funcionário | texto | |
| Valor declarado | select: Com valor declarado(0) / Já incluída a cobertura para embarques aéreos sem valor declarado(1) / Sem valor declarado(2) / NDA(3) | Com valor declarado |

## Bloco 6 — Comissões

| Campo | Default |
|---|---|
| Vendedor (select de funcionários) | — |
| Parceiro % | **30,00** |
| Pinho % | 0,00 |
| Vendedor % | 0,00 |

## Bloco 7 — Coberturas Acessórias (checkboxes)
- Guerra e Greve
- Paralisação Máquina/Refrigeração
- Despesas
- Lucros Esperados
- Prêmio Mínimo

## Bloco 8 — Impostos (checkboxes)
`I.I` · `IPI` · `ICMS` · `PIS` · `COFINS` — definem quais tributos entram na base da Importância Segurada.

## Bloco 9 — Grade de Taxas (núcleo do cálculo)

Matriz com 5 linhas de **verbas** e 2 blocos de colunas (**Cliente** e **Seguradora**):

Linhas (verbas que compõem a Importância Segurada):
1. **Custo** — valor da mercadoria (editável)
2. **Frete** — (editável)
3. **Despesas** — calculado a partir do "Percentuais despesa"
4. **Lucros esperados** — calculado a partir do "Percentuais lucro esperado"
5. **Impostos** — (editável; depende dos checkboxes de impostos)

Colunas por bloco (Cliente / Seguradora), taxas em % com 5 casas decimais:
`Básica` · `Adicional` · `GTM/GMCC` · `Total` · `Prêmio`

> Observado: a linha **Custo** tem as taxas editáveis; as demais linhas herdam/replicam a taxa
> (ex.: taxa básica da seguradora `0,05400` propagada para todas as linhas). O bloco **Cliente** é o que
> é cobrado do segurado; o bloco **Seguradora** é o custo de repasse — a diferença é a margem da corretora.
> `GTM/GMCC` = Guerra/Greve (Greve, Tumulto e Motim / Guerra e Motim Cobertura Complementar).

### Totalizadores
| Rótulo | Bloco |
|---|---|
| Importância segurada | geral |
| Prêmio total | Cliente e Seguradora (dois valores) |
| I.S. US$ | geral |
| Prêmio total US$ | Cliente e Seguradora |
| I.S. R$ | geral |
| Prêmio total aproximado R$ | Cliente e Seguradora |

Conversão para R$ usa o **Cadastro de Taxas Cambiais Diárias**.

## Ações
- **Calcular** — recalcula a grade e os totalizadores sem persistir.
- **Salvar** — grava o processo com status *Cotação* / posição *Proposta em aberto*.

---

## Dores observadas (candidatas a melhoria)
1. Formulário monolítico e muito longo — sem etapas, sem salvamento parcial, sem indicação de campos obrigatórios.
2. Origem/Destino exigem 4 selects encadeados cada, com listas enormes (220 países, sem busca por digitação).
3. Cadastro de países com duplicidades e lixo (`..`, `...`, "Bélgica" duas vezes, "Índia"/"índia"/"India", "Coréia"/"Korea"/"Coréia do Sul").
4. Cálculo só acontece ao clicar "Calcular" — sem recálculo reativo.
5. Busca de cliente/parceiro/mercadoria por "código + lupa" em vez de autocomplete.
6. Rótulo "Aeroporto" fixo mesmo quando o modal é Marítimo/Terrestre.
