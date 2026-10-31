-- Thrift (Ajo) add-on foundation (T1.1). Additive only: new enums and ajo_* tables, plus associations.kind and addons.family
-- (both nullable or defaulted). No existing table is altered destructively.

-- CreateEnum
CREATE TYPE "AssociationKind" AS ENUM ('ASSOCIATION', 'THRIFT_GROUP');

-- CreateEnum
CREATE TYPE "AjoModel" AS ENUM ('COLLECTOR_THRIFT', 'ROTATING_POT');

-- CreateEnum
CREATE TYPE "AjoFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "AjoGroupStatus" AS ENUM ('DRAFT', 'OPEN', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AjoFeeType" AS ENUM ('NONE', 'FIXED', 'PERCENT', 'DAYS');

-- CreateEnum
CREATE TYPE "AjoMembershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'LEFT', 'DEFAULTED');

-- CreateEnum
CREATE TYPE "AjoInstallmentStatus" AS ENUM ('DUE', 'PARTIAL', 'PAID', 'OVERDUE', 'WAIVED');

-- CreateEnum
CREATE TYPE "AjoContributionMethod" AS ENUM ('CASH', 'TRANSFER');

-- CreateEnum
CREATE TYPE "AjoContributionStatus" AS ENUM ('REPORTED', 'CASH_RECEIVED', 'CONFIRMED', 'REVERSED');

