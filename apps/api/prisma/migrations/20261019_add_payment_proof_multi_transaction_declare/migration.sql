-- R7.2 (G17): a member can self-declare a Cash/Card/POS payment with no file
-- (a written declaration instead), and may cover several outstanding
-- transactions in one payment-proof entry. These columns were added to
-- schema.prisma without a corresponding migration, so production (which only
-- ever runs `prisma migrate deploy`) never got them — causing P2022 on any
-- query touching PaymentProof.
ALTER TABLE "payment_proofs"
  ALTER COLUMN "filename" DROP NOT NULL,
  ALTER COLUMN "filepath" DROP NOT NULL,
  ALTER COLUMN "file_size" DROP NOT NULL,
  ALTER COLUMN "mime_type" DROP NOT NULL;

ALTER TABLE "payment_proofs"
  ADD COLUMN IF NOT EXISTS "transaction_ids" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN IF NOT EXISTS "declaration_note" TEXT,
  ADD COLUMN IF NOT EXISTS "payment_method" TEXT;
