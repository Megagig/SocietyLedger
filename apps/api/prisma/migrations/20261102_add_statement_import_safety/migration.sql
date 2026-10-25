-- Bank statement import and reconciliation safety (F6.8)

-- The mapping of a bank's statement columns, remembered per account
ALTER TABLE "association_bank_accounts" ADD COLUMN "statement_mapping" JSONB;

-- Lines that were skipped because they were already imported
ALTER TABLE "bank_statement_imports" ADD COLUMN "skipped_entries" INTEGER NOT NULL DEFAULT 0;

-- The identity of a statement line, so the same line is never imported twice for one bank account
ALTER TABLE "bank_statement_entries" ADD COLUMN "bank_account_id" INTEGER;
ALTER TABLE "bank_statement_entries" ADD COLUMN "fingerprint" TEXT;
ALTER TABLE "bank_statement_entries" ADD CONSTRAINT "bank_statement_entries_bank_account_id_fkey"
  FOREIGN KEY ("bank_account_id") REFERENCES "association_bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "bank_statement_entries_bank_account_id_fingerprint_key" ON "bank_statement_entries"("bank_account_id", "fingerprint");

-- Who proposed a match (they cannot also confirm it)
ALTER TABLE "payment_reconciliations" ADD COLUMN "created_by" INTEGER;

-- One statement line can be matched to one charge at a time. A pending or confirmed match holds the line; a disputed one frees it.
CREATE UNIQUE INDEX "payment_reconciliations_one_live_match_per_line"
  ON "payment_reconciliations"("statement_entry_id")
  WHERE "statement_entry_id" IS NOT NULL AND "status" IN ('PENDING', 'CONFIRMED');
