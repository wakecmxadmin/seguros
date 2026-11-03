-- AlterTable
ALTER TABLE "company_roles" ADD COLUMN     "legacyCode" TEXT;

-- AlterTable
ALTER TABLE "coverages" ADD COLUMN     "legacyCode" TEXT;

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "legacyCode" TEXT;

-- AlterTable
ALTER TABLE "policies" ADD COLUMN     "legacyCode" TEXT;

-- AlterTable
ALTER TABLE "vessels" ADD COLUMN     "legacyCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "company_roles_role_legacyCode_key" ON "company_roles"("role", "legacyCode");

-- CreateIndex
CREATE UNIQUE INDEX "coverages_legacyCode_key" ON "coverages"("legacyCode");

-- CreateIndex
CREATE UNIQUE INDEX "employees_legacyCode_key" ON "employees"("legacyCode");

-- CreateIndex
CREATE UNIQUE INDEX "policies_legacyCode_key" ON "policies"("legacyCode");

-- CreateIndex
CREATE UNIQUE INDEX "vessels_legacyCode_key" ON "vessels"("legacyCode");

