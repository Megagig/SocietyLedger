-- Who recorded a bank transfer, so the same officer cannot also verify it. Older transfers stay NULL and can be decided by anyone allowed to.
ALTER TABLE "bank_transfers" ADD COLUMN "recorded_by" INTEGER;
