-- CreateIndex
CREATE INDEX "deployments_website_id_status_idx" ON "deployments"("website_id", "status");

-- CreateIndex
CREATE INDEX "domains_website_id_status_idx" ON "domains"("website_id", "status");

-- CreateIndex
CREATE INDEX "websites_institution_id_status_idx" ON "websites"("institution_id", "status");

-- CreateIndex
CREATE INDEX "websites_owner_id_status_idx" ON "websites"("owner_id", "status");
