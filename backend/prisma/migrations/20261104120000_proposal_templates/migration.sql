-- Modelos de Proposta do legado (`#/ModelosPropostaSelecao/Menu`), por
-- combinação Tipo × Cobertura × versão. Ver tarefa 51.
CREATE TABLE "proposal_templates" (
    "id" TEXT NOT NULL,
    "kind" "QuoteKind" NOT NULL,
    "coverageId" TEXT NOT NULL,
    "version" DATE NOT NULL,
    "fileName" TEXT NOT NULL,
    "current" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "storageKey" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposal_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "proposal_templates_kind_coverageId_version_key"
    ON "proposal_templates"("kind", "coverageId", "version");

CREATE INDEX "proposal_templates_kind_coverageId_current_idx"
    ON "proposal_templates"("kind", "coverageId", "current");

ALTER TABLE "proposal_templates" ADD CONSTRAINT "proposal_templates_coverageId_fkey"
    FOREIGN KEY ("coverageId") REFERENCES "coverages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
