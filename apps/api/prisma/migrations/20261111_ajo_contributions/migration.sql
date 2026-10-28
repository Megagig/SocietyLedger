-- Ajo T4: contributions and collections. Allocations (how a payment was split across installments), receipts (one per contribution per
-- moment), a REJECTED status for turned-down transfer reports, and the proof, duplicate and handover fields. Additive only.

-- AlterEnum
ALTER TYPE "AjoContributionStatus" ADD VALUE 'REJECTED';

-- CreateEnum
CREATE TYPE "AjoReceiptMoment" AS ENUM ('RECORDED', 'CONFIRMED', 'REJECTED', 'MISSING', 'REVERSED');

-- CreateEnum
CREATE TYPE "AjoReceiptState" AS ENUM ('SENT', 'QUEUED', 'SKIPPED', 'FAILED');

-- AlterTable
ALTER TABLE "ajo_contributions" ADD COLUMN     "bank_reference" TEXT,
ADD COLUMN     "business_date" DATE,
ADD COLUMN     "confirm_note" TEXT,
ADD COLUMN     "duplicate_ack_by" INTEGER,
ADD COLUMN     "duplicate_ack_note" TEXT,
ADD COLUMN     "duplicate_of_id" INTEGER,
ADD COLUMN     "handover_id" INTEGER,
ADD COLUMN     "missing_from_handover" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paid_on" DATE,
ADD COLUMN     "proof_hash" TEXT,
ADD COLUMN     "rejected_at" TIMESTAMP(3),
ADD COLUMN     "rejected_by" INTEGER,
ADD COLUMN     "self_confirmed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ajo_cash_handovers" ADD COLUMN     "counted_kobo" BIGINT,
ADD COLUMN     "reconcile_note" TEXT,
ADD COLUMN     "target_kobo" BIGINT;

-- CreateTable
CREATE TABLE "ajo_contribution_allocations" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "contribution_id" INTEGER NOT NULL,
    "installment_id" INTEGER NOT NULL,
    "amount_kobo" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajo_contribution_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajo_receipts" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "contribution_id" INTEGER NOT NULL,
    "moment" "AjoReceiptMoment" NOT NULL,
    "state" "AjoReceiptState" NOT NULL DEFAULT 'QUEUED',
    "message" TEXT NOT NULL,
    "channels" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "alerted_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajo_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ajo_contribution_allocations_contribution_id_installment_id_key" ON "ajo_contribution_allocations"("contribution_id", "installment_id");

-- CreateIndex
CREATE INDEX "ajo_contribution_allocations_installment_id_idx" ON "ajo_contribution_allocations"("installment_id");

-- CreateIndex
CREATE INDEX "ajo_contribution_allocations_association_id_idx" ON "ajo_contribution_allocations"("association_id");

-- CreateIndex
CREATE UNIQUE INDEX "ajo_receipts_contribution_id_moment_key" ON "ajo_receipts"("contribution_id", "moment");

-- CreateIndex
CREATE INDEX "ajo_receipts_association_id_state_idx" ON "ajo_receipts"("association_id", "state");

-- CreateIndex
CREATE INDEX "ajo_contributions_association_id_proof_hash_idx" ON "ajo_contributions"("association_id", "proof_hash");

-- CreateIndex
CREATE INDEX "ajo_contributions_association_id_bank_reference_idx" ON "ajo_contributions"("association_id", "bank_reference");

-- CreateIndex
CREATE INDEX "ajo_contributions_handover_id_idx" ON "ajo_contributions"("handover_id");

-- CreateIndex
CREATE INDEX "ajo_contributions_group_id_collector_id_business_date_idx" ON "ajo_contributions"("group_id", "collector_id", "business_date");

-- AddForeignKey
ALTER TABLE "ajo_contributions" ADD CONSTRAINT "ajo_contributions_handover_id_fkey" FOREIGN KEY ("handover_id") REFERENCES "ajo_cash_handovers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajo_contribution_allocations" ADD CONSTRAINT "ajo_contribution_allocations_contribution_id_fkey" FOREIGN KEY ("contribution_id") REFERENCES "ajo_contributions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajo_contribution_allocations" ADD CONSTRAINT "ajo_contribution_allocations_installment_id_fkey" FOREIGN KEY ("installment_id") REFERENCES "ajo_installments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajo_receipts" ADD CONSTRAINT "ajo_receipts_contribution_id_fkey" FOREIGN KEY ("contribution_id") REFERENCES "ajo_contributions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
