-- Agravo por cliente: substitui o slot fixo "Importação Fresno" do legado.
-- O legado tinha um parâmetro global dedicado a um único cliente (FRESNOMAQ);
-- aqui a exceção mora no cadastro do cliente e serve para qualquer um.
-- NULL significa "usa o agravo do ramo", diferente de 0 ("sem agravo").
--
-- A coluna "fresno" foi criada nesta mesma data e só continha o default false
-- (1 cotação, de teste) — nenhuma informação se perde ao removê-la.

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "payableDiscountPercent" DECIMAL(12,5);

-- AlterTable
ALTER TABLE "quotes" DROP COLUMN "fresno";

