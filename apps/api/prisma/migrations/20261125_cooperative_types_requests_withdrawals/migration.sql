-- Cooperative enhancements: officer-defined account types and loan categories, batched payment requests (one transfer, one proof),
-- and two-stage withdrawal requests. Existing data is carried over so nothing a member can see today disappears.

-- CreateEnum
CREATE TYPE "CooperativeAccountClass" AS ENUM ('CONTRIBUTION', 'SHARES', 'SPECIAL');

-- CreateEnum
CREATE TYPE "WithdrawalRequestStatus" AS ENUM ('PENDING_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "savings_accounts" ADD COLUMN "account_type_id" INTEGER;

-- AlterTable
ALTER TABLE "loan_products" ADD COLUMN "loan_category_id" INTEGER;

-- AlterTable
ALTER TABLE "loan_applications" ADD COLUMN "item_description" TEXT;

-- CreateTable
CREATE TABLE "cooperative_account_types" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "account_class" "CooperativeAccountClass" NOT NULL DEFAULT 'CONTRIBUTION',
    "default_monthly_amount" DECIMAL(12,2),
    "is_withdrawable" BOOLEAN NOT NULL DEFAULT true,
    "monthly_withdrawal_limit" DECIMAL(12,2),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cooperative_account_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_categories" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_goods" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cooperative_payment_requests" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "member_id" INTEGER NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "bank_account_id" INTEGER,
    "reference" TEXT,
    "member_note" TEXT,
    "filename" TEXT NOT NULL,
    "filepath" TEXT NOT NULL,
    "file_size" INTEGER,
    "mime_type" TEXT,
    "status" "SavingsDepositStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" INTEGER,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cooperative_payment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cooperative_payment_lines" (
    "id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "account_type_id" INTEGER NOT NULL,
    "savings_account_id" INTEGER,
    "amount" DECIMAL(12,2) NOT NULL,
    "period_month" INTEGER NOT NULL,
    "period_year" INTEGER NOT NULL,
    "savings_transaction_id" INTEGER,

    CONSTRAINT "cooperative_payment_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "savings_withdrawal_requests" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "member_id" INTEGER NOT NULL,
    "savings_account_id" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "status" "WithdrawalRequestStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "two_stage" BOOLEAN NOT NULL DEFAULT true,
    "reviewed_by" INTEGER,
    "reviewed_at" TIMESTAMP(3),
    "review_comment" TEXT,
    "approved_by" INTEGER,
    "approved_at" TIMESTAMP(3),
    "approval_comment" TEXT,
    "rejected_by" INTEGER,
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "payout_method" TEXT,
    "payout_reference" TEXT,
    "savings_transaction_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "savings_withdrawal_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cooperative_account_types_association_id_name_key" ON "cooperative_account_types"("association_id", "name");
CREATE INDEX "cooperative_account_types_association_id_is_active_idx" ON "cooperative_account_types"("association_id", "is_active");
CREATE UNIQUE INDEX "loan_categories_association_id_name_key" ON "loan_categories"("association_id", "name");
CREATE INDEX "loan_categories_association_id_is_active_idx" ON "loan_categories"("association_id", "is_active");
CREATE INDEX "cooperative_payment_requests_association_id_status_idx" ON "cooperative_payment_requests"("association_id", "status");
CREATE INDEX "cooperative_payment_requests_member_id_idx" ON "cooperative_payment_requests"("member_id");
CREATE INDEX "cooperative_payment_lines_request_id_idx" ON "cooperative_payment_lines"("request_id");
CREATE INDEX "cooperative_payment_lines_savings_account_id_period_year_pe_idx" ON "cooperative_payment_lines"("savings_account_id", "period_year", "period_month");
CREATE INDEX "savings_withdrawal_requests_association_id_status_idx" ON "savings_withdrawal_requests"("association_id", "status");
CREATE INDEX "savings_withdrawal_requests_member_id_idx" ON "savings_withdrawal_requests"("member_id");
CREATE INDEX "savings_withdrawal_requests_savings_account_id_status_idx" ON "savings_withdrawal_requests"("savings_account_id", "status");
CREATE INDEX "savings_accounts_account_type_id_idx" ON "savings_accounts"("account_type_id");

-- AddForeignKey
ALTER TABLE "savings_accounts" ADD CONSTRAINT "savings_accounts_account_type_id_fkey" FOREIGN KEY ("account_type_id") REFERENCES "cooperative_account_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "loan_products" ADD CONSTRAINT "loan_products_loan_category_id_fkey" FOREIGN KEY ("loan_category_id") REFERENCES "loan_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cooperative_account_types" ADD CONSTRAINT "cooperative_account_types_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "loan_categories" ADD CONSTRAINT "loan_categories_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cooperative_payment_requests" ADD CONSTRAINT "cooperative_payment_requests_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cooperative_payment_requests" ADD CONSTRAINT "cooperative_payment_requests_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cooperative_payment_lines" ADD CONSTRAINT "cooperative_payment_lines_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "cooperative_payment_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cooperative_payment_lines" ADD CONSTRAINT "cooperative_payment_lines_account_type_id_fkey" FOREIGN KEY ("account_type_id") REFERENCES "cooperative_account_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cooperative_payment_lines" ADD CONSTRAINT "cooperative_payment_lines_savings_account_id_fkey" FOREIGN KEY ("savings_account_id") REFERENCES "savings_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "savings_withdrawal_requests" ADD CONSTRAINT "savings_withdrawal_requests_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "savings_withdrawal_requests" ADD CONSTRAINT "savings_withdrawal_requests_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "savings_withdrawal_requests" ADD CONSTRAINT "savings_withdrawal_requests_savings_account_id_fkey" FOREIGN KEY ("savings_account_id") REFERENCES "savings_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===== Backfill =====

-- 1. One account type per old enum value that an association actually uses. All keep the CONTRIBUTION class and stay withdrawable, so
--    behaviour does not change for existing accounts.
INSERT INTO "cooperative_account_types" ("association_id", "name", "account_class", "sort_order", "updated_at")
SELECT DISTINCT sa."association_id",
       CASE sa."account_type"
         WHEN 'REGULAR' THEN 'Ordinary Savings'
         WHEN 'THRIFT' THEN 'Thrift Savings'
         WHEN 'TARGET' THEN 'Target Savings'
         WHEN 'FIXED_DEPOSIT' THEN 'Fixed Deposit'
       END,
       'CONTRIBUTION'::"CooperativeAccountClass",
       CASE sa."account_type" WHEN 'REGULAR' THEN 0 WHEN 'THRIFT' THEN 1 WHEN 'TARGET' THEN 2 ELSE 3 END,
       CURRENT_TIMESTAMP
FROM "savings_accounts" sa
ON CONFLICT ("association_id", "name") DO NOTHING;

UPDATE "savings_accounts" sa
SET "account_type_id" = t."id"
FROM "cooperative_account_types" t
WHERE t."association_id" = sa."association_id"
  AND t."name" = CASE sa."account_type"
         WHEN 'REGULAR' THEN 'Ordinary Savings'
         WHEN 'THRIFT' THEN 'Thrift Savings'
         WHEN 'TARGET' THEN 'Target Savings'
         WHEN 'FIXED_DEPOSIT' THEN 'Fixed Deposit'
       END;

-- 2. A default "Normal Loans" category for every association that already has loan products, and attach those products to it.
INSERT INTO "loan_categories" ("association_id", "name", "is_goods", "sort_order", "updated_at")
SELECT DISTINCT lp."association_id", 'Normal Loans', false, 0, CURRENT_TIMESTAMP
FROM "loan_products" lp
ON CONFLICT ("association_id", "name") DO NOTHING;

UPDATE "loan_products" lp
SET "loan_category_id" = c."id"
FROM "loan_categories" c
WHERE c."association_id" = lp."association_id" AND c."name" = 'Normal Loans';

-- 3. Carry every old single-account deposit request over as a payment request with one line (the month the payment was made in).
--    The old table is left in place; the application stops reading and writing it, and a later migration drops it.
ALTER TABLE "cooperative_payment_requests" ADD COLUMN "legacy_deposit_id" INTEGER;

INSERT INTO "cooperative_payment_requests"
  ("association_id", "member_id", "total_amount", "payment_date", "bank_account_id", "reference", "member_note", "filename", "filepath",
   "file_size", "mime_type", "status", "reviewed_by", "reviewed_at", "rejection_reason", "created_at", "updated_at", "legacy_deposit_id")
SELECT d."association_id", d."member_id", d."amount", d."payment_date", d."bank_account_id", d."reference", d."member_note", d."filename",
       d."filepath", d."file_size", d."mime_type", d."status", d."reviewed_by", d."reviewed_at", d."rejection_reason", d."created_at",
       d."updated_at", d."id"
FROM "savings_deposit_requests" d;

INSERT INTO "cooperative_payment_lines"
  ("request_id", "account_type_id", "savings_account_id", "amount", "period_month", "period_year", "savings_transaction_id")
SELECT r."id", sa."account_type_id", sa."id", d."amount", EXTRACT(MONTH FROM d."payment_date")::int, EXTRACT(YEAR FROM d."payment_date")::int,
       d."savings_transaction_id"
FROM "savings_deposit_requests" d
JOIN "cooperative_payment_requests" r ON r."legacy_deposit_id" = d."id"
JOIN "savings_accounts" sa ON sa."id" = d."savings_account_id"
WHERE sa."account_type_id" IS NOT NULL;

ALTER TABLE "cooperative_payment_requests" DROP COLUMN "legacy_deposit_id";
