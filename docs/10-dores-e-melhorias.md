# Dores identificadas e oportunidades de melhoria

Ordenado por impacto. Cada item foi observado diretamente na plataforma em produção.

---

## 🔴 Críticos

### 1. Controle de acesso praticamente inexistente
**Hoje:** existe uma tela `PerfilSelecao` (não linkada no menu) com abas *Menu*, *Usuários Disponíveis* e
*Permissões*. Mas há **um único perfil cadastrado** ("Operacional"), a aba *Permissões* tem apenas dois
checkboxes — *"Permite Impressão de Portadores (bancos e caixas)"* (herdado do ERP, sem relação com seguros)
e *"Permite Acesso Externo"* — e a aba *Menu* lista itens **sem rótulo**, só com a etiqueta "Permitido".

O cadastro de Usuários tem exatamente um flag útil: *Permite solicitar Numerário*. Convivem dois tipos de
usuário sem distinção formal: **internos** identificados por nome (Andre, Stephany, William, bruna, paulo,
thais, thatyana) e **externos** identificados por CNPJ.

**Impacto:** qualquer pessoa logada enxerga e altera prêmio, taxa, comissão e dados de todos os clientes.
Não há trilha de auditoria.

**Melhoria:** RBAC real (papéis × permissões por recurso e ação), escopo de dados por cliente/parceiro,
auditoria de alterações, recuperação de senha por token, 2FA para administradores.

### 2. 10.279 pendências provisórias acumuladas
**Hoje:** a tela de Pendências Provisórias não tem filtro de data por padrão e retorna 10.279 registros.
Existe o campo *Data limite pendência*, mas nada alerta quando vence.

**Impacto:** provisórias que nunca viraram definitiva significam prêmio não faturado e exposição de risco
não regularizada com a seguradora.

**Melhoria:** painel de pendências por vencimento, alertas automáticos (e-mail/in-app), régua de cobrança,
e um mutirão de saneamento na migração.

### 3. Cotação do câmbio digitada à mão, todo dia
**Hoje:** `Cadastro de taxa cambial diária` — um card por dia, preenchido manualmente com o *Valor fiscal*.
Só o **Dólar EUA** está alimentado, das 12 moedas cadastradas. Só há dias úteis.

**Impacto:** se ninguém lançar, o cálculo em R$ para. Erro de digitação contamina prêmio, comissão e
rentabilidade de todos os processos do dia.

**Melhoria:** ingestão automática da **PTAX do Banco Central**, com fallback para o último dia útil,
suporte às 12 moedas e override manual auditado.

### 4. Console de SQL embutido na aplicação
**Hoje:** existe a rota `ComandosSqlSelecaoComponent` no bundle do frontend. Não foi acessada durante o
mapeamento (executaria escrita no banco).

**Impacto:** se estiver ativa em produção, é execução de SQL arbitrário por qualquer usuário autenticado.

**Melhoria:** confirmar com a Infoline se está habilitada e desativar. Não replicar no sistema novo.

---

## 🟠 Altos

### 5. Taxa da apólice guardada em texto livre
Apólices se chamam `AKAD - 0.10% - PROBEXA`, `ACE - IMP - 29.28`, `AKAD - EXP`. A taxa — informação
central do negócio — está no **nome**. A tabela `Coberturas` tem campos de taxa por modal e por lado
(cliente/seguradora), mas está **inteiramente zerada**: na prática o operador digita a taxa à mão em
cada cotação.

O campo **prêmio mínimo** sequer aparece em tela, embora o cálculo o aplique (conferido: soma de prêmios
20,41 → cobrado 30,00).

**Melhoria:** tabela de tarifação estruturada (apólice × cobertura × modal × mercadoria), com taxa básica,
adicional, GTM/GMCC, prêmio mínimo e franquia; preenchimento automático na cotação, com override justificado.

### 6. Formulário de cotação monolítico
A tela de Importação tem ~60 campos em rolagem única, sem etapas, sem salvamento parcial, sem indicação de
obrigatórios e sem validação progressiva. O cálculo só roda ao clicar **Calcular**.
Origem e Destino exigem 4 selects encadeados cada, com 220 países sem busca por digitação.
O rótulo "Aeroporto" permanece mesmo quando o modal é Marítimo.

**Melhoria:** wizard em etapas (ou abas) com autosave, recálculo reativo, combobox com busca,
rótulo dinâmico por modal, e resumo lateral fixo com I.S. e prêmio sempre visíveis.

### 7. Busca por "código + lupa"
Cliente, parceiro e mercadoria exigem digitar um código numérico ou abrir um modal de busca.
**Melhoria:** autocomplete por nome/CNPJ direto no campo.

