-- AlterTable
ALTER TABLE "SectionTemplate"
ADD COLUMN "scope" "TemplateScope" NOT NULL DEFAULT 'GLOBAL',
ADD COLUMN "institution_id" TEXT;

-- CreateIndex
CREATE INDEX "SectionTemplate_scope_idx" ON "SectionTemplate"("scope");

-- CreateIndex
CREATE INDEX "SectionTemplate_institution_id_idx" ON "SectionTemplate"("institution_id");

-- AddForeignKey
ALTER TABLE "SectionTemplate" ADD CONSTRAINT "SectionTemplate_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;