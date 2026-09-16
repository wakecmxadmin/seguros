-- CreateEnum
CREATE TYPE "EndorsementType" AS ENUM ('PROVISIONAL', 'FINAL');

-- CreateEnum
CREATE TYPE "EndorsementPosition" AS ENUM ('PENDING', 'FOLLOW_UP', 'SETTLED', 'CANCELED');

-- CreateEnum
CREATE TYPE "CashRequestStatus" AS ENUM ('PENDING_SEND', 'SENT', 'RECEIVED', 'CANCELED');

-- CreateEnum
CREATE TYPE "CommissionBeneficiary" AS ENUM ('PARTNER', 'BROKER', 'SALESPERSON');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'INVOICE_REQUESTED', 'PAID', 'CANCELED');

-- CreateTable
CREATE TABLE "endorsements" (
    "id" TEXT NOT NULL,
    "sequence" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "type" "EndorsementType" NOT NULL,
    "position" "EndorsementPosition" NOT NULL DEFAULT 'PENDING',
    "quoteId" TEXT NOT NULL,
    "parentId" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "berthingDate" TIMESTAMP(3),
    "blNumber" TEXT,
    "containerNumber" TEXT,
    "vesselId" TEXT,
    "currencyId" TEXT NOT NULL,
    "insuredAmount" DECIMAL(18,2) NOT NULL,
    "premiumClient" DECIMAL(18,2) NOT NULL,
    "premiumInsurer" DECIMAL(18,2) NOT NULL,
    "exchangeRate" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "insuredAmountBrl" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "premiumClientBrl" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "balancePercent" DECIMAL(9,2) NOT NULL DEFAULT 100,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "endorsements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "endorsement_position_logs" (
    "id" TEXT NOT NULL,
    "endorsementId" TEXT NOT NULL,
    "from" "EndorsementPosition",
    "to" "EndorsementPosition" NOT NULL,
    "reason" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "endorsement_position_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_requests" (
    "id" TEXT NOT NULL,
    "sequence" SERIAL NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "endorsementId" TEXT NOT NULL,
    "status" "CashRequestStatus" NOT NULL DEFAULT 'PENDING_SEND',
    "currencyId" TEXT NOT NULL,
    "premiumInsurer" DECIMAL(18,2) NOT NULL,
    "surchargePercent" DECIMAL(12,5) NOT NULL DEFAULT 0,
    "surchargeAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(18,2) NOT NULL,
    "exchangeRate" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "amountBrl" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "chargeDate" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "paymentDate" TIMESTAMP(3),
    "receivedAmountBrl" DECIMAL(18,2),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commissions" (
    "id" TEXT NOT NULL,
    "sequence" SERIAL NOT NULL,
    "endorsementId" TEXT NOT NULL,
    "beneficiary" "CommissionBeneficiary" NOT NULL,
    "companyId" TEXT,
    "employeeId" TEXT,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "currencyId" TEXT NOT NULL,
    "premiumBase" DECIMAL(18,2) NOT NULL,
    "percent" DECIMAL(12,5) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "exchangeRate" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "amountBrl" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "invoiceNumber" TEXT,
    "invoiceRequestedAt" TIMESTAMP(3),
    "paymentDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "endorsements_number_key" ON "endorsements"("number");

-- CreateIndex
CREATE INDEX "endorsements_type_position_idx" ON "endorsements"("type", "position");

-- CreateIndex
CREATE INDEX "endorsements_quoteId_idx" ON "endorsements"("quoteId");

-- CreateIndex
CREATE INDEX "endorsements_issuedAt_idx" ON "endorsements"("issuedAt");

-- CreateIndex
CREATE INDEX "endorsement_position_logs_endorsementId_idx" ON "endorsement_position_logs"("endorsementId");

-- CreateIndex
CREATE INDEX "cash_requests_status_idx" ON "cash_requests"("status");

-- CreateIndex
CREATE INDEX "cash_requests_endorsementId_idx" ON "cash_requests"("endorsementId");

-- CreateIndex
CREATE INDEX "commissions_status_beneficiary_idx" ON "commissions"("status", "beneficiary");

-- CreateIndex
CREATE INDEX "commissions_endorsementId_idx" ON "commissions"("endorsementId");

-- CreateIndex
CREATE INDEX "commissions_companyId_idx" ON "commissions"("companyId");

-- AddForeignKey
ALTER TABLE "endorsements" ADD CONSTRAINT "endorsements_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "endorsements" ADD CONSTRAINT "endorsements_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "endorsements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "endorsements" ADD CONSTRAINT "endorsements_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "vessels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "endorsements" ADD CONSTRAINT "endorsements_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "endorsement_position_logs" ADD CONSTRAINT "endorsement_position_logs_endorsementId_fkey" FOREIGN KEY ("endorsementId") REFERENCES "endorsements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_requests" ADD CONSTRAINT "cash_requests_endorsementId_fkey" FOREIGN KEY ("endorsementId") REFERENCES "endorsements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_requests" ADD CONSTRAINT "cash_requests_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_endorsementId_fkey" FOREIGN KEY ("endorsementId") REFERENCES "endorsements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
