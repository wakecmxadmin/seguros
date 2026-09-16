-- CreateEnum
CREATE TYPE "Modal" AS ENUM ('AIR', 'SEA', 'ROAD', 'RAIL');

-- CreateEnum
CREATE TYPE "CompanyRoleType" AS ENUM ('CLIENT', 'PARTNER', 'INSURER', 'CARRIER', 'SURVEYOR');

-- CreateEnum
CREATE TYPE "QuoteKind" AS ENUM ('IMPORT', 'EXPORT');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('QUOTE', 'PROVISIONAL', 'FINAL');

-- CreateEnum
CREATE TYPE "QuotePosition" AS ENUM ('OPEN_PROPOSAL', 'APPROVED', 'REJECTED', 'PENDING', 'FOLLOW_UP', 'CANCELED');

-- CreateEnum
CREATE TYPE "Incoterm" AS ENUM ('EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DAT', 'DDU', 'DDP', 'CI');

-- CreateEnum
CREATE TYPE "CargoCondition" AS ENUM ('NEW', 'USED');

-- CreateEnum
CREATE TYPE "BudgetMode" AS ENUM ('RATES', 'VALUES');

-- CreateEnum
CREATE TYPE "BillingVia" AS ENUM ('BROKER', 'PARTNER');

-- CreateEnum
CREATE TYPE "DeclaredValue" AS ENUM ('DECLARED', 'AIR_NO_DECLARED_INCLUDED', 'NOT_DECLARED', 'NA');

-- CreateEnum
CREATE TYPE "RateLineItem" AS ENUM ('COST', 'FREIGHT', 'EXPENSES', 'EXPECTED_PROFIT', 'TAXES', 'CIF_VALUE');

