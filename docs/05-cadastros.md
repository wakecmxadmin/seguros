# Cadastros Gerais — telas mapeadas

Três padrões de UI convivem no legado (inconsistência a resolver no sistema novo):

| Padrão | Telas | Descrição |
|---|---|---|
| **A — Grid + filtros** | Clientes, Parceiros, Seguradoras, Usuários, Modelos de Propostas | tabela paginada, filtros no topo, botão verde `+ Incluir` no rodapé, edição em tela separada |
| **B — Cards inline** | Apólices, Coberturas, Funcionários, Mercadorias, Taxas Cambiais, Aeroportos/Portos, E-mails, (provavelmente Embalagens, Navios, Moedas, Países, Estados, Cidades, Transportadoras) | grade de cards, **cada card é um formulário editável in-place** com ícones 💾 salvar e ⛔ excluir; botão `+ Adicionar` no topo |
| **C — Formulário simples** | edição de Usuário | campos soltos com abas |

Paginação padrão: 15 registros/página, controles `« ‹ 1 2 3 › »`.

---

## Usuários (`#/ContaUsuarioSelecao/Menu`) — padrão A

Lista: `Usuário` · `Data Último Acesso` · `Token`
Filtros: campo `Usuário` + toggle `Permite solicitar Numerario`
Edição (aba única "Geral"): `Usuário` · `Código` (readonly) · `Token` · toggle `Permite solicitar Numerario`
Ações: `Zerar Senha` · `Voltar` · `Excluir` · `Salvar`

- Convivem **dois tipos de usuário** sem distinção formal: **externos**, identificados por **CNPJ**
  (`00091050000121`, `00711083000399`…), e **internos**, identificados por **nome**
  (Andre, Stephany, William Ruytina, bruna, paulo, thais, thatyana).
- O único flag de autorização nesta tela é *Permite solicitar Numerário*.
- Sem e-mail, sem nome completo, sem vínculo com o cadastro de Funcionários.
- Recuperação de senha só existe como **"Zerar Senha" acionado pelo administrador** — não há
  fluxo de "esqueci minha senha" para o próprio usuário.
- "Data Último Acesso" e "Token" aparecem vazios na maioria dos registros. ~5 páginas de usuários.

## Perfis (`#/PerfilSelecao/Menu`) — **tela existente, mas não exposta no menu**

Descoberta na análise do bundle (`/perfil/*`, `flGloPermissaoPorMenu`) e confirmada na aplicação.

Listagem: `Código` · `Empresa`. **Um único perfil cadastrado: "Operacional".**

Edição com três abas:

| Aba | Conteúdo real |
|---|---|
| **Menu** | "Menus Disponíveis" — itens listados **sem rótulo**, apenas com a etiqueta `Permitido` e um botão de remover. Dados incompletos. |
| **Usuários Disponíveis** | transferência dupla: à esquerda os disponíveis (CNPJs), à direita os **Usuários Permitidos** — os 7 usuários internos por nome |
| **Permissões** | apenas 2 checkboxes: ☑ *Permite Impressão de Portadores (bancos e caixas)* e ☐ *Permite Acesso Externo* |

> **Conclusão:** existe um **esqueleto** de RBAC (perfil → menus → usuários), mas ele não está em uso
> efetivo: um só perfil, permissões genéricas herdadas do ERP e sem relação com o domínio de seguros,
> e a lista de menus quebrada. Na prática **não há segregação de acesso** — qualquer usuário logado
> enxerga e altera prêmio, taxa e comissão de todos os clientes. Não há auditoria.

## Clientes (`#/ClientesSelecao/Menu`) — padrão A
Filtros: `Razão Social/Nome` · `CNPJ/CPF` · `País` · `Endereço` · `Cidade` · `Estado`
Colunas: `Código` · `Razão Social` · `Telefone` · `Nome Fantasia` · `Endereço` · `Cidade` · `Estado` · `País` · `CNPJ/CPF` · `E-mail` · `Ativo`
Duas ações por linha (editar ✏️ / detalhe 🔍). Registro `0` sentinela no topo. ~5 páginas.

