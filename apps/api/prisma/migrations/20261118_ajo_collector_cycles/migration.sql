-- Collector-thrift cycles (spec §16.5). Each saver chooses their own amount for a cycle, and at the end withdraws or continues.
-- Existing groups become one cycle (cycle 1) in which every saver's amount is the group's current amount, so no schedule changes.
DO $$ BEGIN
  CREATE TYPE "AjoCycleChoice" AS ENUM ('PENDING', 'WITHDRAW', 'CONTINUE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "ajo_groups" ADD COLUMN IF NOT EXISTS "cycle_no" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ajo_groups" ADD COLUMN IF NOT EXISTS "cycle_starts_on" DATE;
ALTER TABLE "ajo_installments" ADD COLUMN IF NOT EXISTS "cycle_no" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ajo_payouts" ADD COLUMN IF NOT EXISTS "cycle_no" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS "ajo_membership_cycles" (
  "id" SERIAL PRIMARY KEY,
  "association_id" INTEGER NOT NULL,
  "group_id" INTEGER NOT NULL REFERENCES "ajo_groups"("id") ON DELETE CASCADE,
  "membership_id" INTEGER NOT NULL REFERENCES "ajo_memberships"("id") ON DELETE CASCADE,
  "cycle_no" INTEGER NOT NULL,
  "amount_kobo" BIGINT NOT NULL,
  "carried_kobo" BIGINT NOT NULL DEFAULT 0,
  "choice" "AjoCycleChoice" NOT NULL DEFAULT 'PENDING',
  "choice_at" TIMESTAMP(3),
  "choice_by" INTEGER,
  "choice_via" TEXT,
  "next_amount_kobo" BIGINT,
  "prompted_at" TIMESTAMP(3),
  "fee_settled_kobo" BIGINT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ajo_membership_cycles_amount_check" CHECK ("amount_kobo" > 0 AND "carried_kobo" >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS "ajo_membership_cycles_membership_id_cycle_no_key" ON "ajo_membership_cycles"("membership_id", "cycle_no");
CREATE INDEX IF NOT EXISTS "ajo_membership_cycles_group_id_cycle_no_idx" ON "ajo_membership_cycles"("group_id", "cycle_no");
CREATE INDEX IF NOT EXISTS "ajo_membership_cycles_association_id_idx" ON "ajo_membership_cycles"("association_id");

-- Every saver already in a collector-thrift group is in cycle 1 at the group's amount.
INSERT INTO "ajo_membership_cycles" ("association_id", "group_id", "membership_id", "cycle_no", "amount_kobo")
SELECT m."association_id", m."group_id", m."id", 1, g."contribution_kobo"
FROM "ajo_memberships" m
JOIN "ajo_groups" g ON g."id" = m."group_id"
WHERE g."model" = 'COLLECTOR_THRIFT'
ON CONFLICT ("membership_id", "cycle_no") DO NOTHING;
