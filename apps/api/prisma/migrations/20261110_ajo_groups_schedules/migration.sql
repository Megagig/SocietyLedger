-- Ajo T3: group lifecycle fields, shares and payout slots for the rotating pot, swap requests, an encrypted group bank account, and
-- guarantor consent evidence.
--
-- Nothing wrote to ajo_groups.bank_account_number or ajo_memberships.payout_position before T3 (no code path existed), so replacing
-- them loses nothing. The guard stops the migration rather than destroy data if that is ever not true.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "ajo_groups" WHERE "bank_account_number" IS NOT NULL) THEN
    RAISE EXCEPTION 'ajo_groups has plain bank account numbers; encrypt them before dropping bank_account_number';
  END IF;
  IF EXISTS (SELECT 1 FROM "ajo_memberships" WHERE "payout_position" IS NOT NULL) THEN
    RAISE EXCEPTION 'ajo_memberships has payout positions; move them to ajo_payout_slots before dropping payout_position';
  END IF;
END $$;

-- CreateEnum
CREATE TYPE "AjoRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "ajo_groups" DROP COLUMN "bank_account_number",
ADD COLUMN     "allow_late_join" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "bank_account_enc" TEXT,
ADD COLUMN     "bank_account_last4" TEXT,
ADD COLUMN     "cancel_reason" TEXT,
ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "ends_on" DATE,
ADD COLUMN     "max_shares_per_member" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "started_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ajo_memberships" DROP COLUMN "payout_position",
ADD COLUMN     "shares" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ajo_guarantor_agreements" ADD COLUMN     "evidence" JSONB,
ADD COLUMN     "recorded_by" INTEGER;

-- CreateTable
CREATE TABLE "ajo_payout_slots" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "group_id" INTEGER NOT NULL,
    "membership_id" INTEGER NOT NULL,
    "share_no" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ajo_payout_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajo_order_change_requests" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "group_id" INTEGER NOT NULL,
    "slot_a_id" INTEGER NOT NULL,
    "slot_b_id" INTEGER NOT NULL,
    "reason" TEXT,
    "status" "AjoRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requested_by" INTEGER NOT NULL,
    "decided_by" INTEGER,
    "decided_at" TIMESTAMP(3),
    "decision_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajo_order_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ajo_payout_slots_group_id_membership_id_share_no_key" ON "ajo_payout_slots"("group_id", "membership_id", "share_no");

-- CreateIndex
CREATE UNIQUE INDEX "ajo_payout_slots_group_id_position_key" ON "ajo_payout_slots"("group_id", "position");

-- CreateIndex
CREATE INDEX "ajo_payout_slots_association_id_group_id_idx" ON "ajo_payout_slots"("association_id", "group_id");

-- CreateIndex
CREATE INDEX "ajo_order_change_requests_association_id_group_id_status_idx" ON "ajo_order_change_requests"("association_id", "group_id", "status");

-- AddForeignKey
ALTER TABLE "ajo_payout_slots" ADD CONSTRAINT "ajo_payout_slots_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "ajo_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajo_payout_slots" ADD CONSTRAINT "ajo_payout_slots_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "ajo_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajo_order_change_requests" ADD CONSTRAINT "ajo_order_change_requests_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "ajo_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
