-- Expense vouchers: spending recorded after it is paid, approved by a second officer, then posted to the books.
DO $$ BEGIN
  CREATE TYPE "ExpenseStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'VOIDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "expense_vouchers" (
  "id" SERIAL PRIMARY KEY,
  "association_id" INTEGER NOT NULL,
  "voucher_number" TEXT NOT NULL,
  "expense_date" TIMESTAMP(3) NOT NULL,
  "payee" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "category_account_id" INTEGER NOT NULL,
  "paid_from_account_id" INTEGER NOT NULL,
  "reference" TEXT,
  "no_receipt_reason" TEXT,
  "receipt_key" TEXT,
  "receipt_type" TEXT,
  "status" "ExpenseStatus" NOT NULL DEFAULT 'DRAFT',
  "created_by" INTEGER NOT NULL,
  "submitted_at" TIMESTAMP(3),
  "approved_by" INTEGER,
  "approved_at" TIMESTAMP(3),
  "over_budget" BOOLEAN NOT NULL DEFAULT false,
  "rejected_by" INTEGER,
  "rejected_at" TIMESTAMP(3),
  "rejection_reason" TEXT,
  "voided_by" INTEGER,
  "voided_at" TIMESTAMP(3),
  "void_reason" TEXT,
  "journal_entry_id" INTEGER,
  "reversal_entry_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "expense_vouchers_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "expense_vouchers_category_account_id_fkey" FOREIGN KEY ("category_account_id") REFERENCES "chart_of_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "expense_vouchers_paid_from_account_id_fkey" FOREIGN KEY ("paid_from_account_id") REFERENCES "chart_of_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "expense_vouchers_association_id_voucher_number_key" ON "expense_vouchers"("association_id", "voucher_number");
CREATE INDEX IF NOT EXISTS "expense_vouchers_association_id_status_idx" ON "expense_vouchers"("association_id", "status");
CREATE INDEX IF NOT EXISTS "expense_vouchers_association_id_expense_date_idx" ON "expense_vouchers"("association_id", "expense_date");
CREATE INDEX IF NOT EXISTS "expense_vouchers_category_account_id_idx" ON "expense_vouchers"("category_account_id");
