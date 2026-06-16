-- CreateEnum
CREATE TYPE "TemplateScope" AS ENUM ('GLOBAL', 'INSTITUTION');

-- AlterTable
ALTER TABLE "WebsiteTemplate"
ADD COLUMN "scope" "TemplateScope" NOT NULL DEFAULT 'GLOBAL',
ADD COLUMN "institution_id" TEXT;

-- CreateIndex
CREATE INDEX "WebsiteTemplate_scope_idx" ON "WebsiteTemplate"("scope");

-- CreateIndex
CREATE INDEX "WebsiteTemplate_institution_id_idx" ON "WebsiteTemplate"("institution_id");

-- AddForeignKey
ALTER TABLE "WebsiteTemplate" ADD CONSTRAINT "WebsiteTemplate_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;