-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('OPEN', 'CLOSED', 'SENT');

-- CreateTable
CREATE TABLE "client_rates" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "policyId" TEXT,
    "coverageId" TEXT,
    "commodityTypeId" TEXT,
    "modal" "Modal",
    "kind" "QuoteKind",
    "rateClient" DECIMAL(12,5) NOT NULL DEFAULT 0,
    "rateInsurer" DECIMAL(12,5) NOT NULL DEFAULT 0,
    "minimumPremium" DECIMAL(18,2),
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_references" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "label" TEXT,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "endorsement_batches" (
    "id" TEXT NOT NULL,
    "sequence" SERIAL NOT NULL,
    "period" TEXT NOT NULL,
    "insurerId" TEXT NOT NULL,
    "status" "BatchStatus" NOT NULL DEFAULT 'OPEN',
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "totalInsuredAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalPremiumClient" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalPremiumInsurer" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "closedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "endorsement_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "endorsement_batch_items" (
    "batchId" TEXT NOT NULL,
    "endorsementId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "endorsement_batch_items_pkey" PRIMARY KEY ("batchId","endorsementId")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "client_rates_clientId_active_idx" ON "client_rates"("clientId", "active");

-- CreateIndex
CREATE INDEX "external_references_value_idx" ON "external_references"("value");

-- CreateIndex
CREATE UNIQUE INDEX "external_references_quoteId_source_value_key" ON "external_references"("quoteId", "source", "value");

-- CreateIndex
CREATE INDEX "endorsement_batches_status_idx" ON "endorsement_batches"("status");

-- CreateIndex
CREATE UNIQUE INDEX "endorsement_batches_period_insurerId_key" ON "endorsement_batches"("period", "insurerId");

-- AddForeignKey
ALTER TABLE "client_rates" ADD CONSTRAINT "client_rates_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_rates" ADD CONSTRAINT "client_rates_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_rates" ADD CONSTRAINT "client_rates_coverageId_fkey" FOREIGN KEY ("coverageId") REFERENCES "coverages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_rates" ADD CONSTRAINT "client_rates_commodityTypeId_fkey" FOREIGN KEY ("commodityTypeId") REFERENCES "commodity_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_references" ADD CONSTRAINT "external_references_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "endorsement_batches" ADD CONSTRAINT "endorsement_batches_insurerId_fkey" FOREIGN KEY ("insurerId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "endorsement_batch_items" ADD CONSTRAINT "endorsement_batch_items_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "endorsement_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "endorsement_batch_items" ADD CONSTRAINT "endorsement_batch_items_endorsementId_fkey" FOREIGN KEY ("endorsementId") REFERENCES "endorsements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
