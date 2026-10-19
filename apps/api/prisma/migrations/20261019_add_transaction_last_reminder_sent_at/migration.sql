-- R3.4/G43: tracks when the last automated payment reminder was sent, so the
-- daily job doesn't re-send the same reminder more than once per day.
-- This column was added to schema.prisma without a corresponding migration,
-- causing production (which runs `prisma migrate deploy`, not `db push`) to
-- drift from the schema — P2022 errors on any query touching Transaction.
ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "last_reminder_sent_at" TIMESTAMP(3);
