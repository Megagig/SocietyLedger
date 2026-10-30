-- A rotating pot can decide its payout order by a recorded random draw (the default, unchanged) or by the admin placing every share
-- by hand with a written reason. The method is fixed once the circle starts.
DO $$ BEGIN
  CREATE TYPE "AjoOrderMethod" AS ENUM ('RANDOM_DRAW', 'ADMIN_SET');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "AjoOrderEventType" ADD VALUE IF NOT EXISTS 'ADMIN_SET';

ALTER TABLE "ajo_groups" ADD COLUMN IF NOT EXISTS "order_method" "AjoOrderMethod" NOT NULL DEFAULT 'RANDOM_DRAW';
