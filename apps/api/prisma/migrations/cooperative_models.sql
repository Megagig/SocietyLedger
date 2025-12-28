-- ============================================
-- PHASE 8.5: COOPERATIVES & LOANS MODELS
-- Enterprise Feature - Thrift & Savings, Loans, Guarantors
-- ============================================

-- Savings Account Types
CREATE TYPE "SavingsAccountType" AS ENUM ('REGULAR', 'THRIFT', 'TARGET', 'FIXED_DEPOSIT');
CREATE TYPE "SavingsAccountStatus" AS ENUM ('ACTIVE', 'DORMANT', 'CLOSED', 'MATURED');
CREATE TYPE "SavingsTransactionType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'INTEREST', 'TRANSFER_IN', 'TRANSFER_OUT', 'FEE');

-- Loan Types
CREATE TYPE "InterestType" AS ENUM ('FLAT', 'REDUCING_BALANCE', 'COMPOUND');
CREATE TYPE "LoanApplicationStatus" AS ENUM ('DRAFT', 'PENDING_GUARANTORS', 'PENDING_REVIEW', 'UNDER_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'DISBURSED', 'CANCELLED');
CREATE TYPE "GuarantorStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'RELEASED');
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'OVERDUE', 'DEFAULTED', 'PAID_OFF', 'WRITTEN_OFF');
CREATE TYPE "RepaymentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'WAIVED');

-- ==========================================
-- SAVINGS ACCOUNTS
-- ==========================================

CREATE TABLE "savings_accounts" (
    "id" SERIAL PRIMARY KEY,
    "association_id" INTEGER NOT NULL,
    "member_id" INTEGER NOT NULL,
    "account_number" VARCHAR(20) NOT NULL,
    "account_type" "SavingsAccountType" NOT NULL DEFAULT 'REGULAR',
    "balance" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "target_amount" DECIMAL(12, 2),
    "monthly_contribution" DECIMAL(12, 2),
    "interest_rate" DECIMAL(5, 2) NOT NULL DEFAULT 0,
    "accrued_interest" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "total_deposits" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "total_withdrawals" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "status" "SavingsAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "maturity_date" TIMESTAMP,
    "opened_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP,
    "notes" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "fk_savings_association" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE,
    CONSTRAINT "fk_savings_member" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE,
    CONSTRAINT "unique_savings_account_number" UNIQUE ("association_id", "account_number")
);

CREATE INDEX "idx_savings_accounts_association" ON "savings_accounts"("association_id", "status");
CREATE INDEX "idx_savings_accounts_member" ON "savings_accounts"("member_id");

-- ==========================================
-- SAVINGS TRANSACTIONS
-- ==========================================

CREATE TABLE "savings_transactions" (
    "id" SERIAL PRIMARY KEY,
    "association_id" INTEGER NOT NULL,
    "savings_account_id" INTEGER NOT NULL,
    "type" "SavingsTransactionType" NOT NULL,
    "amount" DECIMAL(12, 2) NOT NULL,
    "balance_after" DECIMAL(12, 2) NOT NULL,
    "payment_method" VARCHAR(50),
    "reference" VARCHAR(100),
    "processed_by" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "fk_savings_tx_association" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE,
    CONSTRAINT "fk_savings_tx_account" FOREIGN KEY ("savings_account_id") REFERENCES "savings_accounts"("id") ON DELETE CASCADE,
    CONSTRAINT "fk_savings_tx_processor" FOREIGN KEY ("processed_by") REFERENCES "users"("id")
);

CREATE INDEX "idx_savings_transactions_account" ON "savings_transactions"("savings_account_id");
CREATE INDEX "idx_savings_transactions_date" ON "savings_transactions"("created_at");

-- ==========================================
-- LOAN PRODUCTS
-- ==========================================