-- CreateEnum
CREATE TYPE "AjoPayoutStatus" AS ENUM ('PREPARED', 'APPROVED', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "AjoLedgerEntryType" AS ENUM ('CONTRIBUTION', 'REVERSAL', 'FEE', 'PAYOUT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "AjoLedgerDirection" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "AjoVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AjoLateFeeStatus" AS ENUM ('PENDING', 'PAYABLE', 'WAIVED');

-- CreateEnum
CREATE TYPE "AjoTrustBand" AS ENUM ('EXCELLENT', 'GOOD', 'FAIR', 'AT_RISK', 'NO_HISTORY');

-- CreateEnum
CREATE TYPE "AjoOrderEventType" AS ENUM ('DRAW', 'SWAP', 'EXCEPTION');

-- CreateEnum
CREATE TYPE "AjoDisputeStatus" AS ENUM ('OPEN', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AjoDefaultCaseStatus" AS ENUM ('OPEN', 'PLAN_AGREED', 'RESOLVED', 'CLOSED_UNRESOLVED');

-- CreateEnum
CREATE TYPE "AjoRepaymentPlanStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');



-- AlterTable
ALTER TABLE "addons" ADD COLUMN     "family" TEXT;

-- AlterTable
ALTER TABLE "associations" ADD COLUMN     "kind" "AssociationKind" NOT NULL DEFAULT 'ASSOCIATION';

-- CreateTable
CREATE TABLE "ajo_groups" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "model" "AjoModel" NOT NULL,
    "frequency" "AjoFrequency" NOT NULL,
    "contribution_kobo" BIGINT NOT NULL,
    "start_date" DATE NOT NULL,
    "cycle_length" INTEGER,
    "rounds" INTEGER,
    "max_participants" INTEGER NOT NULL,
    "collector_fee_type" "AjoFeeType" NOT NULL DEFAULT 'NONE',
    "collector_fee_value" BIGINT NOT NULL DEFAULT 0,
    "bank_name" TEXT,
    "bank_account_number" TEXT,
    "bank_account_name" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Lagos',
    "cutoff_time" TEXT NOT NULL DEFAULT '18:00',
    "require_phone_confirm" BOOLEAN NOT NULL DEFAULT false,
    "status" "AjoGroupStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ajo_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajo_group_rule_versions" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "group_id" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "late_fee_type" "AjoFeeType" NOT NULL DEFAULT 'NONE',
    "late_fee_value" BIGINT NOT NULL DEFAULT 0,
    "late_fee_cap_kobo" BIGINT,
    "grace_days" INTEGER NOT NULL DEFAULT 3,
    "guarantor_policy" TEXT NOT NULL DEFAULT 'OPTIONAL',
    "default_procedure" TEXT NOT NULL DEFAULT 'CASE_AND_PLAN',
    "reminders_enabled" BOOLEAN NOT NULL DEFAULT true,
    "block_at_risk_early" BOOLEAN NOT NULL DEFAULT false,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajo_group_rule_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajo_rule_acceptances" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "membership_id" INTEGER NOT NULL,
    "rule_version_id" INTEGER NOT NULL,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evidence" JSONB,

    CONSTRAINT "ajo_rule_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajo_memberships" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "group_id" INTEGER NOT NULL,
    "member_id" INTEGER NOT NULL,
    "status" "AjoMembershipStatus" NOT NULL DEFAULT 'PENDING',
    "approved_by" INTEGER,
    "approved_at" TIMESTAMP(3),
    "payout_position" INTEGER,
    "guarantor_agreement_id" INTEGER,
    "phone_confirmed_at" TIMESTAMP(3),
    "accepted_rule_version_id" INTEGER,
    "joined_at" TIMESTAMP(3),
    "left_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ajo_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajo_installments" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "membership_id" INTEGER NOT NULL,
    "due_date" DATE NOT NULL,
    "amount_kobo" BIGINT NOT NULL,
    "paid_kobo" BIGINT NOT NULL DEFAULT 0,
    "status" "AjoInstallmentStatus" NOT NULL DEFAULT 'DUE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ajo_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajo_contributions" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "group_id" INTEGER NOT NULL,
    "membership_id" INTEGER NOT NULL,
    "installment_id" INTEGER,
    "amount_kobo" BIGINT NOT NULL,
    "method" "AjoContributionMethod" NOT NULL,
    "status" "AjoContributionStatus" NOT NULL DEFAULT 'REPORTED',
    "collector_id" INTEGER,
    "reference" TEXT NOT NULL,
    "proof_key" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "reason" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL,
    "confirmed_at" TIMESTAMP(3),
    "confirmed_by" INTEGER,
    "reversal_of_id" INTEGER,
    "recorded_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajo_contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajo_collector_assignments" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "collector_user_id" INTEGER NOT NULL,
    "membership_id" INTEGER NOT NULL,
    "daily_target_kobo" BIGINT,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajo_collector_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajo_cash_handovers" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "group_id" INTEGER NOT NULL,
    "collector_user_id" INTEGER NOT NULL,
    "for_date" DATE NOT NULL,
    "expected_kobo" BIGINT NOT NULL,
    "collected_kobo" BIGINT NOT NULL,
    "handed_over_kobo" BIGINT NOT NULL,
    "difference_kobo" BIGINT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "reconciled_by" INTEGER,
    "reconciled_at" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajo_cash_handovers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajo_payout_accounts" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "member_id" INTEGER NOT NULL,
    "bank_name" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changed_by" INTEGER,
    "cool_off_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajo_payout_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajo_payouts" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "group_id" INTEGER NOT NULL,
    "membership_id" INTEGER NOT NULL,
    "round" INTEGER,
    "gross_kobo" BIGINT NOT NULL,
    "collector_fee_kobo" BIGINT NOT NULL DEFAULT 0,
    "shortfall_kobo" BIGINT NOT NULL DEFAULT 0,
    "net_kobo" BIGINT NOT NULL,
    "status" "AjoPayoutStatus" NOT NULL DEFAULT 'PREPARED',
    "prepared_by" INTEGER NOT NULL,
    "prepared_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_by" INTEGER,
    "approved_at" TIMESTAMP(3),
    "self_approval_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "account_snapshot" JSONB NOT NULL,
    "paid_reference" TEXT,
    "paid_recorded_by" INTEGER,
    "paid_at" TIMESTAMP(3),
    "void_reason" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ajo_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajo_late_fee_assessments" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "installment_id" INTEGER NOT NULL,
    "rule_version_id" INTEGER NOT NULL,
    "basis_kobo" BIGINT NOT NULL,
    "fee_kobo" BIGINT NOT NULL,
    "cap_applied" BOOLEAN NOT NULL DEFAULT false,
    "calculation" JSONB NOT NULL,
    "status" "AjoLateFeeStatus" NOT NULL DEFAULT 'PENDING',
    "waived_by" INTEGER,
    "waived_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajo_late_fee_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajo_default_cases" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "group_id" INTEGER NOT NULL,
    "membership_id" INTEGER NOT NULL,
    "status" "AjoDefaultCaseStatus" NOT NULL DEFAULT 'OPEN',
    "outstanding_kobo" BIGINT NOT NULL,
    "member_response" TEXT,
    "resolution" TEXT,
    "opened_by" INTEGER,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "ajo_default_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajo_repayment_plans" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "case_id" INTEGER NOT NULL,
    "status" "AjoRepaymentPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "schedule" JSONB NOT NULL,
    "agreed_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajo_repayment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajo_guarantor_agreements" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "wording" TEXT NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajo_guarantor_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajo_ledger_entries" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "group_id" INTEGER NOT NULL,
    "membership_id" INTEGER,
    "type" "AjoLedgerEntryType" NOT NULL,
    "direction" "AjoLedgerDirection" NOT NULL,
    "amount_kobo" BIGINT NOT NULL,
    "ref_type" TEXT NOT NULL,
    "ref_id" INTEGER,
    "idempotency_key" TEXT NOT NULL,
    "reversal_of_id" INTEGER,
    "reason" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajo_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajo_trust_snapshots" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "membership_id" INTEGER NOT NULL,
    "on_time_bps" INTEGER,
    "on_time_count" INTEGER NOT NULL,
    "due_count" INTEGER NOT NULL,
    "band" "AjoTrustBand" NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajo_trust_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajo_verifications" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "member_id" INTEGER NOT NULL,
    "submitted_name" TEXT NOT NULL,
    "submitted_phone" TEXT,
    "submitted_address" TEXT,
    "submitted_account_name" TEXT,
    "status" "AjoVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "name_matches_account" BOOLEAN,
    "phone_confirmed" BOOLEAN,
    "address_filled" BOOLEAN,
    "reviewed_by" INTEGER,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajo_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajo_payout_order_events" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "group_id" INTEGER NOT NULL,
    "type" "AjoOrderEventType" NOT NULL,
    "detail" JSONB NOT NULL,
    "reason" TEXT,
    "requested_by" INTEGER,
    "approved_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajo_payout_order_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajo_disputes" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "membership_id" INTEGER NOT NULL,
    "contribution_id" INTEGER,
    "claim" TEXT NOT NULL,
    "evidence_key" TEXT,
    "status" "AjoDisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolved_by" INTEGER,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajo_disputes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ajo_groups_association_id_status_idx" ON "ajo_groups"("association_id", "status");

-- CreateIndex
CREATE INDEX "ajo_group_rule_versions_association_id_idx" ON "ajo_group_rule_versions"("association_id");

-- CreateIndex
CREATE UNIQUE INDEX "ajo_group_rule_versions_group_id_version_key" ON "ajo_group_rule_versions"("group_id", "version");

-- CreateIndex
CREATE INDEX "ajo_rule_acceptances_association_id_idx" ON "ajo_rule_acceptances"("association_id");

-- CreateIndex
CREATE UNIQUE INDEX "ajo_rule_acceptances_membership_id_rule_version_id_key" ON "ajo_rule_acceptances"("membership_id", "rule_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "ajo_memberships_guarantor_agreement_id_key" ON "ajo_memberships"("guarantor_agreement_id");

-- CreateIndex
CREATE INDEX "ajo_memberships_association_id_status_idx" ON "ajo_memberships"("association_id", "status");

-- CreateIndex
CREATE INDEX "ajo_memberships_member_id_idx" ON "ajo_memberships"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "ajo_memberships_group_id_member_id_key" ON "ajo_memberships"("group_id", "member_id");

-- CreateIndex
CREATE INDEX "ajo_installments_association_id_status_due_date_idx" ON "ajo_installments"("association_id", "status", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "ajo_installments_membership_id_due_date_key" ON "ajo_installments"("membership_id", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "ajo_contributions_idempotency_key_key" ON "ajo_contributions"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "ajo_contributions_reversal_of_id_key" ON "ajo_contributions"("reversal_of_id");

-- CreateIndex
CREATE INDEX "ajo_contributions_association_id_group_id_status_idx" ON "ajo_contributions"("association_id", "group_id", "status");

-- CreateIndex
CREATE INDEX "ajo_contributions_membership_id_received_at_idx" ON "ajo_contributions"("membership_id", "received_at");

-- CreateIndex
CREATE INDEX "ajo_collector_assignments_association_id_collector_user_id_idx" ON "ajo_collector_assignments"("association_id", "collector_user_id");

-- CreateIndex
CREATE INDEX "ajo_collector_assignments_membership_id_idx" ON "ajo_collector_assignments"("membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "ajo_cash_handovers_idempotency_key_key" ON "ajo_cash_handovers"("idempotency_key");

-- CreateIndex
CREATE INDEX "ajo_cash_handovers_association_id_idx" ON "ajo_cash_handovers"("association_id");

-- CreateIndex
CREATE UNIQUE INDEX "ajo_cash_handovers_group_id_collector_user_id_for_date_key" ON "ajo_cash_handovers"("group_id", "collector_user_id", "for_date");

-- CreateIndex
CREATE UNIQUE INDEX "ajo_payout_accounts_member_id_key" ON "ajo_payout_accounts"("member_id");

-- CreateIndex
CREATE INDEX "ajo_payout_accounts_association_id_idx" ON "ajo_payout_accounts"("association_id");

-- CreateIndex
CREATE UNIQUE INDEX "ajo_payouts_idempotency_key_key" ON "ajo_payouts"("idempotency_key");

-- CreateIndex
CREATE INDEX "ajo_payouts_association_id_group_id_status_idx" ON "ajo_payouts"("association_id", "group_id", "status");

-- CreateIndex
CREATE INDEX "ajo_payouts_membership_id_idx" ON "ajo_payouts"("membership_id");

-- CreateIndex
CREATE INDEX "ajo_late_fee_assessments_association_id_status_idx" ON "ajo_late_fee_assessments"("association_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ajo_late_fee_assessments_installment_id_rule_version_id_key" ON "ajo_late_fee_assessments"("installment_id", "rule_version_id");

-- CreateIndex
CREATE INDEX "ajo_default_cases_association_id_status_idx" ON "ajo_default_cases"("association_id", "status");

-- CreateIndex
CREATE INDEX "ajo_repayment_plans_association_id_idx" ON "ajo_repayment_plans"("association_id");

-- CreateIndex
CREATE INDEX "ajo_guarantor_agreements_association_id_idx" ON "ajo_guarantor_agreements"("association_id");

-- CreateIndex
CREATE UNIQUE INDEX "ajo_ledger_entries_idempotency_key_key" ON "ajo_ledger_entries"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "ajo_ledger_entries_reversal_of_id_key" ON "ajo_ledger_entries"("reversal_of_id");

-- CreateIndex
CREATE INDEX "ajo_ledger_entries_association_id_group_id_created_at_idx" ON "ajo_ledger_entries"("association_id", "group_id", "created_at");

-- CreateIndex
CREATE INDEX "ajo_ledger_entries_membership_id_idx" ON "ajo_ledger_entries"("membership_id");

-- CreateIndex
CREATE INDEX "ajo_ledger_entries_ref_type_ref_id_idx" ON "ajo_ledger_entries"("ref_type", "ref_id");

-- CreateIndex
CREATE INDEX "ajo_trust_snapshots_membership_id_computed_at_idx" ON "ajo_trust_snapshots"("membership_id", "computed_at");

-- CreateIndex
CREATE INDEX "ajo_trust_snapshots_association_id_idx" ON "ajo_trust_snapshots"("association_id");

-- CreateIndex
CREATE INDEX "ajo_verifications_association_id_status_idx" ON "ajo_verifications"("association_id", "status");

-- CreateIndex
CREATE INDEX "ajo_verifications_member_id_created_at_idx" ON "ajo_verifications"("member_id", "created_at");

-- CreateIndex
CREATE INDEX "ajo_payout_order_events_association_id_group_id_created_at_idx" ON "ajo_payout_order_events"("association_id", "group_id", "created_at");

-- CreateIndex
CREATE INDEX "ajo_disputes_association_id_status_idx" ON "ajo_disputes"("association_id", "status");

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey
ALTER TABLE "ajo_groups" ADD CONSTRAINT "ajo_groups_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajo_group_rule_versions" ADD CONSTRAINT "ajo_group_rule_versions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "ajo_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajo_rule_acceptances" ADD CONSTRAINT "ajo_rule_acceptances_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "ajo_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajo_rule_acceptances" ADD CONSTRAINT "ajo_rule_acceptances_rule_version_id_fkey" FOREIGN KEY ("rule_version_id") REFERENCES "ajo_group_rule_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajo_memberships" ADD CONSTRAINT "ajo_memberships_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "ajo_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajo_memberships" ADD CONSTRAINT "ajo_memberships_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajo_memberships" ADD CONSTRAINT "ajo_memberships_guarantor_agreement_id_fkey" FOREIGN KEY ("guarantor_agreement_id") REFERENCES "ajo_guarantor_agreements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajo_installments" ADD CONSTRAINT "ajo_installments_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "ajo_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajo_contributions" ADD CONSTRAINT "ajo_contributions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "ajo_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajo_contributions" ADD CONSTRAINT "ajo_contributions_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "ajo_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajo_contributions" ADD CONSTRAINT "ajo_contributions_installment_id_fkey" FOREIGN KEY ("installment_id") REFERENCES "ajo_installments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajo_contributions" ADD CONSTRAINT "ajo_contributions_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "ajo_contributions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajo_collector_assignments" ADD CONSTRAINT "ajo_collector_assignments_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "ajo_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajo_cash_handovers" ADD CONSTRAINT "ajo_cash_handovers_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "ajo_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajo_payout_accounts" ADD CONSTRAINT "ajo_payout_accounts_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajo_payouts" ADD CONSTRAINT "ajo_payouts_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "ajo_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajo_payouts" ADD CONSTRAINT "ajo_payouts_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "ajo_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajo_late_fee_assessments" ADD CONSTRAINT "ajo_late_fee_assessments_installment_id_fkey" FOREIGN KEY ("installment_id") REFERENCES "ajo_installments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajo_default_cases" ADD CONSTRAINT "ajo_default_cases_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "ajo_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajo_default_cases" ADD CONSTRAINT "ajo_default_cases_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "ajo_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajo_repayment_plans" ADD CONSTRAINT "ajo_repayment_plans_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "ajo_default_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajo_ledger_entries" ADD CONSTRAINT "ajo_ledger_entries_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "ajo_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajo_ledger_entries" ADD CONSTRAINT "ajo_ledger_entries_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "ajo_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajo_ledger_entries" ADD CONSTRAINT "ajo_ledger_entries_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "ajo_ledger_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajo_trust_snapshots" ADD CONSTRAINT "ajo_trust_snapshots_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "ajo_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajo_verifications" ADD CONSTRAINT "ajo_verifications_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajo_payout_order_events" ADD CONSTRAINT "ajo_payout_order_events_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "ajo_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajo_disputes" ADD CONSTRAINT "ajo_disputes_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "ajo_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajo_disputes" ADD CONSTRAINT "ajo_disputes_contribution_id_fkey" FOREIGN KEY ("contribution_id") REFERENCES "ajo_contributions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

