-- AlterTable
ALTER TABLE "websites" ADD COLUMN "source_template_id" TEXT;

-- CreateIndex
CREATE INDEX "websites_source_template_id_idx" ON "websites"("source_template_id");

-- AddForeignKey
ALTER TABLE "websites" ADD CONSTRAINT "websites_source_template_id_fkey" FOREIGN KEY ("source_template_id") REFERENCES "WebsiteTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;