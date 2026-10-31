-- Ajo T5: payouts (supplementary payouts, failure, reversal, proof, duplicate-reference key) and SocietyLedger's platform levy.
-- Additive only.

-- AlterEnum
ALTER TYPE "AjoPayoutStatus" ADD VALUE 'REVERSED';

-- CreateEnum
CREATE TYPE "AjoLevyKind" AS ENUM ('CYCLE', 'PARTICIPANT', 'CREDIT');

-- CreateEnum
CREATE TYPE "AjoLevyStatus" AS ENUM ('ACCRUED', 'BILLED', 'PAID', 'WAIVED', 'VOID');

-- AlterTable
ALTER TABLE "ajo_payouts" ADD COLUMN     "approval_note" TEXT,
ADD COLUMN     "confirmed_kobo" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "failed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paid_reference_key" TEXT,
ADD COLUMN     "proof_key" TEXT,
ADD COLUMN     "reverse_reason" TEXT,
ADD COLUMN     "reversed_at" TIMESTAMP(3),
ADD COLUMN     "reversed_by" INTEGER,
ADD COLUMN     "sequence" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "voided_at" TIMESTAMP(3),
ADD COLUMN     "voided_by" INTEGER;

-- CreateTable
CREATE TABLE "ajo_levy_assessments" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "group_id" INTEGER NOT NULL,
    "membership_id" INTEGER,
    "kind" "AjoLevyKind" NOT NULL,
    "status" "AjoLevyStatus" NOT NULL DEFAULT 'ACCRUED',
    "dedupe_key" TEXT NOT NULL,
    "base_kobo" BIGINT NOT NULL,
    "rate_bps" INTEGER NOT NULL,
    "min_kobo" BIGINT NOT NULL,
    "max_kobo" BIGINT NOT NULL,
    "amount_kobo" BIGINT NOT NULL,
    "addon_code" TEXT NOT NULL,
    "calculation" TEXT NOT NULL,
    "billed_payment_id" INTEGER,
    "paid_payment_id" INTEGER,
    "status_reason" TEXT,
    "status_by" INTEGER,
    "status_at" TIMESTAMP(3),
    "accrued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajo_levy_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ajo_levy_assessments_dedupe_key_key" ON "ajo_levy_assessments"("dedupe_key");

-- CreateIndex
CREATE INDEX "ajo_levy_assessments_association_id_status_idx" ON "ajo_levy_assessments"("association_id", "status");

-- CreateIndex
CREATE INDEX "ajo_levy_assessments_group_id_idx" ON "ajo_levy_assessments"("group_id");

-- CreateIndex
CREATE INDEX "ajo_payouts_association_id_paid_reference_key_idx" ON "ajo_payouts"("association_id", "paid_reference_key");