CREATE TABLE "loan_products" (
    "id" SERIAL PRIMARY KEY,
    "association_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "min_amount" DECIMAL(12, 2) NOT NULL,
    "max_amount" DECIMAL(12, 2) NOT NULL,
    "interest_rate" DECIMAL(5, 2) NOT NULL,
    "interest_type" "InterestType" NOT NULL DEFAULT 'REDUCING_BALANCE',
    "min_tenure_months" INTEGER NOT NULL,
    "max_tenure_months" INTEGER NOT NULL,
    "processing_fee_percent" DECIMAL(5, 2) NOT NULL DEFAULT 0,
    "processing_fee_fixed" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "requires_guarantor" BOOLEAN NOT NULL DEFAULT true,
    "min_guarantors" INTEGER NOT NULL DEFAULT 1,
    "max_loan_to_savings_ratio" DECIMAL(5, 2),
    "grace_period_days" INTEGER NOT NULL DEFAULT 0,
    "late_fee_percent" DECIMAL(5, 2) NOT NULL DEFAULT 0,
    "late_fee_fixed" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "fk_loan_product_association" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE,
    CONSTRAINT "unique_loan_product_name" UNIQUE ("association_id", "name")
);

CREATE INDEX "idx_loan_products_association" ON "loan_products"("association_id", "is_active");

-- ==========================================
-- LOAN APPLICATIONS
-- ==========================================

CREATE TABLE "loan_applications" (
    "id" SERIAL PRIMARY KEY,
    "association_id" INTEGER NOT NULL,
    "application_number" VARCHAR(20) NOT NULL,
    "member_id" INTEGER NOT NULL,
    "loan_product_id" INTEGER NOT NULL,
    "amount" DECIMAL(12, 2) NOT NULL,
    "tenure_months" INTEGER NOT NULL,
    "interest_rate" DECIMAL(5, 2) NOT NULL,
    "interest_type" "InterestType" NOT NULL,
    "monthly_repayment" DECIMAL(12, 2) NOT NULL,
    "total_repayment" DECIMAL(12, 2) NOT NULL,
    "total_interest" DECIMAL(12, 2) NOT NULL,
    "processing_fee" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "purpose" TEXT NOT NULL,
    "status" "LoanApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "collateral_description" TEXT,
    "collateral_value" DECIMAL(12, 2),
    "applied_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by" INTEGER,
    "reviewed_at" TIMESTAMP,
    "review_comments" TEXT,
    "approved_by" INTEGER,
    "approved_at" TIMESTAMP,
    "rejection_reason" TEXT,
    "disbursed_at" TIMESTAMP,
    "cancelled_at" TIMESTAMP,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "fk_loan_app_association" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE,
    CONSTRAINT "fk_loan_app_member" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE,
    CONSTRAINT "fk_loan_app_product" FOREIGN KEY ("loan_product_id") REFERENCES "loan_products"("id"),
    CONSTRAINT "fk_loan_app_reviewer" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id"),
    CONSTRAINT "fk_loan_app_approver" FOREIGN KEY ("approved_by") REFERENCES "users"("id"),
    CONSTRAINT "unique_loan_app_number" UNIQUE ("association_id", "application_number")
);

CREATE INDEX "idx_loan_applications_association" ON "loan_applications"("association_id", "status");
CREATE INDEX "idx_loan_applications_member" ON "loan_applications"("member_id");

-- ==========================================
-- LOAN GUARANTORS
-- ==========================================

CREATE TABLE "loan_guarantors" (
    "id" SERIAL PRIMARY KEY,
    "association_id" INTEGER NOT NULL,
    "loan_application_id" INTEGER NOT NULL,
    "guarantor_member_id" INTEGER NOT NULL,
    "guarantee_amount" DECIMAL(12, 2) NOT NULL,
    "status" "GuarantorStatus" NOT NULL DEFAULT 'PENDING',
    "accepted_at" TIMESTAMP,
    "declined_at" TIMESTAMP,
    "decline_reason" TEXT,
    "released_at" TIMESTAMP,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "fk_guarantor_association" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE,
    CONSTRAINT "fk_guarantor_application" FOREIGN KEY ("loan_application_id") REFERENCES "loan_applications"("id") ON DELETE CASCADE,
    CONSTRAINT "fk_guarantor_member" FOREIGN KEY ("guarantor_member_id") REFERENCES "members"("id") ON DELETE CASCADE,
    CONSTRAINT "unique_guarantor_per_loan" UNIQUE ("loan_application_id", "guarantor_member_id")
);

CREATE INDEX "idx_loan_guarantors_application" ON "loan_guarantors"("loan_application_id");
CREATE INDEX "idx_loan_guarantors_member" ON "loan_guarantors"("guarantor_member_id", "status");

-- ==========================================
-- ACTIVE LOANS
-- ==========================================

