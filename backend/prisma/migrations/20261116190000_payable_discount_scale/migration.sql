-- Agravo: corrige a escala de 0,25 % / 0,30 % para 25 % / 30 %.
-- O cliente informou "0,25" e "0,30", que eram fatores, não percentuais: em 35
-- numerários pagos do legado o valor a pagar com agravo é 75 % do prêmio da
-- seguradora (docs/19-legado-validacoes.md). Migração só de dados.

-- 1. Parâmetros gravados na tela de Parâmetros com a escala antiga.
UPDATE "system_settings" SET "value" = '25'
 WHERE "key" = 'insurance.payable_discount_import_percent' AND replace("value", ',', '.') IN ('0.25', '.25');
UPDATE "system_settings" SET "value" = '30'
 WHERE "key" = 'insurance.payable_discount_export_percent' AND replace("value", ',', '.') IN ('0.3', '0.30', '.3', '.30');

-- 2. Agravo próprio de cliente lançado na escala antiga (ex.: FRESNOMAQ 0,25).
UPDATE "companies" SET "payableDiscountPercent" = "payableDiscountPercent" * 100
 WHERE "payableDiscountPercent" > 0 AND "payableDiscountPercent" < 1;

-- 3. Cotações que congelaram o agravo na escala antiga: recalcula desconto e
--    valor a pagar. Numerários já emitidos não são tocados (documento enviado).
UPDATE "quotes"
   SET "payableDiscountPercent" = "payableDiscountPercent" * 100,
       "payableDiscount" = round("premiumInsurer" * "payableDiscountPercent", 2),
       "insurerPayable" = greatest("premiumInsurer" - round("premiumInsurer" * "payableDiscountPercent", 2), 0)
 WHERE "payableDiscountPercent" > 0 AND "payableDiscountPercent" < 1;
