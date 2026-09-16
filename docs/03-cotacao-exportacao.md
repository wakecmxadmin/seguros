# Tela: Nova Cotação — Exportação (`#/CotacaoExportacao/Menu`)

Título: **"Nova Cotação - Exportação"**. Mesma espinha dorsal da Importação, porém **notavelmente mais
enxuta** — o que confirma que os dois fluxos são variantes de um mesmo agregado "Processo/Cotação", com
regras de cálculo distintas.

## Diferenças em relação à Importação

### Removido na Exportação
- checkbox **Provisória única**
- bloco **Impostos** (I.I / IPI / ICMS / PIS / COFINS)
- campos **Cliente desconto**, **Desconto seguradora**, **Percentuais despesa**, **Percentuais lucro esperado**
- coberturas acessórias **Despesas**, **Lucros Esperados**, **Prêmio Mínimo**
- linhas de verba **Despesas**, **Lucros esperados**, **Impostos** na grade de taxas

### Adicionado na Exportação
| Campo | Bloco | Observações |
|---|---|---|
| **Previsão de saída** | Origem | data prevista de embarque |
| **Desconto padrão** | Dados Financeiros | % — substitui os dois descontos da importação |
| **Adicional carta** | Dados Financeiros | % — default **10,00**; ligado à cobertura "Carta de Crédito" |
| **Valor IRB** | Comissões | valor de resseguro |
| **Moeda IRB** | Comissões | select de moedas |
| **Carta de Crédito** | Coberturas Acessórias | substitui Despesas/Lucros/Prêmio Mínimo |
| **Valor CIF** | grade de Taxas | linha de verba própria |
| **Percentual adicional navio** | grade de Taxas | % aplicado sobre o cálculo (idade/tipo de embarcação) |

### Defaults diferentes
- **Guerra e Greve** vem **marcado por padrão** (na importação vem desmarcado).
- Taxa **Básica da Seguradora** default = `0,25000` (importação: `0,05400`).
- Garantia default = `Básica Ampla "A"`; Embalagem default = `ADEQUADA`.

## Estrutura da tela

1. **Identificação** — Processo (readonly), Data, Data limite pendência, Apólice, Seguradora, Código do
   cliente + 🔍 + Descrição, Código do parceiro + 🔍 + Descrição, Contato, Telefone, E-mail.
2. **Origem** — Modal, País, Estado, Cidade, Aeroporto/Porto, **Previsão de saída**.
3. **Destino** — País, Estado, Cidade, Aeroporto/Porto.
4. **Dados do Produto** — Mercadoria, Observação, Observação Interna, Situação, NCM, Marca, Peso(kg),
   Proforma/Comercial, Código da mercadoria + 🔍 + Descrição, Garantia, Embalagem.
5. **Dados Financeiros** — Condição de Venda, Moeda, Over, Referência, Cobrança via, Desconto padrão,
   Adicional carta, Orçamento (Taxas/Valores), Funcionário, Valor declarado.
6. **Comissões** — Vendedor, Parceiro % (30,00), Pinho %, Vendedor %, Valor IRB, Moeda IRB.
7. **Coberturas Acessórias** — Guerra e Greve ✔, Paralisação Máquina/Refrigeração, Carta de Crédito.
8. **Taxas** — cabeçalho "Cálculo do seguro", blocos **Cliente** e **Seguradora**, colunas
   `Básica | Adicional | GTM/GMCC | Total | Prêmio`. Linhas: **Custo**, **Frete**, **Valor CIF**.
   Campo solto: **Percentual adicional navio**.
   Totalizadores: Importância segurada, I.S. US$, I.S. R$ · Prêmio total, Prêmio total US$,
   Prêmio total aproximado R$ (repetidos para Cliente e Seguradora).
9. **Ações** — `Calcular` (cinza) e `Salvar` (verde), canto inferior direito.

## Layout desta tela (melhor que o da Importação)
Diferente da Importação (coluna única longa), a Exportação usa **cards lado a lado** com cabeçalho cinza-azulado
(`Origem` | `Destino`, `Comissões` | `Coberturas Acessórias`), o que reduz muito a rolagem.
Vale usar esse padrão de agrupamento como base para as duas telas no sistema novo.