-- CreateTable
CREATE TABLE "countries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "iso2" TEXT,
    "iso3" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "states" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "countryId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stateId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ports" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "modal" "Modal" NOT NULL,
    "countryId" TEXT NOT NULL,
    "cityId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currencies" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packagings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packagings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vessels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imo" TEXT,
    "buildYear" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vessels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commodity_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seaRoadRate" DECIMAL(12,5) NOT NULL DEFAULT 0,
    "airRate" DECIMAL(12,5) NOT NULL DEFAULT 0,
    "deductible" DECIMAL(12,5) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commodity_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT,
    "document" TEXT,
    "stateReg" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "zipCode" TEXT,
    "address" TEXT,
    "number" TEXT,
    "district" TEXT,
    "cityName" TEXT,
    "stateName" TEXT,
    "countryName" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_roles" (
    "companyId" TEXT NOT NULL,
    "role" "CompanyRoleType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_roles_pkey" PRIMARY KEY ("companyId","role")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "department" TEXT,
    "jobTitle" TEXT,
    "isSalesperson" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policies" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "description" TEXT,
    "kind" "QuoteKind" NOT NULL,
    "insurerId" TEXT NOT NULL,
    "insuredLimit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "brokerCode" TEXT,
    "baseRateClient" DECIMAL(12,5) NOT NULL DEFAULT 0,
    "baseRateInsurer" DECIMAL(12,5) NOT NULL DEFAULT 0,
    "minimumPremium" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "minimumPremiumCurrencyId" TEXT,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coverages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "accessory" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "seaRateInsurer" DECIMAL(12,5) NOT NULL DEFAULT 0,
    "seaRateClient" DECIMAL(12,5) NOT NULL DEFAULT 0,
    "airRateInsurer" DECIMAL(12,5) NOT NULL DEFAULT 0,
    "airRateClient" DECIMAL(12,5) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coverages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_coverages" (
    "policyId" TEXT NOT NULL,
    "coverageId" TEXT NOT NULL,
    "rateClient" DECIMAL(12,5),
    "rateInsurer" DECIMAL(12,5),

    CONSTRAINT "policy_coverages_pkey" PRIMARY KEY ("policyId","coverageId")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "currencyId" TEXT NOT NULL,
    "rate" DECIMAL(18,6) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "kind" "QuoteKind" NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'QUOTE',
    "position" "QuotePosition" NOT NULL DEFAULT 'OPEN_PROPOSAL',
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pendingLimitDate" TIMESTAMP(3),
    "policyId" TEXT,
    "insurerId" TEXT,
    "clientId" TEXT NOT NULL,
    "partnerId" TEXT,
    "singleProvisional" BOOLEAN NOT NULL DEFAULT false,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "modal" "Modal" NOT NULL,
    "originCountryId" TEXT,
    "originStateName" TEXT,
    "originCityName" TEXT,
    "originPortId" TEXT,
    "departureForecast" TIMESTAMP(3),
    "destinationCountryId" TEXT,
    "destinationStateName" TEXT,
    "destinationCityName" TEXT,
    "destinationPortId" TEXT,
    "commodityDescription" TEXT,
    "notes" TEXT,
    "internalNotes" TEXT,
    "cargoCondition" "CargoCondition" NOT NULL DEFAULT 'NEW',
    "ncm" TEXT,
    "brand" TEXT,
    "weightKg" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "invoiceNumber" TEXT,
    "commodityTypeId" TEXT,
    "coverageId" TEXT,
    "packagingId" TEXT,
    "incoterm" "Incoterm" NOT NULL DEFAULT 'CFR',
    "currencyId" TEXT NOT NULL,
    "overPercent" DECIMAL(12,5) NOT NULL DEFAULT 0,
    "reference" TEXT,
    "billingVia" "BillingVia" NOT NULL DEFAULT 'BROKER',
    "budgetMode" "BudgetMode" NOT NULL DEFAULT 'RATES',
    "declaredValue" "DeclaredValue" NOT NULL DEFAULT 'DECLARED',
    "clientDiscount" DECIMAL(12,5) NOT NULL DEFAULT 0,
    "insurerDiscount" DECIMAL(12,5) NOT NULL DEFAULT 0,
    "expensePercent" DECIMAL(12,5) NOT NULL DEFAULT 10,
    "profitPercent" DECIMAL(12,5) NOT NULL DEFAULT 10,
    "standardDiscount" DECIMAL(12,5) NOT NULL DEFAULT 0,
    "letterAdditionalPercent" DECIMAL(12,5) NOT NULL DEFAULT 10,
    "vesselAdditionalPercent" DECIMAL(12,5) NOT NULL DEFAULT 0,
    "irbValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "irbCurrencyId" TEXT,
    "salespersonId" TEXT,
    "partnerPercent" DECIMAL(12,5) NOT NULL DEFAULT 30,
    "brokerPercent" DECIMAL(12,5) NOT NULL DEFAULT 0,
    "salespersonPercent" DECIMAL(12,5) NOT NULL DEFAULT 0,
    "warStrike" BOOLEAN NOT NULL DEFAULT false,
    "machineryStoppage" BOOLEAN NOT NULL DEFAULT false,
    "expensesCovered" BOOLEAN NOT NULL DEFAULT false,
    "expectedProfitCovered" BOOLEAN NOT NULL DEFAULT false,
    "minimumPremiumApplied" BOOLEAN NOT NULL DEFAULT false,
    "transshipment" BOOLEAN NOT NULL DEFAULT false,
    "creditLetter" BOOLEAN NOT NULL DEFAULT false,
    "taxImportDuty" BOOLEAN NOT NULL DEFAULT false,
    "taxIpi" BOOLEAN NOT NULL DEFAULT false,
    "taxIcms" BOOLEAN NOT NULL DEFAULT false,
    "taxPis" BOOLEAN NOT NULL DEFAULT false,
    "taxCofins" BOOLEAN NOT NULL DEFAULT false,
    "insuredAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "premiumClient" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "premiumInsurer" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "exchangeRate" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "insuredAmountBrl" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "premiumClientBrl" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "premiumInsurerBrl" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "calculatedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_rate_lines" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "item" "RateLineItem" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "baseRateClient" DECIMAL(12,5) NOT NULL DEFAULT 0,
    "extraRateClient" DECIMAL(12,5) NOT NULL DEFAULT 0,
    "warRateClient" DECIMAL(12,5) NOT NULL DEFAULT 0,
    "premiumClient" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "baseRateInsurer" DECIMAL(12,5) NOT NULL DEFAULT 0,
    "extraRateInsurer" DECIMAL(12,5) NOT NULL DEFAULT 0,
    "warRateInsurer" DECIMAL(12,5) NOT NULL DEFAULT 0,
    "premiumInsurer" DECIMAL(18,2) NOT NULL DEFAULT 0,

    CONSTRAINT "quote_rate_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "countries_iso2_key" ON "countries"("iso2");

