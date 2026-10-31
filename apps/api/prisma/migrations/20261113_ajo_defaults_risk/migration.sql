-- Ajo T6: defaults and risk. Late fees you can pay (through the normal payment flow, after instalments), disputes about one instalment,
-- default cases with frozen evidence and repayment plans, reminders that can only be sent once, and a case file of dated notes.
-- Additive only (one NOT NULL is relaxed on a table that only holds T4 allocations).

-- AlterEnum
ALTER TYPE "AjoLateFeeStatus" ADD VALUE 'PAID';

-- AlterEnum
ALTER TYPE "AjoRepaymentPlanStatus" ADD VALUE 'PROPOSED';

-- CreateEnum
CREATE TYPE "AjoReminderKind" AS ENUM ('UPCOMING', 'OVERDUE', 'GRACE_ENDING', 'DIGEST');

-- CreateEnum
CREATE TYPE "AjoReminderState" AS ENUM ('SENT', 'SKIPPED', 'FAILED');

-- AlterTable
ALTER TABLE "ajo_late_fee_assessments" ADD COLUMN     "membership_id" INTEGER,
ADD COLUMN     "notified_at" TIMESTAMP(3),
ADD COLUMN     "notified_note" TEXT,
ADD COLUMN     "paid_kobo" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "payable_at" TIMESTAMP(3),
ADD COLUMN     "waived_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ajo_contribution_allocations" ALTER COLUMN "installment_id" DROP NOT NULL,
ADD COLUMN     "late_fee_id" INTEGER;

-- A payment part pays an instalment or a late fee, never both and never neither.
ALTER TABLE "ajo_contribution_allocations" ADD CONSTRAINT "ajo_contribution_allocations_one_target" CHECK (("installment_id" IS NOT NULL) <> ("late_fee_id" IS NOT NULL));

-- AlterTable
ALTER TABLE "ajo_disputes" ADD COLUMN     "installment_id" INTEGER,
ADD COLUMN     "raised_by" INTEGER;

-- AlterTable
ALTER TABLE "ajo_default_cases" ADD COLUMN     "closed_by" INTEGER,
ADD COLUMN     "procedure" TEXT,
ADD COLUMN     "snapshot" JSONB;

-- AlterTable
ALTER TABLE "ajo_repayment_plans" ADD COLUMN     "agreed_at" TIMESTAMP(3),
ADD COLUMN     "agreed_note" TEXT,
ADD COLUMN     "agreed_via" TEXT,
ADD COLUMN     "cancel_reason" TEXT,
ADD COLUMN     "covers" JSONB,
ADD COLUMN     "outstanding_kobo" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "proposed_by" INTEGER;

-- CreateTable
CREATE TABLE "ajo_reminders" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "membership_id" INTEGER,
    "installment_id" INTEGER,
    "kind" "AjoReminderKind" NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "state" "AjoReminderState" NOT NULL DEFAULT 'SENT',
    "message" TEXT,
    "channels" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajo_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajo_case_events" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "case_id" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "note" TEXT,
    "actor_user_id" INTEGER,
    "dedupe_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajo_case_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ajo_reminders_dedupe_key_key" ON "ajo_reminders"("dedupe_key");

-- CreateIndex
CREATE INDEX "ajo_reminders_association_id_created_at_idx" ON "ajo_reminders"("association_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ajo_case_events_dedupe_key_key" ON "ajo_case_events"("dedupe_key");

-- CreateIndex
CREATE INDEX "ajo_case_events_case_id_created_at_idx" ON "ajo_case_events"("case_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ajo_contribution_allocations_contribution_id_late_fee_id_key" ON "ajo_contribution_allocations"("contribution_id", "late_fee_id");

-- CreateIndex
CREATE INDEX "ajo_contribution_allocations_late_fee_id_idx" ON "ajo_contribution_allocations"("late_fee_id");

-- AddForeignKey
ALTER TABLE "ajo_contribution_allocations" ADD CONSTRAINT "ajo_contribution_allocations_late_fee_id_fkey" FOREIGN KEY ("late_fee_id") REFERENCES "ajo_late_fee_assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajo_case_events" ADD CONSTRAINT "ajo_case_events_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "ajo_default_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
