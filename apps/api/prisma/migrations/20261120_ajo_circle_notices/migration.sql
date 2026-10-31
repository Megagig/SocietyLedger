-- Transparency notifications (spec §16.4.9): what a member of a rotating pot is told about their circle, each switchable off, and a record
-- of what has been sent so nobody is told the same thing twice. The weekly summary is off unless the member opts in.
CREATE TABLE IF NOT EXISTS "ajo_notification_preferences" (
  "id" SERIAL PRIMARY KEY,
  "association_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "round_funded" BOOLEAN NOT NULL DEFAULT true,
  "payout_recorded" BOOLEAN NOT NULL DEFAULT true,
  "your_turn" BOOLEAN NOT NULL DEFAULT true,
  "weekly_summary" BOOLEAN NOT NULL DEFAULT false,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ajo_notification_preferences_association_id_user_id_key" ON "ajo_notification_preferences"("association_id", "user_id");

CREATE TABLE IF NOT EXISTS "ajo_circle_notices" (
  "id" SERIAL PRIMARY KEY,
  "association_id" INTEGER NOT NULL,
  "group_id" INTEGER NOT NULL REFERENCES "ajo_groups"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL,
  "dedupe_key" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ajo_circle_notices_dedupe_key_key" ON "ajo_circle_notices"("dedupe_key");
CREATE INDEX IF NOT EXISTS "ajo_circle_notices_group_id_idx" ON "ajo_circle_notices"("group_id");
