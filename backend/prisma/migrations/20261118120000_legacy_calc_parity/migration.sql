-- Paridade de cálculo com o legado (tarefas 69–71, docs/19 rodada 2).

-- 1. Novas colunas da cotação.
ALTER TABLE "quotes"
  ADD COLUMN "premiumCharged" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "taxRateClient" DECIMAL(12,5),
  ADD COLUMN "taxRateInsurer" DECIMAL(12,5);

-- Até aqui o prêmio cobrado era sempre o prêmio do cliente. As cotações de
-- exportação passam a ter o valor por incoterm quando forem recalculadas.
UPDATE "quotes" SET "premiumCharged" = "premiumClient";

-- 2. Agravo da exportação: 25 %, não 30 % (324/324 numerários de exportação
--    pagos no legado). Só troca o parâmetro se ainda estiver no padrão antigo.
UPDATE "system_settings" SET "value" = '25'
 WHERE "key" = 'insurance.payable_discount_export_percent'
   AND replace("value", ',', '.') IN ('30', '30.0', '30.00');

-- 3. Cotações de exportação ainda em aberto que congelaram 30 %: passam a 25 %.
--    Averbações já emitidas não são tocadas (documento enviado).
UPDATE "quotes"
   SET "payableDiscountPercent" = 25,
       "insurerPayable" = round("premiumInsurer" * 0.75, 2),
       "payableDiscount" = "premiumInsurer" - round("premiumInsurer" * 0.75, 2)
 WHERE "kind" = 'EXPORT'
   AND "status" = 'QUOTE'
   AND "payableDiscountPercent" = 30;
