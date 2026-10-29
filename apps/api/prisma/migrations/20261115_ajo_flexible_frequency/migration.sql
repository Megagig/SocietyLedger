-- Contribution cadence: besides daily, weekly and monthly, a group can pay quarterly, annually, or on its own step (every N days,
-- weeks or months, which covers bi-weekly, every two months and so on). Existing groups keep their frequency and need no step.
ALTER TYPE "AjoFrequency" ADD VALUE IF NOT EXISTS 'QUARTERLY';
ALTER TYPE "AjoFrequency" ADD VALUE IF NOT EXISTS 'ANNUALLY';
ALTER TYPE "AjoFrequency" ADD VALUE IF NOT EXISTS 'CUSTOM';

DO $$ BEGIN
  CREATE TYPE "AjoIntervalUnit" AS ENUM ('DAYS', 'WEEKS', 'MONTHS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "ajo_groups" ADD COLUMN IF NOT EXISTS "interval_count" INTEGER;
ALTER TABLE "ajo_groups" ADD COLUMN IF NOT EXISTS "interval_unit" "AjoIntervalUnit";

-- A custom schedule always has both parts; every other frequency has neither.
ALTER TABLE "ajo_groups" DROP CONSTRAINT IF EXISTS "ajo_groups_interval_check";
ALTER TABLE "ajo_groups" ADD CONSTRAINT "ajo_groups_interval_check" CHECK (
  ("interval_count" IS NULL AND "interval_unit" IS NULL)
  OR ("interval_count" BETWEEN 1 AND 60 AND "interval_unit" IS NOT NULL)
);