CREATE TABLE "loans" (
    "id" SERIAL PRIMARY KEY,
    "association_id" INTEGER NOT NULL,
    "loan_number" VARCHAR(20) NOT NULL,
    "application_id" INTEGER NOT NULL,
    "member_id" INTEGER NOT NULL,
    "loan_product_id" INTEGER NOT NULL,
    "principal_amount" DECIMAL(12, 2) NOT NULL,
    "interest_rate" DECIMAL(5, 2) NOT NULL,
    "interest_type" "InterestType" NOT NULL,
    "tenure_months" INTEGER NOT NULL,
    "monthly_repayment" DECIMAL(12, 2) NOT NULL,
    "total_repayment" DECIMAL(12, 2) NOT NULL,
    "total_interest" DECIMAL(12, 2) NOT NULL,
    "processing_fee" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "amount_disbursed" DECIMAL(12, 2) NOT NULL,
    "total_paid" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "principal_paid" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "interest_paid" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "outstanding_balance" DECIMAL(12, 2) NOT NULL,
    "next_payment_date" DATE,
    "next_payment_amount" DECIMAL(12, 2),
    "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "disbursed_at" TIMESTAMP NOT NULL,
    "maturity_date" DATE NOT NULL,
    "closed_at" TIMESTAMP,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "fk_loan_association" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE,
    CONSTRAINT "fk_loan_application" FOREIGN KEY ("application_id") REFERENCES "loan_applications"("id"),
    CONSTRAINT "fk_loan_member" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE,
    CONSTRAINT "fk_loan_product" FOREIGN KEY ("loan_product_id") REFERENCES "loan_products"("id"),
    CONSTRAINT "unique_loan_number" UNIQUE ("association_id", "loan_number"),
    CONSTRAINT "unique_loan_application" UNIQUE ("application_id")
);

CREATE INDEX "idx_loans_association" ON "loans"("association_id", "status");
CREATE INDEX "idx_loans_member" ON "loans"("member_id");
CREATE INDEX "idx_loans_next_payment" ON "loans"("next_payment_date") WHERE "status" = 'ACTIVE';

-- ==========================================
-- LOAN REPAYMENT SCHEDULE
-- ==========================================

CREATE TABLE "loan_repayment_schedule" (
    "id" SERIAL PRIMARY KEY,
    "loan_id" INTEGER NOT NULL,
    "installment_number" INTEGER NOT NULL,
    "due_date" DATE NOT NULL,
    "principal_due" DECIMAL(12, 2) NOT NULL,
    "interest_due" DECIMAL(12, 2) NOT NULL,
    "total_due" DECIMAL(12, 2) NOT NULL,
    "principal_paid" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "interest_paid" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "total_paid" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "late_fee" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "status" "RepaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMP,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "fk_schedule_loan" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE,
    CONSTRAINT "unique_schedule_installment" UNIQUE ("loan_id", "installment_number")
);

CREATE INDEX "idx_loan_schedule_loan" ON "loan_repayment_schedule"("loan_id");
CREATE INDEX "idx_loan_schedule_due" ON "loan_repayment_schedule"("due_date", "status");

-- ==========================================
-- LOAN REPAYMENTS
-- ==========================================

CREATE TABLE "loan_repayments" (
    "id" SERIAL PRIMARY KEY,
    "association_id" INTEGER NOT NULL,
    "loan_id" INTEGER NOT NULL,
    "schedule_item_id" INTEGER,
    "amount" DECIMAL(12, 2) NOT NULL,
    "principal_portion" DECIMAL(12, 2) NOT NULL,
    "interest_portion" DECIMAL(12, 2) NOT NULL,
    "late_fee" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "payment_method" VARCHAR(50) NOT NULL,
    "reference" VARCHAR(100),
    "processed_by" INTEGER NOT NULL,
    "notes" TEXT,
    "paid_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "fk_repayment_association" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE,
    CONSTRAINT "fk_repayment_loan" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE,
    CONSTRAINT "fk_repayment_schedule" FOREIGN KEY ("schedule_item_id") REFERENCES "loan_repayment_schedule"("id"),
    CONSTRAINT "fk_repayment_processor" FOREIGN KEY ("processed_by") REFERENCES "users"("id")
);

CREATE INDEX "idx_loan_repayments_loan" ON "loan_repayments"("loan_id");
CREATE INDEX "idx_loan_repayments_date" ON "loan_repayments"("paid_at");
