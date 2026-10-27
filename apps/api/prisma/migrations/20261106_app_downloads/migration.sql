-- Website APK download: releases (link pasted by the admin), leads (one per email) and a log of every hand-out.
CREATE TABLE "app_releases" (
  "id" SERIAL PRIMARY KEY,
  "version" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "notes" TEXT,
  "is_current" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "app_releases_is_current_is_active_idx" ON "app_releases"("is_current", "is_active");
-- At most one current release, enforced by the database.
CREATE UNIQUE INDEX "app_releases_one_current_idx" ON "app_releases"("is_current") WHERE "is_current" = true;

CREATE TABLE "download_leads" (
  "id" SERIAL PRIMARY KEY,
  "first_name" TEXT NOT NULL,
  "last_name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "consent" BOOLEAN NOT NULL DEFAULT false,
  "consented_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "download_leads_email_key" ON "download_leads"("email");
CREATE INDEX "download_leads_created_at_idx" ON "download_leads"("created_at");

CREATE TABLE "download_events" (
  "id" SERIAL PRIMARY KEY,
  "lead_id" INTEGER NOT NULL REFERENCES "download_leads"("id") ON DELETE CASCADE,
  "release_id" INTEGER NOT NULL REFERENCES "app_releases"("id"),
  "device" TEXT NOT NULL DEFAULT 'other',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "download_events_created_at_idx" ON "download_events"("created_at");
CREATE INDEX "download_events_release_id_created_at_idx" ON "download_events"("release_id", "created_at");
CREATE INDEX "download_events_lead_id_idx" ON "download_events"("lead_id");
