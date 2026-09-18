-- DropIndex
DROP INDEX "exchange_rates_date_currencyId_key";

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_date_currencyId_source_key" ON "exchange_rates"("date", "currencyId", "source");

