# Identidade visual do legado (base para a nova interface)

Valores extraídos por `getComputedStyle` na aplicação em produção + amostragem de screenshots.

## Tipografia
- Família: **Roboto**, fallback `"Helvetica Neue", sans-serif`
- Base: `16px`
- Framework de origem: **Bootstrap 3/4** (cores neutras `#212529`, `#495057`, `#ced4da`, `rgba(0,0,0,.125)` denunciam isso)

## Cores medidas

| Papel no legado | Valor | Hex |
|---|---|---|
| Ação primária (botão Login, item de menu ativo) | `rgb(0,157,190)` | **`#009DBE`** — teal/ciano |
| Barra de topo / faixa do header | `rgb(219,225,242)` | **`#DBE1F2`** — azul-lavanda claro |
| Fundo da sidebar | `rgb(236,236,236)` | `#ECECEC` |
| Texto principal | `rgb(33,37,41)` | `#212529` |
| Texto secundário | `rgb(73,80,87)` / `rgb(85,85,85)` | `#495057` / `#555555` |
| Bordas de input | `rgb(206,212,218)` | `#CED4DA` |
| Superfície de card | `rgb(255,255,255)` | `#FFFFFF` |

## Cores identificadas nos screenshots (a confirmar por amostragem de pixel)

| Papel | Aproximado | Onde aparece |
|---|---|---|
| Azul institucional profundo | `#1A3A8F` ~ `#17348C` | faixa/fundo da área de conteúdo, imagem de porto com overlay azul |
| Cinza-azulado de cabeçalho de bloco | `#6C757D` | faixas "Origem", "Destino", "Dados do Produto", "Taxas", "Comissões" |
| Verde de confirmação | `#5CB85C` ~ `#4CAF50` | botões `Salvar`, `+ Incluir`, `+ Adicionar`, ícone 💾 nos cards |
| Vermelho destrutivo | `#D9534F` | botões `Excluir`, ícone ⛔ nos cards |
| Azul de busca/ação secundária | `#337AB7` ~ `#4A7EBB` | botões `Pesquisar`, `Download modelo`, botões de ação nas linhas do grid |
| Cinza de ação neutra | `#6C757D` | botão `Calcular`, ícones de impressão nas linhas |
| Marca Coomex (logo) | azul-marinho `#1B2A4A` + dourado `#B99A5B` | logotipo no topo da sidebar |

## Semântica de cor nas listagens (linguagem visual já internalizada pelos usuários)

| Cor da linha | Significado |
|---|---|
| **Amarelo claro** | Processo em *Cotação* / posição "Proposta em aberto" |
| **Rosa/magenta** | *Provisória* com posição "Pendente" |
| **Branco** | *Cotação Aprovada* ou *Definitiva* (Follow-up) |

> Essa codificação por cor é o principal recurso de leitura das telas de listagem hoje.
> Vale **preservar o significado** no sistema novo, mas trocar o preenchimento de linha inteira
> (que polui e prejudica contraste do texto) por **badges de status** + faixa colorida sutil na borda.

## Recomendação de paleta para o sistema novo

Manter a âncora da marca (azul institucional + teal de ação), corrigindo contraste e consistência:

```css
:root {
  /* Marca */
  --brand-navy:      #17348C;  /* azul institucional — headers, ênfase */
  --brand-navy-deep: #10245F;
  --brand-teal:      #009DBE;  /* ação primária — herdado do legado */
  --brand-teal-hover:#0088A6;
  --brand-gold:      #B99A5B;  /* detalhe da marca Coomex, uso pontual */

  /* Superfícies */
  --bg:              #F7F8FA;
  --surface:         #FFFFFF;
  --surface-alt:     #F1F4F9;  /* deriva do #DBE1F2 do legado, mais neutro */
  --border:          #E2E6ED;
  --border-strong:   #CED4DA;

  /* Texto */
  --fg:              #1A2233;
  --fg-muted:        #5C6779;

  /* Status (mapeados a partir das cores de linha do legado) */
  --status-cotacao:    #C79A1E;  /* era amarelo    */
  --status-provisoria: #B5379B;  /* era rosa       */
  --status-definitiva: #2F7D5C;  /* era branco/ok  */
  --status-pendente:   #C4553B;

  /* Feedback */
  --success:     #2F9E44;
  --warning:     #E8A33D;
  --danger:      #D64545;
}
```

Tipografia sugerida: **Inter** (ou manter Roboto para não estranhar), com escala 14 px de base para
telas densas de dados — o legado usa 16 px, o que força rolagem em formulários já muito longos.