-- CreateIndex
CREATE UNIQUE INDEX "countries_iso3_key" ON "countries"("iso3");

-- CreateIndex
CREATE INDEX "countries_name_idx" ON "countries"("name");

-- CreateIndex
CREATE INDEX "states_countryId_idx" ON "states"("countryId");

-- CreateIndex
CREATE UNIQUE INDEX "states_countryId_name_key" ON "states"("countryId", "name");

-- CreateIndex
CREATE INDEX "cities_stateId_idx" ON "cities"("stateId");

-- CreateIndex
CREATE UNIQUE INDEX "cities_stateId_name_key" ON "cities"("stateId", "name");

-- CreateIndex
CREATE INDEX "ports_countryId_modal_idx" ON "ports"("countryId", "modal");

-- CreateIndex
CREATE INDEX "ports_name_idx" ON "ports"("name");

-- CreateIndex
CREATE UNIQUE INDEX "currencies_code_key" ON "currencies"("code");

-- CreateIndex
CREATE UNIQUE INDEX "packagings_name_key" ON "packagings"("name");

-- CreateIndex
CREATE INDEX "vessels_name_idx" ON "vessels"("name");

-- CreateIndex
CREATE UNIQUE INDEX "commodity_types_code_key" ON "commodity_types"("code");

-- CreateIndex
CREATE INDEX "commodity_types_name_idx" ON "commodity_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "companies_document_key" ON "companies"("document");

-- CreateIndex
CREATE INDEX "companies_legalName_idx" ON "companies"("legalName");

-- CreateIndex
CREATE INDEX "companies_document_idx" ON "companies"("document");

-- CreateIndex
CREATE INDEX "company_roles_role_idx" ON "company_roles"("role");

-- CreateIndex
CREATE UNIQUE INDEX "employees_userId_key" ON "employees"("userId");

-- CreateIndex
CREATE INDEX "employees_name_idx" ON "employees"("name");

-- CreateIndex
CREATE INDEX "policies_kind_active_idx" ON "policies"("kind", "active");

-- CreateIndex
CREATE UNIQUE INDEX "policies_number_insurerId_key" ON "policies"("number", "insurerId");

-- CreateIndex
CREATE UNIQUE INDEX "coverages_name_key" ON "coverages"("name");

-- CreateIndex
CREATE INDEX "exchange_rates_currencyId_date_idx" ON "exchange_rates"("currencyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_date_currencyId_key" ON "exchange_rates"("date", "currencyId");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_number_key" ON "quotes"("number");

-- CreateIndex
CREATE INDEX "quotes_status_position_idx" ON "quotes"("status", "position");

-- CreateIndex
CREATE INDEX "quotes_kind_issueDate_idx" ON "quotes"("kind", "issueDate");

-- CreateIndex
CREATE INDEX "quotes_clientId_idx" ON "quotes"("clientId");

-- CreateIndex
CREATE INDEX "quotes_partnerId_idx" ON "quotes"("partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "quote_rate_lines_quoteId_item_key" ON "quote_rate_lines"("quoteId", "item");

-- AddForeignKey
ALTER TABLE "states" ADD CONSTRAINT "states_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ports" ADD CONSTRAINT "ports_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ports" ADD CONSTRAINT "ports_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_roles" ADD CONSTRAINT "company_roles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_insurerId_fkey" FOREIGN KEY ("insurerId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_coverages" ADD CONSTRAINT "policy_coverages_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_coverages" ADD CONSTRAINT "policy_coverages_coverageId_fkey" FOREIGN KEY ("coverageId") REFERENCES "coverages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_insurerId_fkey" FOREIGN KEY ("insurerId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_originCountryId_fkey" FOREIGN KEY ("originCountryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_originPortId_fkey" FOREIGN KEY ("originPortId") REFERENCES "ports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_destinationCountryId_fkey" FOREIGN KEY ("destinationCountryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_destinationPortId_fkey" FOREIGN KEY ("destinationPortId") REFERENCES "ports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_commodityTypeId_fkey" FOREIGN KEY ("commodityTypeId") REFERENCES "commodity_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_coverageId_fkey" FOREIGN KEY ("coverageId") REFERENCES "coverages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_packagingId_fkey" FOREIGN KEY ("packagingId") REFERENCES "packagings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_rate_lines" ADD CONSTRAINT "quote_rate_lines_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