### 8. Dados de cadastro sujos
- **Países** (~220): entradas-lixo `..` e `...`; duplicatas — Bélgica ×2, Índia/índia/India,
  Coréia/Korea/Coréia do Sul, Iugoslavia/Iuguslávia, Ghana/GANA, Kenia/Quênia/República do Quenia,
  Filipinas/Philippinas, Cingapura/Singapura, Iemên/Yemen, Africa/Africa do Sul.
- **Seguradoras**: "Bradesco Auto/RE" cadastrado duas vezes (códigos 1 e 4); endereços "XX" e "A";
  e-mail "A@sa.com"; seguradora brasileira com país "Estados Unidos" e cidade "Rio Rancho".
- **Parceiros**: todos com `Ativo = Não` na primeira página — a flag não é usada de fato.
- **Portos/aeroportos**: sem UN-LOCODE/IATA, sem cidade/estado; "Abu Dhabi" duplicado.
- **Mercadorias**: apenas 2 registros (`MAQUINAS`, `OUTROS`), taxas zeradas — tudo cai em "OUTROS".

**Melhoria:** deduplicação e normalização na migração; seed de países/portos a partir de bases públicas
(ISO 3166, UN-LOCODE, IATA); validação de CNPJ e preenchimento via BrasilAPI/ReceitaWS.

---

## 🟡 Médios

### 9. Três padrões de interface convivendo
Grid com filtros (Clientes, Parceiros, Seguradoras), cards editáveis inline (Apólices, Coberturas,
Funcionários, Câmbio, Portos) e formulário com abas (Usuário). Cada um com botões e posições diferentes.

**Melhoria:** um único padrão de listagem + um único padrão de formulário, com componentes compartilhados.

### 10. Cores de linha inteira como única semântica de status
Amarelo = Cotação, rosa = Provisória pendente, branco = Aprovada/Definitiva. Funciona, mas prejudica
contraste e é inacessível para daltônicos.

**Melhoria:** manter o significado, trocando por **badges de status** + faixa colorida sutil na borda esquerda.

### 11. Funcionário ≠ Usuário
São cadastros desconectados. O select "Vendedor" da cotação vem de *Funcionários*, mas quem opera o sistema
está em *Usuários*. Não há como saber quem criou ou alterou um processo.

**Melhoria:** uma entidade `User` com vínculo opcional a `Employee`; `createdBy`/`updatedBy` em tudo.

### 12. Versionamento de templates por nome de arquivo
Modelos de proposta versionados como `MODELO PROP IMP COB AMPLA A 2026 (1)`, com datas 13/03, 02/07 e 03/07.
**Melhoria:** versionamento real com data de vigência, autor e possibilidade de rollback.

### 13. Filtros com defaults ruins
Rankings e Novas Cotações abrem com **15 dias**; Intermediação Emitidas abre com **5 anos**;
Pendências Provisórias abre **sem filtro** (10.279 registros). Sem coerência.
**Melhoria:** defaults por contexto (mês corrente para operação, ano para ranking) e filtros salvos por usuário.

### 14. Funcionalidades órfãs
- *Pagamento de Intermediação de Negócios Funcionário* → aponta para `#/emContrucao`
- *Relatório de Saldo Provisórias* → `#/emContrucao`
- *Mapa* → `#/emContrucao`
- *Cadastro de E-mails* → existe e está **vazio**
- *Prorrogações*, *Sinistros* e *Cartas de Protesto* → têm endpoints e telas, mas não estão no menu

**Melhoria:** decidir com o cliente o que entra no escopo. Sinistros e Cartas de Protesto parecem
relevantes para o negócio e mereceriam ser implementados de verdade.

---

## 🟢 Oportunidades novas (não existem hoje)

| Oportunidade | Ganho |
|---|---|
| **Portal do cliente/parceiro** | o parceiro cota e acompanha sozinho; hoje tudo passa pela Pinho |
| **Alertas e notificações** | atacar as 10.279 pendências na origem |
| **Auditoria completa** | rastrear quem alterou taxa, prêmio e comissão |
| **Painel operacional** | pendências vencendo, cotações paradas, provisórias sem baixa — não um "dashboard" genérico |
| **Cotação comparativa entre seguradoras** | hoje escolhe-se uma seguradora antes de calcular |
| **Anexos no processo** | invoice, packing list, BL/AWB — hoje não há upload |
| **Histórico de cotações do cliente** | reaproveitar cotação anterior como base para uma nova |
| **API pública** | integração com o ERP dos clientes e despachantes |
| **Exportação consistente** | hoje só a Planilha Produção exporta Excel; Arquivos gera CSV |
| **Responsivo / mobile** | a interface atual só funciona em desktop largo |
