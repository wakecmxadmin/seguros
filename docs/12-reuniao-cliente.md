# Reunião com o cliente — dores e regras de negócio

Anotações da reunião, organizadas e cruzadas com o que foi observado na plataforma legada.
**As anotações são a fonte; os comentários em bloco de citação são interpretação minha e precisam
de confirmação.**

## Diretriz de escopo

> "Tem bastante coisa que não usam do legado, mas achou melhor conseguir clonar tudo e depois ir
> retirando o que não for útil."

Ou seja: **paridade primeiro, poda depois**. Isso confirma a abordagem de mapear o legado inteiro
(feito em `docs/01` a `docs/11`) antes de decidir o que fica de fora.

---

## 1. Motivação geral

- Sistema legado **sem atualizações**.
- Precisa **automatizar grande parte das coisas** hoje manuais.
- Faltam **travas de segurança**.
- Falta **sistema de controle de permissões**.

> Os dois últimos itens confirmam o diagnóstico de `docs/10` (itens 1 e 4) e já foram atacados:
> RBAC com 48 permissões, auditoria e travas de transição de status.

---

## 2. Averbação mensal em lote  ⚠️ regra nova

> "Averbação de seguros mensal — lote de todos os seguros do mês, encaminhar para a seguradora
> com todos os dados: nº de documento, navio, data, …"

Fluxo periódico: fecha-se o mês e envia-se um **lote consolidado** para a seguradora.

Relação com o legado: as telas `ArquivoProvisoria` / `ArquivoDefinitiva` geram um CSV por faixa de
averbação e seguradora — provavelmente é esse o arquivo de remessa.

**Impacto no modelo:** falta a entidade de **lote mensal** (`EndorsementBatch`), com competência,
seguradora, status de envio e os itens. O campo `nuConhecimentoEmbarque` (BL/AWB) e `cdNavio` já
existem no legado e provavelmente compõem o layout do arquivo.

**A definir com o cliente:** layout exato do arquivo (colunas e ordem), formato (CSV? Excel? posicional?),
e se cada seguradora tem um layout próprio.

---

## 3. Taxa por cliente  ⚠️ regra nova, afeta o motor de cálculo

> "Cada cliente tem uma taxa (puxar cálculo certinho e automatizar todas as taxas e cálculos)."

**Este é o ponto mais importante para o cálculo.** O modelo atual tem taxa por **apólice** e por
**cobertura × modal**, mas **não por cliente**. Na prática, cada segurado tem uma tarifa negociada.

**Impacto no modelo:** criar `ClientRate` — taxa por (cliente × apólice/cobertura × modal), com
vigência. A precedência do motor passaria a ser:

```
taxa digitada  >  taxa do cliente  >  taxa da cobertura (por modal)  >  taxa da apólice
```

**A definir:** a taxa do cliente varia por modal? Por tipo de mercadoria? Tem vigência?
Existe taxa diferente para o lado cliente e o lado seguradora?

---

## 4. Integração com o SIGRA  ⚠️ escopo novo

> "Integração do SIGRA — agenciamento, import e export. Todos usam referências diferentes,
> às vezes pro mesmo processo."

O SIGRA é o sistema de agenciamento/despacho usado pela operação. Dois problemas:

1. **Dados que hoje chegam por e-mail** poderiam ser puxados direto do SIGRA.
2. **Referências divergentes** — o mesmo processo tem identificadores diferentes em cada sistema.

**Impacto no modelo:** o `Quote` precisa de uma tabela de **referências externas**
(`ExternalReference`: sistema, tipo, valor) em vez do único campo `reference` atual. Assim o mesmo
processo pode carregar a referência da Pinho, a do SIGRA, a do cliente e a do parceiro.

**A definir:** o SIGRA tem API? Banco acessível? Exportação de arquivo? Quem é o fornecedor?

---

## 5. Comunicação hoje refém do e-mail  ⚠️ escopo novo

> "Muito e-mail, comunicação centralizada no e-mail → deixar dentro da plataforma."
>
> "Quando a carga chega, operação e desembarque manda e-mail com a documentação que tem no SIGRA;
> dentro do sistema é manual (faz a fatura e envia pelo e-mail). Dá pra puxar direto do SIGRA
> pra não depender de e-mail."

**Impacto:** um módulo de **comunicação por processo** — timeline com mensagens, anexos e histórico,
dentro da cotação/averbação. Substitui a caixa de entrada como sistema de registro.

Isso conversa com a oportunidade "Anexos no processo" já listada em `docs/10`.

---

## 6. Extrato mensal  ⚠️ regra crítica

> "Extrato mensal (compra o seguro e acresce o valor, não pode ter erro ao enviar o valor original
> sem acréscimo)."

Existe um **acréscimo sobre o valor comprado** que precisa estar no extrato. Enviar o valor original
sem o acréscimo é um erro que custa dinheiro.

> **Hipótese a confirmar:** este acréscimo é o mesmo **"agravo"** que aparece na Planilha Produção do
> legado como "A Pagar Seguradora AGRAVO 25%" — e cujo campo no banco se chama `vlDolarAPagarAgravo20`
> (20%). Se for o mesmo conceito, a tarefa 1 (definir 20% ou 25%) e este item são a mesma pergunta.
> **Vale confirmar diretamente com o cliente.**

O motor de cálculo já tem `insurerSurchargePercent` parametrizado justamente por isso.

## 7. Extrato de comissão

> "Extrato de comissão."

Relatório periódico de comissões por parceiro/vendedor. O legado tem
`PagamentoComissaoSelecao` e `ComissaoEmitidaSelecao` (ver `docs/08-fluxos.md`), e o cálculo de
comissão já está implementado (30% do prêmio, conferido). Falta o **extrato consolidado por período**.

---

## 8. Travas operacionais  ⚠️ regras novas

> "Só pode fazer a averbação quando a carga está atracada."

**Trava dura:** a averbação (provisória/definitiva) só pode ser emitida após a atracação.
Implica registrar a **data de atracação** no processo e bloquear a emissão antes dela.

> "TFA (liberação de avarias) atracações em até 15 dias."
> "Liberações em até 10 dias."

Dois prazos com contagem a partir de eventos:
- **15 dias** — relacionado a atracação / TFA (liberação de avarias).
- **10 dias** — prazo de liberação.

> Não ficou claro na anotação qual evento inicia cada contagem, nem o que acontece ao vencer
> (alerta? bloqueio? multa?). **Precisa de detalhamento.**

Isso conecta com o campo `pendingLimitDate` já implementado e com as **10.279 pendências provisórias**
acumuladas no legado (`docs/10`, item 2) — provavelmente são justamente esses prazos estourando.

---

## Perguntas para a próxima conversa

1. **Taxa por cliente**: varia por modal, mercadoria ou vigência? Vale para os dois lados
   (cliente e seguradora)?
2. **Acréscimo do extrato mensal** é o mesmo "agravo" da Planilha Produção? É 20% ou 25%?
3. **SIGRA**: tem API? Quem mantém? Que dados exatamente precisam vir de lá?
4. **Averbação mensal**: qual o layout do arquivo enviado à seguradora? Varia por seguradora?
5. **Atracação**: de onde vem a data — SIGRA, digitação manual, ou ambos?
6. **Prazos de 15 e 10 dias**: contam a partir de quê? O que acontece ao vencer?
7. **TFA**: é um documento, um processo, ou um tipo de liberação? Como se relaciona com sinistro?
