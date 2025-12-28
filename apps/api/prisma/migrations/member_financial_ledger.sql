-- Member Financial Ledger Migration
-- Single source of truth for member financial activity
-- Append-only ledger for audit trail

-- Create enum types
CREATE TYPE "LedgerEntryType" AS ENUM ('DEBIT', 'CREDIT', 'ADJUSTMENT');
CREATE TYPE "LedgerCategory" AS ENUM (
  'DUES', 
  'LEVY', 
  'PENALTY', 
  'DONATION', 
  'REFUND', 
  'WAIVER', 
  'ADJUSTMENT', 
  'SAVINGS_DEPOSIT', 
  'SAVINGS_WITHDRAWAL', 
  'LOAN_DISBURSEMENT', 
  'LOAN_REPAYMENT', 
  'OTHER'
);

-- Create member_financial_ledger table
CREATE TABLE "member_financial_ledger" (
  "id" SERIAL PRIMARY KEY,
  "association_id" INTEGER NOT NULL,
  "member_id" INTEGER NOT NULL,
  "entry_type" "LedgerEntryType" NOT NULL,
  "category" "LedgerCategory" NOT NULL,
  "amount" DECIMAL(12, 2) NOT NULL,
  "running_balance" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "effective_date" TIMESTAMP(3) NOT NULL,
  "description" TEXT NOT NULL,
  "source_table" TEXT NOT NULL,
  "source_id" INTEGER NOT NULL,
  "reference_number" TEXT,
  "created_by" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign key constraints
  CONSTRAINT "member_financial_ledger_association_id_fkey" 
    FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "member_financial_ledger_member_id_fkey" 
    FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create indexes for performance
CREATE INDEX "member_financial_ledger_association_id_member_id_idx" 
  ON "member_financial_ledger"("association_id", "member_id");

CREATE INDEX "member_financial_ledger_association_id_member_id_effective_date_idx" 
  ON "member_financial_ledger"("association_id", "member_id", "effective_date");

CREATE INDEX "member_financial_ledger_source_table_source_id_idx" 
  ON "member_financial_ledger"("source_table", "source_id");

CREATE INDEX "member_financial_ledger_effective_date_idx" 
  ON "member_financial_ledger"("effective_date");

-- Add comment for documentation
COMMENT ON TABLE "member_financial_ledger" IS 'Append-only ledger tracking all member financial activity for audit trail and reporting';