## Parceiros (`#/ParceirosSelecao/Menu`) — padrão A
Mesma estrutura de Clientes. São despachantes/agentes de carga (DC Logistics, Schenker, APM Global,
Pinho Comissária, Fidcargo…). **Todos com `Ativo = Não`** na primeira página — sinal de que a flag
não é usada de fato. ~5 páginas.

## Seguradoras (`#/SeguradorasSelecao/Menu`) — padrão A
Mesma estrutura. 9 registros + sentinela `0`:
Bradesco Auto/RE (1) · Fidcargo Insurance System (Fictício) (2) · ACE Seguradora (3) ·
BRADESCO AUTO/RE COMPANHIA DE SEGUROS (4) · GENERALI (5) · SEGUROS SURA (6) · ARGO (7) ·
TOKIO MARINE (8) · AKAD (9).
> Dados sujos: "Bradesco" duplicado (1 e 4), endereços inconsistentes ("XX", "A"), país "Estados Unidos"
> com cidade "Rio Rancho"/"New Mexico" em seguradora brasileira, e-mail "A@sa.com".

## Apólices (`#/ApolicesSelecao/Menu`) — padrão B
Filtro: `Apolíce` (número). Campos por card:
`Número da Apólice` · `Descrição da Apólice` · `Importância Segurada` · `Código do Corretor` ·
`Tipo da apolíce` (Importação/Exportação) · `Seguradora` · `Ativo/Inativo`
Exemplos reais: `ACE - IMP - 29.28` (I.S. 4.000.000,00) · `AKAD - 0.10% - PROBEXA` (2.000.000,00) ·
`AKAD - 0.19% - PROBEXA` · `AKAD - EXP`.
> A descrição da apólice carrega a **taxa** no próprio nome (0.10 %, 0.19 %, 29.28) — informação de negócio
> escondida em texto livre. Candidata forte a virar campo estruturado.
> O campo `premioMinimo` **não aparece nesta tela**, embora o cálculo o utilize (ver `04-regras-calculo.md`)
> — provavelmente vive em outra tabela ou está fixo no código.

## Coberturas (`#/CoberturasSelecao/Menu`) — padrão B
Campos: `Descrição` · `Única` (checkbox) · `Taxa marítima da seguradora` · `Taxa marítima do cliente` ·
`Taxa aérea da seguradora` · `Taxa aérea do cliente`
Registros: `Básica Ampla "A"` (taxa aérea seguradora 1,00) · `Básica Restrita "B"` (3,00) ·
`Básica Restrita "C"` (2,00). Todas as taxas marítimas e de cliente estão **zeradas**.
> As taxas por modal existem na modelagem mas não estão alimentadas — na prática a taxa é digitada
> manualmente em cada cotação. Oportunidade: tabela de taxas efetiva → preenchimento automático.

## Funcionários (`#/FuncionariosSelecao/Menu`) — padrão B
Filtros: `Funcionário` · `Setor` · `Função` · `Status`
Campos: `Funcionário` · `Setor` · `Função` · `E-mail` · `Status` (Ativo/Inativo)
4 registros: Avarias (Sinistro/Assistente ADM) · Bruna Pietra Appi (Seguro/Administrativo) ·
INFOLINE (Seguro) · Regiane (financeiro).
> **Funcionário ≠ Usuário.** Não há vínculo entre quem opera o sistema e este cadastro — é apenas
> uma lista para o select de "Vendedor" nas cotações. Unificar no sistema novo.

