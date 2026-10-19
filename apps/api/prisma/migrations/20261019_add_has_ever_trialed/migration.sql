-- G79: track whether an association has ever started a trial so duplicate
-- free-trial requests can be blocked even after a subscription expires/cancels.
ALTER TABLE "associations"
  ADD COLUMN IF NOT EXISTS "has_ever_trialed" BOOLEAN NOT NULL DEFAULT false;
