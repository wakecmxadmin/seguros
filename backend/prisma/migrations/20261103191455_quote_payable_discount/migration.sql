/*
  Warnings:

  - You are about to drop the column `surchargeAmount` on the `cash_requests` table. All the data in the column will be lost.
  - You are about to drop the column `surchargePercent` on the `cash_requests` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "cash_requests" DROP COLUMN "surchargeAmount",
DROP COLUMN "surchargePercent",
ADD COLUMN     "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "discountPercent" DECIMAL(12,5) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "fresno" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "insurerPayable" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "payableDiscount" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "payableDiscountPercent" DECIMAL(12,5) NOT NULL DEFAULT 0;