## Mercadorias (`#/MercadoriasSelecao/Menu`) — padrão B
Rótulo interno: **"meremb"**. Campos: `Código da meremb` · `Descrição` ·
`Marítimo/Terrestre` (taxa, 5 casas) · `Aéreo` (taxa, 5 casas) · `Franquia`
Só 2 registros: `MAQUINAS` (código 0) e `OUTROS` (27915), ambos com taxas zeradas e franquia 1,00000.
> Classificação de risco por mercadoria praticamente inexistente — tudo cai em "OUTROS" (código 1318
> observado nas cotações reais). Oportunidade clara de melhoria (tarifação por NCM/tipo de carga).

## Taxas Cambiais Diárias (`#/TaxasCambiaisDiariasSelecao/Menu`) — padrão B
Filtros: `Data inicial` · `Data final` (default: últimos 30 dias) · `Moeda`
Campos por card: `Data` · `Moeda` · `Valor fiscal`
Valores observados (Dólar EUA): 03/08 = 5,3942 · 05/08 = … · 07/08 = 5,3942 · 10/08 = 5,3951 ·
11/08 = 5,4057 · 12/08 = 5,4590 · 13/08 = **5,4944** · 17/08 = 5,5326 · 18/08 = 5,5197 · 19/08 = 5,4814
> **Maior dor operacional visível**: a cotação do dólar é **digitada manualmente, card a card, todo dia**.
> Só há dias úteis lançados e apenas Dólar EUA. Automatizar via API do Banco Central (PTAX) é ganho imediato.

## Aeroportos/Portos (`#/AeroportosPortosSelecao/Menu`) — padrão B
Filtros: `Descrição` · `País` · `Modal`
Campos: `Descrição` · `País` · `Modal` (Aéreo/Marítimo/…)
> Sem código IATA/UN-LOCODE, sem cidade/estado — só nome livre + país. Há duplicatas
> ("Abu Dhabi" cadastrado duas vezes, uma Aéreo e uma Marítimo) e países duplicados ("Índia"/"India").

## E-mails (`#/EmailsSelecao/Menu`) — padrão B
Campos: `E-mail` · `Cobertura`. **Cadastro vazio** (só o card em branco).
Provável destino: lista de cópia no envio de propostas por cobertura.

## Modelos de Propostas (`#/ModelosPropostaSelecao/Menu`) — padrão A
Filtros: `Tipo` (Importação/Exportação) · `Cobertura` · `Data período inicial/final`
Colunas: `Tipo` · `Cobertura` · `Data da versão` · `Arquivo` · botão **Download modelo**
Arquivos reais: `MODELO PROP IMP COB AMPLA A 2026`, `MODELO PROP EXP COB RESTRITA C 2026`, …
Versões de 13/03/2026, 02/07/2026 e 03/07/2026 (várias com sufixo "(1)" — versionamento manual por nome).
> A proposta é gerada a partir de um **template de documento** por combinação Tipo × Cobertura.
> Versionamento por nome de arquivo e duplicatas "(1)" indicam controle frágil.

## Demais cadastros (padrão B, estrutura simples)
`Países` · `Estados` · `Cidades` · `Embalagens` · `Navios` · `Moedas` · `Transportadoras` · `Vistorias`
— não abertos individualmente, mas seus dados aparecem como selects nas cotações:
- **Países**: ~220 registros, com lixo (`..`, `...`) e duplicatas (Bélgica ×2, Índia/índia/India, Coréia/Korea/Coréia do Sul, Iugoslavia/Iuguslávia, Ghana/GANA, Kenia/Quênia/República do Quenia, Filipinas/Philippinas, Cingapura/Singapura, Iemên/Yemen).
- **Moedas**: 12 (Real, Dólar EUA, Iene, Euro, Franco Suíço, Coroa Sueca, Libra, Dólar Canadense, Iuan, Dólar Australiano, Coroa Norueguesa, Coroa Dinamarquesa).
- **Embalagens**: 47 registros (ADEQUADA, CONTAINER, CX. MADEIRA, GRANEL LÍQUIDO/SÓLIDO, TAMBORES ×9 variações, SACOS ×3, SEM EMBALAGEM…).
