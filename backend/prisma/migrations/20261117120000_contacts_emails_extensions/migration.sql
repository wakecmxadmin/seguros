-- CreateTable
CREATE TABLE "company_contacts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "department" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coverage_emails" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "coverageId" TEXT NOT NULL,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coverage_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "endorsement_extensions" (
    "id" TEXT NOT NULL,
    "endorsementId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "coverageUntil" TIMESTAMP(3),
    "percent" DECIMAL(9,4) NOT NULL,
    "premiumClient" DECIMAL(18,2) NOT NULL,
    "premiumInsurer" DECIMAL(18,2) NOT NULL,
    "exchangeRate" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "premiumClientBrl" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "canceledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "endorsement_extensions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "company_contacts_companyId_idx" ON "company_contacts"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "coverage_emails_email_coverageId_key" ON "coverage_emails"("email", "coverageId");

-- CreateIndex
CREATE INDEX "endorsement_extensions_issuedAt_idx" ON "endorsement_extensions"("issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "endorsement_extensions_endorsementId_sequence_key" ON "endorsement_extensions"("endorsementId", "sequence");

-- AddForeignKey
ALTER TABLE "company_contacts" ADD CONSTRAINT "company_contacts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coverage_emails" ADD CONSTRAINT "coverage_emails_coverageId_fkey" FOREIGN KEY ("coverageId") REFERENCES "coverages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "endorsement_extensions" ADD CONSTRAINT "endorsement_extensions_endorsementId_fkey" FOREIGN KEY ("endorsementId") REFERENCES "endorsements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

