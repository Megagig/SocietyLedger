/*
  Warnings:

  - You are about to drop the column `created_by` on the `export_history` table. All the data in the column will be lost.
  - You are about to drop the column `date_range_end` on the `export_history` table. All the data in the column will be lost.
  - You are about to drop the column `date_range_start` on the `export_history` table. All the data in the column will be lost.
  - You are about to drop the column `export_format` on the `export_history` table. All the data in the column will be lost.
  - You are about to drop the column `export_period` on the `export_history` table. All the data in the column will be lost.
  - You are about to drop the column `export_type` on the `export_history` table. All the data in the column will be lost.
  - You are about to drop the column `file_path` on the `export_history` table. All the data in the column will be lost.
  - You are about to drop the column `member_id` on the `export_history` table. All the data in the column will be lost.
  - Added the required column `expires_at` to the `export_history` table without a default value. This is not possible if the table is not empty.
  - Added the required column `file_size` to the `export_history` table without a default value. This is not possible if the table is not empty.
  - Added the required column `filename` to the `export_history` table without a default value. This is not possible if the table is not empty.
  - Added the required column `filepath` to the `export_history` table without a default value. This is not possible if the table is not empty.
  - Added the required column `format` to the `export_history` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `export_history` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `export_history` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "LevyCampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "NormalBalance" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "JournalEntryStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'POSTED', 'VOIDED');

-- CreateEnum
CREATE TYPE "BudgetStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('OPEN', 'CLOSED', 'LOCKED');

-- CreateEnum
CREATE TYPE "BankTransferStatus" AS ENUM ('PENDING', 'VERIFIED', 'MATCHED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('UNMATCHED', 'AUTO_MATCHED', 'MANUAL_MATCHED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReconciliationMatchType" AS ENUM ('AUTO_REFERENCE', 'AUTO_AMOUNT', 'MANUAL');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "PaymentProofStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SavingsAccountType" AS ENUM ('REGULAR', 'THRIFT', 'TARGET', 'FIXED_DEPOSIT');

-- CreateEnum
CREATE TYPE "SavingsAccountStatus" AS ENUM ('ACTIVE', 'DORMANT', 'CLOSED', 'MATURED');

-- CreateEnum
CREATE TYPE "SavingsTransactionType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'INTEREST', 'TRANSFER_IN', 'TRANSFER_OUT', 'FEE');

-- CreateEnum
CREATE TYPE "InterestType" AS ENUM ('FLAT', 'REDUCING_BALANCE', 'COMPOUND');

-- CreateEnum
CREATE TYPE "LoanApplicationStatus" AS ENUM ('DRAFT', 'PENDING_GUARANTORS', 'PENDING_REVIEW', 'UNDER_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'DISBURSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GuarantorStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'RELEASED');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'OVERDUE', 'DEFAULTED', 'PAID_OFF', 'WRITTEN_OFF');

-- CreateEnum
CREATE TYPE "RepaymentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'WAIVED');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('DEBIT', 'CREDIT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "LedgerCategory" AS ENUM ('DUES', 'LEVY', 'PENALTY', 'DONATION', 'REFUND', 'WAIVER', 'ADJUSTMENT', 'SAVINGS_DEPOSIT', 'SAVINGS_WITHDRAWAL', 'LOAN_DISBURSEMENT', 'LOAN_REPAYMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "MeetingType" AS ENUM ('REGULAR', 'EMERGENCY', 'AGM', 'EGM', 'COMMITTEE', 'SPECIAL');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'POSTPONED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PENDING', 'PRESENT', 'ABSENT', 'APOLOGY', 'LATE');

-- CreateEnum
CREATE TYPE "WelfareFundType" AS ENUM ('GENERAL', 'BEREAVEMENT', 'MEDICAL', 'EDUCATION', 'EMERGENCY', 'MATERNITY', 'WEDDING');

-- CreateEnum
CREATE TYPE "WelfareFundStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "WelfareContributionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "WelfarePayoutType" AS ENUM ('BEREAVEMENT', 'MEDICAL', 'EDUCATION', 'EMERGENCY', 'MATERNITY', 'WEDDING', 'OTHER');

-- CreateEnum
CREATE TYPE "WelfarePayoutStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'DISBURSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SMSMessageType" AS ENUM ('SINGLE', 'BULK', 'AUTOMATED');

-- CreateEnum
CREATE TYPE "SMSStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SMSCampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "SMSRecipientType" AS ENUM ('ALL_MEMBERS', 'SELECTED_MEMBERS', 'MEMBER_CATEGORY', 'CUSTOM_NUMBERS', 'OWING_MEMBERS', 'PAID_MEMBERS');

-- CreateEnum
CREATE TYPE "SMSTemplateCategory" AS ENUM ('GENERAL', 'PAYMENT_REMINDER', 'MEETING', 'DUES', 'LEVY', 'WELFARE', 'ELECTION', 'CUSTOM');

-- CreateEnum
CREATE TYPE "SMSCreditTransactionType" AS ENUM ('PURCHASE', 'USAGE', 'REFUND', 'BONUS', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "ElectionType" AS ENUM ('GENERAL', 'EXECUTIVE', 'COMMITTEE', 'SPECIAL');

-- CreateEnum
CREATE TYPE "ElectionStatus" AS ENUM ('DRAFT', 'NOMINATIONS_OPEN', 'VOTING_OPEN', 'VOTING_CLOSED', 'RESULTS_PUBLISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "PollType" AS ENUM ('YES_NO', 'MULTIPLE_CHOICE', 'SINGLE_CHOICE', 'RATING');

-- CreateEnum
CREATE TYPE "PollStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OverrideType" AS ENUM ('MANUAL', 'TRIAL', 'PROMOTION', 'SUPPORT', 'COMPLIANCE');

-- CreateEnum
CREATE TYPE "BillingOverrideType" AS ENUM ('BYPASS_BILLING', 'EXTEND_TRIAL', 'PAUSE_BILLING', 'APPLY_CREDIT', 'MARK_PAID_EXTERNAL', 'OVERRIDE_PLAN', 'GRACE_PERIOD');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('ACCESS', 'PAYMENTS', 'REPORTS', 'MEMBERS', 'TECHNICAL', 'BUG', 'FEATURE_REQUEST', 'OTHER');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_ON_USER', 'WAITING_ON_STAFF', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'RETRYING');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PlatformRole" ADD VALUE 'FINANCE_ADMIN';
ALTER TYPE "PlatformRole" ADD VALUE 'COMPLIANCE_ADMIN';

-- DropForeignKey
ALTER TABLE "export_history" DROP CONSTRAINT "export_history_created_by_fkey";

-- DropForeignKey
ALTER TABLE "export_history" DROP CONSTRAINT "export_history_member_id_fkey";

-- DropIndex
DROP INDEX "export_history_association_id_export_type_idx";

-- AlterTable
ALTER TABLE "associations" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by" INTEGER,
ADD COLUMN     "deletion_reason" TEXT,
ADD COLUMN     "force_2fa" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ip_restrictions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "is_platform_association" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "password_policy_level" TEXT NOT NULL DEFAULT 'standard',
ADD COLUMN     "session_timeout_minutes" INTEGER NOT NULL DEFAULT 480;

-- AlterTable
ALTER TABLE "export_history" DROP COLUMN "created_by",
DROP COLUMN "date_range_end",
DROP COLUMN "date_range_start",
DROP COLUMN "export_format",
DROP COLUMN "export_period",
DROP COLUMN "export_type",
DROP COLUMN "file_path",
DROP COLUMN "member_id",
ADD COLUMN     "expires_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "file_size" INTEGER NOT NULL,
ADD COLUMN     "filename" TEXT NOT NULL,
ADD COLUMN     "filepath" TEXT NOT NULL,
ADD COLUMN     "format" TEXT NOT NULL,
ADD COLUMN     "type" TEXT NOT NULL,
ADD COLUMN     "user_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "member_invites" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "accounting_entry_id" INTEGER,
ADD COLUMN     "accounting_synced" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "accounting_entry_id" INTEGER,
ADD COLUMN     "accounting_synced" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "edit_history" JSONB,
ADD COLUMN     "is_voided" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_edited_at" TIMESTAMP(3),
ADD COLUMN     "last_edited_by" INTEGER,
ADD COLUMN     "replaced_by" INTEGER,
ADD COLUMN     "replaces" INTEGER,
ADD COLUMN     "void_reason" TEXT,
ADD COLUMN     "voided_at" TIMESTAMP(3),
ADD COLUMN     "voided_by" INTEGER;

-- AlterTable
ALTER TABLE "user_approvals" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "onboarding_progress" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "current_step" INTEGER NOT NULL DEFAULT 1,
    "completed_steps" JSONB NOT NULL DEFAULT '[]',
    "profile_completed" BOOLEAN NOT NULL DEFAULT false,
    "team_invited" BOOLEAN NOT NULL DEFAULT false,
    "members_imported" BOOLEAN NOT NULL DEFAULT false,
    "finance_configured" BOOLEAN NOT NULL DEFAULT false,
    "onboarding_complete" BOOLEAN NOT NULL DEFAULT false,
    "skipped_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "levy_campaigns" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "target_amount" DECIMAL(12,2) NOT NULL,
    "amount_per_member" DECIMAL(10,2),
    "deadline" TIMESTAMP(3) NOT NULL,
    "status" "LevyCampaignStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "levy_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "levy_campaign_assignments" (
    "id" SERIAL NOT NULL,
    "campaign_id" INTEGER NOT NULL,
    "member_id" INTEGER NOT NULL,
    "transaction_id" INTEGER,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "levy_campaign_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donation_allocations" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'general',
    "target_amount" DECIMAL(12,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "donation_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donation_records" (
    "id" SERIAL NOT NULL,
    "transaction_id" INTEGER NOT NULL,
    "allocation_id" INTEGER,
    "receipt_number" TEXT NOT NULL,
    "donor_message" TEXT,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "donation_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penalty_rules" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "category_id" INTEGER,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "triggerType" TEXT NOT NULL DEFAULT 'late_payment',
    "grace_period_days" INTEGER NOT NULL DEFAULT 0,
    "feeType" TEXT NOT NULL DEFAULT 'fixed',
    "fee_amount" DECIMAL(10,2) NOT NULL,
    "max_fee_amount" DECIMAL(10,2),
    "is_compounding" BOOLEAN NOT NULL DEFAULT false,
    "compounding_days" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "penalty_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applied_penalties" (
    "id" SERIAL NOT NULL,
    "rule_id" INTEGER NOT NULL,
    "source_transaction_id" INTEGER NOT NULL,
    "penalty_transaction_id" INTEGER,
    "amount" DECIMAL(10,2) NOT NULL,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "applied_penalties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penalty_waivers" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "transaction_id" INTEGER NOT NULL,
    "waived_amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "waived_by" INTEGER NOT NULL,
    "waived_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "penalty_waivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chart_of_accounts" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "sub_type" TEXT,
    "description" TEXT,
    "parent_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system_account" BOOLEAN NOT NULL DEFAULT false,
    "normal_balance" "NormalBalance" NOT NULL DEFAULT 'DEBIT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chart_of_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "entry_number" TEXT NOT NULL,
    "entry_date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "source_type" TEXT,
    "source_id" INTEGER,
    "status" "JournalEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "total_debit" DECIMAL(12,2) NOT NULL,
    "total_credit" DECIMAL(12,2) NOT NULL,
    "created_by" INTEGER NOT NULL,
    "approved_by" INTEGER,
    "approved_at" TIMESTAMP(3),
    "rejected_by" INTEGER,
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "posted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entry_lines" (
    "id" SERIAL NOT NULL,
    "journal_entry_id" INTEGER NOT NULL,
    "account_id" INTEGER NOT NULL,
    "debit_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "credit_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "description" TEXT,

    CONSTRAINT "journal_entry_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "fiscal_year" INTEGER NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "status" "BudgetStatus" NOT NULL DEFAULT 'DRAFT',
    "total_budget" DECIMAL(12,2) NOT NULL,
    "created_by" INTEGER NOT NULL,
    "approved_by" INTEGER,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_items" (
    "id" SERIAL NOT NULL,
    "budget_id" INTEGER NOT NULL,
    "account_id" INTEGER NOT NULL,
    "monthly_amount" DECIMAL(12,2) NOT NULL,
    "q1_amount" DECIMAL(12,2),
    "q2_amount" DECIMAL(12,2),
    "q3_amount" DECIMAL(12,2),
    "q4_amount" DECIMAL(12,2),
    "annual_amount" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "budget_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_periods" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "period_type" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "status" "PeriodStatus" NOT NULL DEFAULT 'OPEN',
    "closed_by" INTEGER,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "association_bank_accounts" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "bank_name" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "bank_code" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "association_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transfers" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "transaction_id" INTEGER,
    "bank_account_id" INTEGER,
    "member_id" INTEGER,
    "sender_bank_name" TEXT NOT NULL,
    "sender_account_number" TEXT,
    "sender_account_name" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "reference" TEXT NOT NULL,
    "transfer_date" TIMESTAMP(3) NOT NULL,
    "narration" TEXT,
    "status" "BankTransferStatus" NOT NULL DEFAULT 'PENDING',
    "reconciliation_id" INTEGER,
    "verified_by" INTEGER,
    "verified_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_statement_imports" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "bank_account_id" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "import_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "total_entries" INTEGER NOT NULL DEFAULT 0,
    "matched_entries" INTEGER NOT NULL DEFAULT 0,
    "unmatched_entries" INTEGER NOT NULL DEFAULT 0,
    "status" "ImportStatus" NOT NULL DEFAULT 'PROCESSING',
    "imported_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_statement_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_statement_entries" (
    "id" SERIAL NOT NULL,
    "import_id" INTEGER NOT NULL,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "value_date" TIMESTAMP(3),
    "reference" TEXT,
    "description" TEXT NOT NULL,
    "debit_amount" DECIMAL(12,2),
    "credit_amount" DECIMAL(12,2),
    "balance" DECIMAL(12,2),
    "match_status" "MatchStatus" NOT NULL DEFAULT 'UNMATCHED',
    "matched_transaction_id" INTEGER,
    "matched_bank_transfer_id" INTEGER,
    "match_confidence" INTEGER,
    "matched_at" TIMESTAMP(3),
    "matched_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_statement_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_reconciliations" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "transaction_id" INTEGER NOT NULL,
    "statement_entry_id" INTEGER,
    "match_type" "ReconciliationMatchType" NOT NULL,
    "matched_amount" DECIMAL(12,2) NOT NULL,
    "variance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'PENDING',
    "reconciled_by" INTEGER,
    "reconciled_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_proofs" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "transaction_id" INTEGER,
    "bank_transfer_id" INTEGER,
    "member_id" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "filepath" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "status" "PaymentProofStatus" NOT NULL DEFAULT 'PENDING',
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified_by" INTEGER,
    "verified_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "notes" TEXT,

    CONSTRAINT "payment_proofs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "savings_accounts" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "member_id" INTEGER NOT NULL,
    "account_number" TEXT NOT NULL,
    "account_type" "SavingsAccountType" NOT NULL DEFAULT 'REGULAR',
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "target_amount" DECIMAL(12,2),
    "monthly_contribution" DECIMAL(12,2),
    "interest_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "accrued_interest" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_deposits" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_withdrawals" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "SavingsAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "maturity_date" TIMESTAMP(3),
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "savings_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "savings_transactions" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "savings_account_id" INTEGER NOT NULL,
    "type" "SavingsTransactionType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balance_after" DECIMAL(12,2) NOT NULL,
    "payment_method" TEXT,
    "reference" TEXT,
    "processed_by" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transaction_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accounting_synced" BOOLEAN NOT NULL DEFAULT false,
    "accounting_entry_id" INTEGER,

    CONSTRAINT "savings_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_products" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "min_amount" DECIMAL(12,2) NOT NULL,
    "max_amount" DECIMAL(12,2) NOT NULL,
    "interest_rate" DECIMAL(5,2) NOT NULL,
    "interest_type" "InterestType" NOT NULL DEFAULT 'REDUCING_BALANCE',
    "min_tenure_months" INTEGER NOT NULL,
    "max_tenure_months" INTEGER NOT NULL,
    "processing_fee_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "processing_fee_fixed" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "requires_guarantor" BOOLEAN NOT NULL DEFAULT true,
    "min_guarantors" INTEGER NOT NULL DEFAULT 1,
    "max_loan_to_savings_ratio" DECIMAL(5,2),
    "grace_period_days" INTEGER NOT NULL DEFAULT 0,
    "late_fee_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "late_fee_fixed" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_applications" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "application_number" TEXT NOT NULL,
    "member_id" INTEGER NOT NULL,
    "loan_product_id" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "tenure_months" INTEGER NOT NULL,
    "interest_rate" DECIMAL(5,2) NOT NULL,
    "interest_type" "InterestType" NOT NULL,
    "monthly_repayment" DECIMAL(12,2) NOT NULL,
    "total_repayment" DECIMAL(12,2) NOT NULL,
    "total_interest" DECIMAL(12,2) NOT NULL,
    "processing_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "purpose" TEXT NOT NULL,
    "status" "LoanApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "collateral_description" TEXT,
    "collateral_value" DECIMAL(12,2),
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by" INTEGER,
    "reviewed_at" TIMESTAMP(3),
    "review_comments" TEXT,
    "approved_by" INTEGER,
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "disbursed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_guarantors" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "loan_application_id" INTEGER NOT NULL,
    "guarantor_member_id" INTEGER NOT NULL,
    "guarantee_amount" DECIMAL(12,2) NOT NULL,
    "status" "GuarantorStatus" NOT NULL DEFAULT 'PENDING',
    "accepted_at" TIMESTAMP(3),
    "declined_at" TIMESTAMP(3),
    "decline_reason" TEXT,
    "released_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_guarantors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loans" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "loan_number" TEXT NOT NULL,
    "application_id" INTEGER NOT NULL,
    "member_id" INTEGER NOT NULL,
    "loan_product_id" INTEGER NOT NULL,
    "principal_amount" DECIMAL(12,2) NOT NULL,
    "interest_rate" DECIMAL(5,2) NOT NULL,
    "interest_type" "InterestType" NOT NULL,
    "tenure_months" INTEGER NOT NULL,
    "monthly_repayment" DECIMAL(12,2) NOT NULL,
    "total_repayment" DECIMAL(12,2) NOT NULL,
    "total_interest" DECIMAL(12,2) NOT NULL,
    "processing_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "amount_disbursed" DECIMAL(12,2) NOT NULL,
    "total_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "principal_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "interest_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "outstanding_balance" DECIMAL(12,2) NOT NULL,
    "next_payment_date" DATE,
    "next_payment_amount" DECIMAL(12,2),
    "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "disbursed_at" TIMESTAMP(3) NOT NULL,
    "maturity_date" DATE NOT NULL,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "accounting_synced" BOOLEAN NOT NULL DEFAULT false,
    "accounting_entry_id" INTEGER,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_repayment_schedule" (
    "id" SERIAL NOT NULL,
    "loan_id" INTEGER NOT NULL,
    "installment_number" INTEGER NOT NULL,
    "due_date" DATE NOT NULL,
    "principal_due" DECIMAL(12,2) NOT NULL,
    "interest_due" DECIMAL(12,2) NOT NULL,
    "total_due" DECIMAL(12,2) NOT NULL,
    "principal_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "interest_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "late_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "RepaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_repayment_schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_repayments" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "loan_id" INTEGER NOT NULL,
    "schedule_item_id" INTEGER,
    "amount" DECIMAL(12,2) NOT NULL,
    "principal_portion" DECIMAL(12,2) NOT NULL,
    "interest_portion" DECIMAL(12,2) NOT NULL,
    "late_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "payment_method" TEXT NOT NULL,
    "reference" TEXT,
    "processed_by" INTEGER NOT NULL,
    "notes" TEXT,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payment_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accounting_synced" BOOLEAN NOT NULL DEFAULT false,
    "accounting_entry_id" INTEGER,

    CONSTRAINT "loan_repayments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_financial_ledger" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "member_id" INTEGER NOT NULL,
    "entry_type" "LedgerEntryType" NOT NULL,
    "category" "LedgerCategory" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "running_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "effective_date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "source_table" TEXT NOT NULL,
    "source_id" INTEGER NOT NULL,
    "reference_number" TEXT,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_financial_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meetings" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "meeting_type" "MeetingType" NOT NULL DEFAULT 'REGULAR',
    "location" TEXT,
    "virtual_link" TEXT,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3),
    "status" "MeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "quorum_required" INTEGER,
    "created_by" INTEGER NOT NULL,
    "cancelled_by" INTEGER,
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "reminder_sent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_agenda" (
    "id" SERIAL NOT NULL,
    "meeting_id" INTEGER NOT NULL,
    "order_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "duration" INTEGER,
    "presenter" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_agenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_attendance" (
    "id" SERIAL NOT NULL,
    "meeting_id" INTEGER NOT NULL,
    "member_id" INTEGER NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PENDING',
    "check_in_time" TIMESTAMP(3),
    "check_out_time" TIMESTAMP(3),
    "apology_reason" TEXT,
    "marked_by" INTEGER,
    "marked_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_minutes" (
    "id" SERIAL NOT NULL,
    "meeting_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "decisions" TEXT,
    "actionItems" TEXT,
    "next_meeting_date" TIMESTAMP(3),
    "recorded_by" INTEGER NOT NULL,
    "approved_by" INTEGER,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_minutes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "welfare_funds" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "fund_type" "WelfareFundType" NOT NULL DEFAULT 'GENERAL',
    "target_balance" DECIMAL(12,2),
    "current_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "monthly_contribution" DECIMAL(12,2),
    "is_contribution_mandatory" BOOLEAN NOT NULL DEFAULT false,
    "min_contribution" DECIMAL(12,2),
    "max_payout" DECIMAL(12,2),
    "waiting_period_days" INTEGER NOT NULL DEFAULT 0,
    "min_contribution_months" INTEGER NOT NULL DEFAULT 0,
    "status" "WelfareFundStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "welfare_funds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "welfare_contributions" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "fund_id" INTEGER NOT NULL,
    "member_id" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "contribution_date" TIMESTAMP(3) NOT NULL,
    "payment_method" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "status" "WelfareContributionStatus" NOT NULL DEFAULT 'PENDING',
    "confirmed_by" INTEGER,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "accounting_synced" BOOLEAN NOT NULL DEFAULT false,
    "accounting_entry_id" INTEGER,

    CONSTRAINT "welfare_contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "welfare_payout_requests" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "fund_id" INTEGER NOT NULL,
    "member_id" INTEGER NOT NULL,
    "request_number" TEXT NOT NULL,
    "payout_type" "WelfarePayoutType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "supporting_documents" TEXT,
    "status" "WelfarePayoutStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" INTEGER,
    "reviewed_at" TIMESTAMP(3),
    "review_comments" TEXT,
    "approved_by" INTEGER,
    "approved_at" TIMESTAMP(3),
    "approved_amount" DECIMAL(12,2),
    "rejection_reason" TEXT,
    "disbursed_by" INTEGER,
    "disbursed_at" TIMESTAMP(3),
    "disbursement_method" TEXT,
    "disbursement_reference" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "accounting_synced" BOOLEAN NOT NULL DEFAULT false,
    "accounting_entry_id" INTEGER,

    CONSTRAINT "welfare_payout_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_messages" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "campaign_id" INTEGER,
    "recipient_phone" TEXT NOT NULL,
    "recipient_name" TEXT,
    "member_id" INTEGER,
    "message" TEXT NOT NULL,
    "message_type" "SMSMessageType" NOT NULL DEFAULT 'SINGLE',
    "status" "SMSStatus" NOT NULL DEFAULT 'PENDING',
    "termii_message_id" TEXT,
    "segments" INTEGER NOT NULL DEFAULT 1,
    "cost" DECIMAL(10,4),
    "error_message" TEXT,
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_campaigns" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "template_id" INTEGER,
    "recipient_type" "SMSRecipientType" NOT NULL DEFAULT 'ALL_MEMBERS',
    "recipient_filter" JSONB,
    "total_recipients" INTEGER NOT NULL DEFAULT 0,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "delivered_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "status" "SMSCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduled_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_templates" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" "SMSTemplateCategory" NOT NULL DEFAULT 'GENERAL',
    "placeholders" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_credit_balances" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "balance" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "total_purchased" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "total_used" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "last_top_up_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_credit_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_credit_transactions" (
    "id" SERIAL NOT NULL,
    "balance_id" INTEGER NOT NULL,
    "type" "SMSCreditTransactionType" NOT NULL,
    "amount" DECIMAL(12,4) NOT NULL,
    "description" TEXT,
    "reference" TEXT,
    "campaign_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_credit_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_credits_purchases" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "credits" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reference" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "provider" TEXT NOT NULL DEFAULT 'paystack',
    "paid_at" TIMESTAMP(3),
    "paystack_response" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_credits_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_audit_logs" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "prompt_type" TEXT NOT NULL,
    "model_used" TEXT NOT NULL,
    "tokens_input" INTEGER NOT NULL DEFAULT 0,
    "tokens_output" INTEGER NOT NULL DEFAULT 0,
    "cost_usd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "output_summary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'success',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_embeddings" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "document_type" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL DEFAULT 0,
    "embedding_json" TEXT,
    "metadata" JSONB,
    "is_processed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "elections" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "election_type" "ElectionType" NOT NULL DEFAULT 'GENERAL',
    "status" "ElectionStatus" NOT NULL DEFAULT 'DRAFT',
    "nomination_start_date" TIMESTAMP(3),
    "nomination_end_date" TIMESTAMP(3),
    "voting_start_date" TIMESTAMP(3) NOT NULL,
    "voting_end_date" TIMESTAMP(3) NOT NULL,
    "max_votes_per_member" INTEGER NOT NULL DEFAULT 1,
    "allow_abstention" BOOLEAN NOT NULL DEFAULT true,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT true,
    "requires_quorum" BOOLEAN NOT NULL DEFAULT false,
    "quorum_percentage" INTEGER,
    "eligible_voter_count" INTEGER NOT NULL DEFAULT 0,
    "total_votes_cast" INTEGER NOT NULL DEFAULT 0,
    "created_by" INTEGER NOT NULL,
    "published_by" INTEGER,
    "published_at" TIMESTAMP(3),
    "cancelled_by" INTEGER,
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "elections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "election_positions" (
    "id" SERIAL NOT NULL,
    "election_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "max_candidates" INTEGER NOT NULL DEFAULT 1,
    "order_number" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "election_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" SERIAL NOT NULL,
    "election_id" INTEGER NOT NULL,
    "position_id" INTEGER,
    "member_id" INTEGER NOT NULL,
    "manifesto" TEXT,
    "photo_url" TEXT,
    "status" "CandidateStatus" NOT NULL DEFAULT 'PENDING',
    "nominated_by" INTEGER,
    "nominated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_by" INTEGER,
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "withdrawn_at" TIMESTAMP(3),
    "withdrawal_reason" TEXT,
    "vote_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "votes" (
    "id" SERIAL NOT NULL,
    "election_id" INTEGER NOT NULL,
    "position_id" INTEGER,
    "candidate_id" INTEGER,
    "voter_id" INTEGER NOT NULL,
    "vote_hash" TEXT NOT NULL,
    "is_abstention" BOOLEAN NOT NULL DEFAULT false,
    "voted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "polls" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "poll_type" "PollType" NOT NULL DEFAULT 'SINGLE_CHOICE',
    "status" "PollStatus" NOT NULL DEFAULT 'DRAFT',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "allow_multiple_votes" BOOLEAN NOT NULL DEFAULT false,
    "max_choices" INTEGER,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT true,
    "show_results_before_end" BOOLEAN NOT NULL DEFAULT false,
    "total_responses" INTEGER NOT NULL DEFAULT 0,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "polls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_options" (
    "id" SERIAL NOT NULL,
    "poll_id" INTEGER NOT NULL,
    "option_text" TEXT NOT NULL,
    "order_number" INTEGER NOT NULL DEFAULT 0,
    "vote_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_responses" (
    "id" SERIAL NOT NULL,
    "poll_id" INTEGER NOT NULL,
    "option_id" INTEGER NOT NULL,
    "responder_id" INTEGER NOT NULL,
    "response_hash" TEXT NOT NULL,
    "responded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "examples" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "is_system_role" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" SERIAL NOT NULL,
    "role_id" INTEGER NOT NULL,
    "permission_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "role_id" INTEGER NOT NULL,
    "association_id" INTEGER NOT NULL,
    "assigned_by" INTEGER,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_modules" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_core" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_features" (
    "id" SERIAL NOT NULL,
    "module_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_core" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_modules" (
    "id" SERIAL NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "module_id" INTEGER NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_features" (
    "id" SERIAL NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "feature_id" INTEGER NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_modules" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "module_id" INTEGER NOT NULL,
    "is_enabled" BOOLEAN NOT NULL,
    "override_type" "OverrideType" NOT NULL DEFAULT 'MANUAL',
    "reason" TEXT,
    "overridden_by" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_features" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "feature_id" INTEGER NOT NULL,
    "is_enabled" BOOLEAN NOT NULL,
    "override_type" "OverrideType" NOT NULL DEFAULT 'MANUAL',
    "reason" TEXT,
    "overridden_by" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_overrides" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "override_type" "BillingOverrideType" NOT NULL,
    "value" TEXT,
    "reason" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_date" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER NOT NULL,
    "revoked_by" INTEGER,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_action_logs" (
    "id" SERIAL NOT NULL,
    "actor_id" INTEGER NOT NULL,
    "actor_role" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" INTEGER,
    "association_id" INTEGER,
    "before_state" JSONB,
    "after_state" JSONB,
    "reason" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_articles" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "excerpt" TEXT,
    "category" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "role_visibility" TEXT[] DEFAULT ARRAY['admin', 'treasurer', 'member']::TEXT[],
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "helpful_count" INTEGER NOT NULL DEFAULT 0,
    "not_helpful_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faq_items" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "role_visibility" TEXT[] DEFAULT ARRAY['admin', 'treasurer', 'member']::TEXT[],
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faq_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "ticket_number" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "TicketCategory" NOT NULL,
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "ai_category" TEXT,
    "ai_category_confidence" DOUBLE PRECISION,
    "ai_sentiment" TEXT,
    "ai_sentiment_score" DOUBLE PRECISION,
    "ai_escalation_recommended" BOOLEAN NOT NULL DEFAULT false,
    "assigned_to_id" INTEGER,
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "first_response_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_responses" (
    "id" SERIAL NOT NULL,
    "ticket_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "is_staff" BOOLEAN NOT NULL DEFAULT false,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "is_ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "ai_confidence" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_attachments" (
    "id" SERIAL NOT NULL,
    "ticket_id" INTEGER NOT NULL,
    "response_id" INTEGER,
    "user_id" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "file_path" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_event_logs" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "event_type" TEXT NOT NULL,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'PENDING',
    "status_code" INTEGER,
    "duration" INTEGER,
    "payload" JSONB,
    "response_body" JSONB,
    "error_message" TEXT,
    "source" TEXT NOT NULL DEFAULT 'paystack',
    "endpoint" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_progress_association_id_key" ON "onboarding_progress"("association_id");

-- CreateIndex
CREATE INDEX "levy_campaigns_association_id_status_idx" ON "levy_campaigns"("association_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "levy_campaign_assignments_transaction_id_key" ON "levy_campaign_assignments"("transaction_id");

-- CreateIndex
CREATE INDEX "levy_campaign_assignments_campaign_id_status_idx" ON "levy_campaign_assignments"("campaign_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "levy_campaign_assignments_campaign_id_member_id_key" ON "levy_campaign_assignments"("campaign_id", "member_id");

-- CreateIndex
CREATE INDEX "donation_allocations_association_id_type_idx" ON "donation_allocations"("association_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "donation_records_transaction_id_key" ON "donation_records"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "donation_records_receipt_number_key" ON "donation_records"("receipt_number");

-- CreateIndex
CREATE INDEX "donation_records_allocation_id_idx" ON "donation_records"("allocation_id");

-- CreateIndex
CREATE INDEX "penalty_rules_association_id_is_active_idx" ON "penalty_rules"("association_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "applied_penalties_penalty_transaction_id_key" ON "applied_penalties"("penalty_transaction_id");

-- CreateIndex
CREATE INDEX "applied_penalties_rule_id_idx" ON "applied_penalties"("rule_id");

-- CreateIndex
CREATE INDEX "applied_penalties_source_transaction_id_idx" ON "applied_penalties"("source_transaction_id");

-- CreateIndex
CREATE INDEX "penalty_waivers_association_id_idx" ON "penalty_waivers"("association_id");

-- CreateIndex
CREATE INDEX "penalty_waivers_transaction_id_idx" ON "penalty_waivers"("transaction_id");

-- CreateIndex
CREATE INDEX "chart_of_accounts_association_id_type_idx" ON "chart_of_accounts"("association_id", "type");

-- CreateIndex
CREATE INDEX "chart_of_accounts_parent_id_idx" ON "chart_of_accounts"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "chart_of_accounts_association_id_code_key" ON "chart_of_accounts"("association_id", "code");

-- CreateIndex
CREATE INDEX "journal_entries_association_id_status_idx" ON "journal_entries"("association_id", "status");

-- CreateIndex
CREATE INDEX "journal_entries_association_id_entry_date_idx" ON "journal_entries"("association_id", "entry_date");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_association_id_entry_number_key" ON "journal_entries"("association_id", "entry_number");

-- CreateIndex
CREATE INDEX "journal_entry_lines_journal_entry_id_idx" ON "journal_entry_lines"("journal_entry_id");

-- CreateIndex
CREATE INDEX "journal_entry_lines_account_id_idx" ON "journal_entry_lines"("account_id");

-- CreateIndex
CREATE INDEX "budgets_association_id_fiscal_year_idx" ON "budgets"("association_id", "fiscal_year");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_association_id_fiscal_year_name_key" ON "budgets"("association_id", "fiscal_year", "name");

-- CreateIndex
CREATE INDEX "budget_items_budget_id_idx" ON "budget_items"("budget_id");

-- CreateIndex
CREATE UNIQUE INDEX "budget_items_budget_id_account_id_key" ON "budget_items"("budget_id", "account_id");

-- CreateIndex
CREATE INDEX "accounting_periods_association_id_status_idx" ON "accounting_periods"("association_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_periods_association_id_start_date_end_date_key" ON "accounting_periods"("association_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "association_bank_accounts_association_id_is_active_idx" ON "association_bank_accounts"("association_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "association_bank_accounts_association_id_account_number_key" ON "association_bank_accounts"("association_id", "account_number");

-- CreateIndex
CREATE INDEX "bank_transfers_association_id_status_idx" ON "bank_transfers"("association_id", "status");

-- CreateIndex
CREATE INDEX "bank_transfers_reference_idx" ON "bank_transfers"("reference");

-- CreateIndex
CREATE INDEX "bank_transfers_transaction_id_idx" ON "bank_transfers"("transaction_id");

-- CreateIndex
CREATE INDEX "bank_statement_imports_association_id_status_idx" ON "bank_statement_imports"("association_id", "status");

-- CreateIndex
CREATE INDEX "bank_statement_entries_import_id_match_status_idx" ON "bank_statement_entries"("import_id", "match_status");

-- CreateIndex
CREATE INDEX "bank_statement_entries_reference_idx" ON "bank_statement_entries"("reference");

-- CreateIndex
CREATE INDEX "payment_reconciliations_association_id_status_idx" ON "payment_reconciliations"("association_id", "status");

-- CreateIndex
CREATE INDEX "payment_reconciliations_transaction_id_idx" ON "payment_reconciliations"("transaction_id");

-- CreateIndex
CREATE INDEX "payment_proofs_association_id_status_idx" ON "payment_proofs"("association_id", "status");

-- CreateIndex
CREATE INDEX "payment_proofs_transaction_id_idx" ON "payment_proofs"("transaction_id");

-- CreateIndex
CREATE INDEX "payment_proofs_member_id_idx" ON "payment_proofs"("member_id");

-- CreateIndex
CREATE INDEX "savings_accounts_association_id_status_idx" ON "savings_accounts"("association_id", "status");

-- CreateIndex
CREATE INDEX "savings_accounts_member_id_idx" ON "savings_accounts"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "savings_accounts_association_id_account_number_key" ON "savings_accounts"("association_id", "account_number");

-- CreateIndex
CREATE INDEX "savings_transactions_savings_account_id_idx" ON "savings_transactions"("savings_account_id");

-- CreateIndex
CREATE INDEX "savings_transactions_created_at_idx" ON "savings_transactions"("created_at");

-- CreateIndex
CREATE INDEX "loan_products_association_id_is_active_idx" ON "loan_products"("association_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "loan_products_association_id_name_key" ON "loan_products"("association_id", "name");

-- CreateIndex
CREATE INDEX "loan_applications_association_id_status_idx" ON "loan_applications"("association_id", "status");

-- CreateIndex
CREATE INDEX "loan_applications_member_id_idx" ON "loan_applications"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "loan_applications_association_id_application_number_key" ON "loan_applications"("association_id", "application_number");

-- CreateIndex
CREATE INDEX "loan_guarantors_loan_application_id_idx" ON "loan_guarantors"("loan_application_id");

-- CreateIndex
CREATE INDEX "loan_guarantors_guarantor_member_id_status_idx" ON "loan_guarantors"("guarantor_member_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "loan_guarantors_loan_application_id_guarantor_member_id_key" ON "loan_guarantors"("loan_application_id", "guarantor_member_id");

-- CreateIndex
CREATE UNIQUE INDEX "loans_application_id_key" ON "loans"("application_id");

-- CreateIndex
CREATE INDEX "loans_association_id_status_idx" ON "loans"("association_id", "status");

-- CreateIndex
CREATE INDEX "loans_member_id_idx" ON "loans"("member_id");

-- CreateIndex
CREATE INDEX "loans_next_payment_date_idx" ON "loans"("next_payment_date");

-- CreateIndex
CREATE UNIQUE INDEX "loans_association_id_loan_number_key" ON "loans"("association_id", "loan_number");

-- CreateIndex
CREATE INDEX "loan_repayment_schedule_loan_id_idx" ON "loan_repayment_schedule"("loan_id");

-- CreateIndex
CREATE INDEX "loan_repayment_schedule_due_date_status_idx" ON "loan_repayment_schedule"("due_date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "loan_repayment_schedule_loan_id_installment_number_key" ON "loan_repayment_schedule"("loan_id", "installment_number");

-- CreateIndex
CREATE INDEX "loan_repayments_loan_id_idx" ON "loan_repayments"("loan_id");

-- CreateIndex
CREATE INDEX "loan_repayments_paid_at_idx" ON "loan_repayments"("paid_at");

-- CreateIndex
CREATE INDEX "member_financial_ledger_association_id_member_id_idx" ON "member_financial_ledger"("association_id", "member_id");

-- CreateIndex
CREATE INDEX "member_financial_ledger_association_id_member_id_effective__idx" ON "member_financial_ledger"("association_id", "member_id", "effective_date");

-- CreateIndex
CREATE INDEX "member_financial_ledger_source_table_source_id_idx" ON "member_financial_ledger"("source_table", "source_id");

-- CreateIndex
CREATE INDEX "member_financial_ledger_effective_date_idx" ON "member_financial_ledger"("effective_date");

-- CreateIndex
CREATE INDEX "meetings_association_id_status_idx" ON "meetings"("association_id", "status");

-- CreateIndex
CREATE INDEX "meetings_association_id_start_time_idx" ON "meetings"("association_id", "start_time");

-- CreateIndex
CREATE INDEX "meetings_start_time_idx" ON "meetings"("start_time");

-- CreateIndex
CREATE INDEX "meeting_agenda_meeting_id_idx" ON "meeting_agenda"("meeting_id");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_agenda_meeting_id_order_number_key" ON "meeting_agenda"("meeting_id", "order_number");

-- CreateIndex
CREATE INDEX "meeting_attendance_meeting_id_idx" ON "meeting_attendance"("meeting_id");

-- CreateIndex
CREATE INDEX "meeting_attendance_member_id_idx" ON "meeting_attendance"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_attendance_meeting_id_member_id_key" ON "meeting_attendance"("meeting_id", "member_id");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_minutes_meeting_id_key" ON "meeting_minutes"("meeting_id");

-- CreateIndex
CREATE INDEX "welfare_funds_association_id_status_idx" ON "welfare_funds"("association_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "welfare_funds_association_id_name_key" ON "welfare_funds"("association_id", "name");

-- CreateIndex
CREATE INDEX "welfare_contributions_association_id_fund_id_idx" ON "welfare_contributions"("association_id", "fund_id");

-- CreateIndex
CREATE INDEX "welfare_contributions_member_id_idx" ON "welfare_contributions"("member_id");

-- CreateIndex
CREATE INDEX "welfare_contributions_contribution_date_idx" ON "welfare_contributions"("contribution_date");

-- CreateIndex
CREATE INDEX "welfare_contributions_status_idx" ON "welfare_contributions"("status");

-- CreateIndex
CREATE INDEX "welfare_payout_requests_association_id_status_idx" ON "welfare_payout_requests"("association_id", "status");

-- CreateIndex
CREATE INDEX "welfare_payout_requests_fund_id_idx" ON "welfare_payout_requests"("fund_id");

-- CreateIndex
CREATE INDEX "welfare_payout_requests_member_id_idx" ON "welfare_payout_requests"("member_id");

-- CreateIndex
CREATE INDEX "welfare_payout_requests_requested_at_idx" ON "welfare_payout_requests"("requested_at");

-- CreateIndex
CREATE UNIQUE INDEX "welfare_payout_requests_association_id_request_number_key" ON "welfare_payout_requests"("association_id", "request_number");

-- CreateIndex
CREATE INDEX "sms_messages_association_id_status_idx" ON "sms_messages"("association_id", "status");

-- CreateIndex
CREATE INDEX "sms_messages_campaign_id_idx" ON "sms_messages"("campaign_id");

-- CreateIndex
CREATE INDEX "sms_messages_member_id_idx" ON "sms_messages"("member_id");

-- CreateIndex
CREATE INDEX "sms_messages_sent_at_idx" ON "sms_messages"("sent_at");

-- CreateIndex
CREATE INDEX "sms_campaigns_association_id_status_idx" ON "sms_campaigns"("association_id", "status");

-- CreateIndex
CREATE INDEX "sms_campaigns_scheduled_at_idx" ON "sms_campaigns"("scheduled_at");

-- CreateIndex
CREATE INDEX "sms_templates_association_id_category_idx" ON "sms_templates"("association_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "sms_templates_association_id_name_key" ON "sms_templates"("association_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "sms_credit_balances_association_id_key" ON "sms_credit_balances"("association_id");

-- CreateIndex
CREATE INDEX "sms_credit_transactions_balance_id_type_idx" ON "sms_credit_transactions"("balance_id", "type");

-- CreateIndex
CREATE INDEX "sms_credit_transactions_created_at_idx" ON "sms_credit_transactions"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sms_credits_purchases_reference_key" ON "sms_credits_purchases"("reference");

-- CreateIndex
CREATE INDEX "sms_credits_purchases_association_id_idx" ON "sms_credits_purchases"("association_id");

-- CreateIndex
CREATE INDEX "sms_credits_purchases_reference_idx" ON "sms_credits_purchases"("reference");

-- CreateIndex
CREATE INDEX "sms_credits_purchases_status_idx" ON "sms_credits_purchases"("status");

-- CreateIndex
CREATE INDEX "ai_audit_logs_association_id_created_at_idx" ON "ai_audit_logs"("association_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_audit_logs_user_id_idx" ON "ai_audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "ai_audit_logs_prompt_type_idx" ON "ai_audit_logs"("prompt_type");

-- CreateIndex
CREATE INDEX "ai_audit_logs_status_idx" ON "ai_audit_logs"("status");

-- CreateIndex
CREATE INDEX "document_embeddings_association_id_document_type_idx" ON "document_embeddings"("association_id", "document_type");

-- CreateIndex
CREATE INDEX "document_embeddings_association_id_is_processed_idx" ON "document_embeddings"("association_id", "is_processed");

-- CreateIndex
CREATE INDEX "elections_association_id_status_idx" ON "elections"("association_id", "status");

-- CreateIndex
CREATE INDEX "elections_association_id_voting_start_date_idx" ON "elections"("association_id", "voting_start_date");

-- CreateIndex
CREATE INDEX "elections_voting_start_date_voting_end_date_idx" ON "elections"("voting_start_date", "voting_end_date");

-- CreateIndex
CREATE INDEX "election_positions_election_id_idx" ON "election_positions"("election_id");

-- CreateIndex
CREATE UNIQUE INDEX "election_positions_election_id_order_number_key" ON "election_positions"("election_id", "order_number");

-- CreateIndex
CREATE INDEX "candidates_election_id_status_idx" ON "candidates"("election_id", "status");

-- CreateIndex
CREATE INDEX "candidates_position_id_idx" ON "candidates"("position_id");

-- CreateIndex
CREATE INDEX "candidates_member_id_idx" ON "candidates"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_election_id_position_id_member_id_key" ON "candidates"("election_id", "position_id", "member_id");

-- CreateIndex
CREATE INDEX "votes_election_id_idx" ON "votes"("election_id");

-- CreateIndex
CREATE INDEX "votes_candidate_id_idx" ON "votes"("candidate_id");

-- CreateIndex
CREATE INDEX "votes_voter_id_idx" ON "votes"("voter_id");

-- CreateIndex
CREATE UNIQUE INDEX "votes_election_id_position_id_voter_id_key" ON "votes"("election_id", "position_id", "voter_id");

-- CreateIndex
CREATE INDEX "polls_association_id_status_idx" ON "polls"("association_id", "status");

-- CreateIndex
CREATE INDEX "polls_association_id_start_date_idx" ON "polls"("association_id", "start_date");

-- CreateIndex
CREATE INDEX "polls_start_date_end_date_idx" ON "polls"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "poll_options_poll_id_idx" ON "poll_options"("poll_id");

-- CreateIndex
CREATE UNIQUE INDEX "poll_options_poll_id_order_number_key" ON "poll_options"("poll_id", "order_number");

-- CreateIndex
CREATE INDEX "poll_responses_poll_id_idx" ON "poll_responses"("poll_id");

-- CreateIndex
CREATE INDEX "poll_responses_option_id_idx" ON "poll_responses"("option_id");

-- CreateIndex
CREATE INDEX "poll_responses_responder_id_idx" ON "poll_responses"("responder_id");

-- CreateIndex
CREATE UNIQUE INDEX "poll_responses_poll_id_option_id_responder_id_key" ON "poll_responses"("poll_id", "option_id", "responder_id");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE INDEX "permissions_module_idx" ON "permissions"("module");

-- CreateIndex
CREATE INDEX "permissions_is_active_idx" ON "permissions"("is_active");

-- CreateIndex
CREATE INDEX "roles_association_id_is_active_idx" ON "roles"("association_id", "is_active");

-- CreateIndex
CREATE INDEX "roles_is_system_role_idx" ON "roles"("is_system_role");

-- CreateIndex
CREATE UNIQUE INDEX "roles_association_id_name_key" ON "roles"("association_id", "name");

-- CreateIndex
CREATE INDEX "role_permissions_role_id_idx" ON "role_permissions"("role_id");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE INDEX "user_roles_user_id_association_id_idx" ON "user_roles"("user_id", "association_id");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- CreateIndex
CREATE INDEX "user_roles_association_id_idx" ON "user_roles"("association_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_association_id_key" ON "user_roles"("user_id", "role_id", "association_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_modules_code_key" ON "platform_modules"("code");

-- CreateIndex
CREATE INDEX "platform_modules_is_core_idx" ON "platform_modules"("is_core");

-- CreateIndex
CREATE UNIQUE INDEX "platform_features_code_key" ON "platform_features"("code");

-- CreateIndex
CREATE INDEX "platform_features_module_id_idx" ON "platform_features"("module_id");

-- CreateIndex
CREATE INDEX "plan_modules_plan_id_idx" ON "plan_modules"("plan_id");

-- CreateIndex
CREATE INDEX "plan_modules_module_id_idx" ON "plan_modules"("module_id");

-- CreateIndex
CREATE UNIQUE INDEX "plan_modules_plan_id_module_id_key" ON "plan_modules"("plan_id", "module_id");

-- CreateIndex
CREATE INDEX "plan_features_plan_id_idx" ON "plan_features"("plan_id");

-- CreateIndex
CREATE INDEX "plan_features_feature_id_idx" ON "plan_features"("feature_id");

-- CreateIndex
CREATE UNIQUE INDEX "plan_features_plan_id_feature_id_key" ON "plan_features"("plan_id", "feature_id");

-- CreateIndex
CREATE INDEX "tenant_modules_association_id_idx" ON "tenant_modules"("association_id");

-- CreateIndex
CREATE INDEX "tenant_modules_module_id_idx" ON "tenant_modules"("module_id");

-- CreateIndex
CREATE INDEX "tenant_modules_expires_at_idx" ON "tenant_modules"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_modules_association_id_module_id_key" ON "tenant_modules"("association_id", "module_id");

-- CreateIndex
CREATE INDEX "tenant_features_association_id_idx" ON "tenant_features"("association_id");

-- CreateIndex
CREATE INDEX "tenant_features_feature_id_idx" ON "tenant_features"("feature_id");

-- CreateIndex
CREATE INDEX "tenant_features_expires_at_idx" ON "tenant_features"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_features_association_id_feature_id_key" ON "tenant_features"("association_id", "feature_id");

-- CreateIndex
CREATE INDEX "billing_overrides_association_id_is_active_idx" ON "billing_overrides"("association_id", "is_active");

-- CreateIndex
CREATE INDEX "billing_overrides_override_type_idx" ON "billing_overrides"("override_type");

-- CreateIndex
CREATE INDEX "billing_overrides_end_date_idx" ON "billing_overrides"("end_date");

-- CreateIndex
CREATE INDEX "platform_action_logs_actor_id_idx" ON "platform_action_logs"("actor_id");

-- CreateIndex
CREATE INDEX "platform_action_logs_action_type_idx" ON "platform_action_logs"("action_type");

-- CreateIndex
CREATE INDEX "platform_action_logs_target_type_idx" ON "platform_action_logs"("target_type");

-- CreateIndex
CREATE INDEX "platform_action_logs_association_id_idx" ON "platform_action_logs"("association_id");

-- CreateIndex
CREATE INDEX "platform_action_logs_created_at_idx" ON "platform_action_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "help_articles_slug_key" ON "help_articles"("slug");

-- CreateIndex
CREATE INDEX "help_articles_category_idx" ON "help_articles"("category");

-- CreateIndex
CREATE INDEX "help_articles_is_published_is_featured_idx" ON "help_articles"("is_published", "is_featured");

-- CreateIndex
CREATE INDEX "help_articles_association_id_idx" ON "help_articles"("association_id");

-- CreateIndex
CREATE INDEX "faq_items_category_is_active_idx" ON "faq_items"("category", "is_active");

-- CreateIndex
CREATE INDEX "faq_items_association_id_idx" ON "faq_items"("association_id");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_ticket_number_key" ON "support_tickets"("ticket_number");

-- CreateIndex
CREATE INDEX "support_tickets_association_id_status_idx" ON "support_tickets"("association_id", "status");

-- CreateIndex
CREATE INDEX "support_tickets_user_id_idx" ON "support_tickets"("user_id");

-- CreateIndex
CREATE INDEX "support_tickets_assigned_to_id_idx" ON "support_tickets"("assigned_to_id");

-- CreateIndex
CREATE INDEX "support_tickets_category_idx" ON "support_tickets"("category");

-- CreateIndex
CREATE INDEX "support_tickets_priority_idx" ON "support_tickets"("priority");

-- CreateIndex
CREATE INDEX "support_tickets_created_at_idx" ON "support_tickets"("created_at");

-- CreateIndex
CREATE INDEX "ticket_responses_ticket_id_idx" ON "ticket_responses"("ticket_id");

-- CreateIndex
CREATE INDEX "ticket_responses_user_id_idx" ON "ticket_responses"("user_id");

-- CreateIndex
CREATE INDEX "ticket_attachments_ticket_id_idx" ON "ticket_attachments"("ticket_id");

-- CreateIndex
CREATE INDEX "ticket_attachments_response_id_idx" ON "ticket_attachments"("response_id");

-- CreateIndex
CREATE INDEX "webhook_event_logs_association_id_status_idx" ON "webhook_event_logs"("association_id", "status");

-- CreateIndex
CREATE INDEX "webhook_event_logs_association_id_event_type_idx" ON "webhook_event_logs"("association_id", "event_type");

-- CreateIndex
CREATE INDEX "webhook_event_logs_association_id_source_idx" ON "webhook_event_logs"("association_id", "source");

-- CreateIndex
CREATE INDEX "webhook_event_logs_association_id_created_at_idx" ON "webhook_event_logs"("association_id", "created_at");

-- CreateIndex
CREATE INDEX "webhook_event_logs_is_test_idx" ON "webhook_event_logs"("is_test");

-- CreateIndex
CREATE INDEX "associations_deleted_at_idx" ON "associations"("deleted_at");

-- CreateIndex
CREATE INDEX "associations_is_platform_association_idx" ON "associations"("is_platform_association");

-- CreateIndex
CREATE INDEX "export_history_association_id_type_idx" ON "export_history"("association_id", "type");

-- CreateIndex
CREATE INDEX "export_history_expires_at_idx" ON "export_history"("expires_at");

-- CreateIndex
CREATE INDEX "members_association_id_category_idx" ON "members"("association_id", "category");

-- CreateIndex
CREATE INDEX "members_association_id_created_at_idx" ON "members"("association_id", "created_at");

-- CreateIndex
CREATE INDEX "members_email_idx" ON "members"("email");

-- CreateIndex
CREATE INDEX "payments_transaction_id_idx" ON "payments"("transaction_id");

-- CreateIndex
CREATE INDEX "payments_association_id_created_at_idx" ON "payments"("association_id", "created_at");

-- CreateIndex
CREATE INDEX "transactions_association_id_member_id_idx" ON "transactions"("association_id", "member_id");

-- CreateIndex
CREATE INDEX "transactions_association_id_category_id_idx" ON "transactions"("association_id", "category_id");

-- CreateIndex
CREATE INDEX "transactions_association_id_created_at_idx" ON "transactions"("association_id", "created_at");

-- CreateIndex
CREATE INDEX "transactions_association_id_due_date_idx" ON "transactions"("association_id", "due_date");

-- CreateIndex
CREATE INDEX "transactions_member_id_status_idx" ON "transactions"("member_id", "status");

-- AddForeignKey
ALTER TABLE "export_history" ADD CONSTRAINT "export_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "levy_campaigns" ADD CONSTRAINT "levy_campaigns_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "levy_campaigns" ADD CONSTRAINT "levy_campaigns_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "financial_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "levy_campaign_assignments" ADD CONSTRAINT "levy_campaign_assignments_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "levy_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "levy_campaign_assignments" ADD CONSTRAINT "levy_campaign_assignments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "levy_campaign_assignments" ADD CONSTRAINT "levy_campaign_assignments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donation_allocations" ADD CONSTRAINT "donation_allocations_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donation_records" ADD CONSTRAINT "donation_records_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donation_records" ADD CONSTRAINT "donation_records_allocation_id_fkey" FOREIGN KEY ("allocation_id") REFERENCES "donation_allocations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalty_rules" ADD CONSTRAINT "penalty_rules_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalty_rules" ADD CONSTRAINT "penalty_rules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "financial_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applied_penalties" ADD CONSTRAINT "applied_penalties_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "penalty_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applied_penalties" ADD CONSTRAINT "applied_penalties_source_transaction_id_fkey" FOREIGN KEY ("source_transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applied_penalties" ADD CONSTRAINT "applied_penalties_penalty_transaction_id_fkey" FOREIGN KEY ("penalty_transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalty_waivers" ADD CONSTRAINT "penalty_waivers_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalty_waivers" ADD CONSTRAINT "penalty_waivers_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "chart_of_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "chart_of_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "chart_of_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "association_bank_accounts" ADD CONSTRAINT "association_bank_accounts_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transfers" ADD CONSTRAINT "bank_transfers_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transfers" ADD CONSTRAINT "bank_transfers_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transfers" ADD CONSTRAINT "bank_transfers_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "association_bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transfers" ADD CONSTRAINT "bank_transfers_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transfers" ADD CONSTRAINT "bank_transfers_reconciliation_id_fkey" FOREIGN KEY ("reconciliation_id") REFERENCES "payment_reconciliations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_imports" ADD CONSTRAINT "bank_statement_imports_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_imports" ADD CONSTRAINT "bank_statement_imports_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "association_bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_entries" ADD CONSTRAINT "bank_statement_entries_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "bank_statement_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reconciliations" ADD CONSTRAINT "payment_reconciliations_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reconciliations" ADD CONSTRAINT "payment_reconciliations_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_bank_transfer_id_fkey" FOREIGN KEY ("bank_transfer_id") REFERENCES "bank_transfers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "savings_accounts" ADD CONSTRAINT "savings_accounts_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "savings_accounts" ADD CONSTRAINT "savings_accounts_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "savings_transactions" ADD CONSTRAINT "savings_transactions_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "savings_transactions" ADD CONSTRAINT "savings_transactions_savings_account_id_fkey" FOREIGN KEY ("savings_account_id") REFERENCES "savings_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "savings_transactions" ADD CONSTRAINT "savings_transactions_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_products" ADD CONSTRAINT "loan_products_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_loan_product_id_fkey" FOREIGN KEY ("loan_product_id") REFERENCES "loan_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_guarantors" ADD CONSTRAINT "loan_guarantors_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_guarantors" ADD CONSTRAINT "loan_guarantors_loan_application_id_fkey" FOREIGN KEY ("loan_application_id") REFERENCES "loan_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_guarantors" ADD CONSTRAINT "loan_guarantors_guarantor_member_id_fkey" FOREIGN KEY ("guarantor_member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_loan_product_id_fkey" FOREIGN KEY ("loan_product_id") REFERENCES "loan_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_repayment_schedule" ADD CONSTRAINT "loan_repayment_schedule_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_schedule_item_id_fkey" FOREIGN KEY ("schedule_item_id") REFERENCES "loan_repayment_schedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_financial_ledger" ADD CONSTRAINT "member_financial_ledger_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_financial_ledger" ADD CONSTRAINT "member_financial_ledger_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_agenda" ADD CONSTRAINT "meeting_agenda_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_attendance" ADD CONSTRAINT "meeting_attendance_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_attendance" ADD CONSTRAINT "meeting_attendance_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_attendance" ADD CONSTRAINT "meeting_attendance_marked_by_fkey" FOREIGN KEY ("marked_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_minutes" ADD CONSTRAINT "meeting_minutes_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_minutes" ADD CONSTRAINT "meeting_minutes_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_minutes" ADD CONSTRAINT "meeting_minutes_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "welfare_funds" ADD CONSTRAINT "welfare_funds_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "welfare_funds" ADD CONSTRAINT "welfare_funds_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "welfare_contributions" ADD CONSTRAINT "welfare_contributions_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "welfare_contributions" ADD CONSTRAINT "welfare_contributions_fund_id_fkey" FOREIGN KEY ("fund_id") REFERENCES "welfare_funds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "welfare_contributions" ADD CONSTRAINT "welfare_contributions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "welfare_contributions" ADD CONSTRAINT "welfare_contributions_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "welfare_payout_requests" ADD CONSTRAINT "welfare_payout_requests_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "welfare_payout_requests" ADD CONSTRAINT "welfare_payout_requests_fund_id_fkey" FOREIGN KEY ("fund_id") REFERENCES "welfare_funds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "welfare_payout_requests" ADD CONSTRAINT "welfare_payout_requests_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "welfare_payout_requests" ADD CONSTRAINT "welfare_payout_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "welfare_payout_requests" ADD CONSTRAINT "welfare_payout_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "welfare_payout_requests" ADD CONSTRAINT "welfare_payout_requests_disbursed_by_fkey" FOREIGN KEY ("disbursed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "sms_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_campaigns" ADD CONSTRAINT "sms_campaigns_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_campaigns" ADD CONSTRAINT "sms_campaigns_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "sms_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_templates" ADD CONSTRAINT "sms_templates_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_credit_balances" ADD CONSTRAINT "sms_credit_balances_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_credit_transactions" ADD CONSTRAINT "sms_credit_transactions_balance_id_fkey" FOREIGN KEY ("balance_id") REFERENCES "sms_credit_balances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_credits_purchases" ADD CONSTRAINT "sms_credits_purchases_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_credits_purchases" ADD CONSTRAINT "sms_credits_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_audit_logs" ADD CONSTRAINT "ai_audit_logs_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_audit_logs" ADD CONSTRAINT "ai_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_embeddings" ADD CONSTRAINT "document_embeddings_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elections" ADD CONSTRAINT "elections_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elections" ADD CONSTRAINT "elections_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elections" ADD CONSTRAINT "elections_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elections" ADD CONSTRAINT "elections_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "election_positions" ADD CONSTRAINT "election_positions_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "election_positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_nominated_by_fkey" FOREIGN KEY ("nominated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "election_positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_voter_id_fkey" FOREIGN KEY ("voter_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polls" ADD CONSTRAINT "polls_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polls" ADD CONSTRAINT "polls_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_responses" ADD CONSTRAINT "poll_responses_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_responses" ADD CONSTRAINT "poll_responses_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "poll_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_responses" ADD CONSTRAINT "poll_responses_responder_id_fkey" FOREIGN KEY ("responder_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_features" ADD CONSTRAINT "platform_features_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "platform_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_modules" ADD CONSTRAINT "plan_modules_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_modules" ADD CONSTRAINT "plan_modules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "platform_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_features" ADD CONSTRAINT "plan_features_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_features" ADD CONSTRAINT "plan_features_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "platform_features"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_modules" ADD CONSTRAINT "tenant_modules_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_modules" ADD CONSTRAINT "tenant_modules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "platform_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_features" ADD CONSTRAINT "tenant_features_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_features" ADD CONSTRAINT "tenant_features_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "platform_features"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_overrides" ADD CONSTRAINT "billing_overrides_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_articles" ADD CONSTRAINT "help_articles_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faq_items" ADD CONSTRAINT "faq_items_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_responses" ADD CONSTRAINT "ticket_responses_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_responses" ADD CONSTRAINT "ticket_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "ticket_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_event_logs" ADD CONSTRAINT "webhook_event_logs_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
