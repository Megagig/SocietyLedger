-- 1. Fixed-deposit and target accounts were carried over as ordinary withdrawable savings, so members could ask to withdraw money
--    that was meant to be locked. Make the migrated types non-withdrawable; officers can re-enable a type deliberately in Setup.
UPDATE "cooperative_account_types"
SET "is_withdrawable" = false, "updated_at" = NOW()
WHERE "name" IN ('Target Savings', 'Fixed Deposit') AND "account_class" = 'CONTRIBUTION';

-- 2. One open withdrawal per account, enforced by the database so two requests racing each other cannot both get in.
CREATE UNIQUE INDEX "savings_withdrawal_requests_one_open_per_account"
  ON "savings_withdrawal_requests" ("savings_account_id")
  WHERE "status" IN ('PENDING_REVIEW', 'PENDING_APPROVAL');

-- 3. The old deposit-request table is retired: its rows were copied into payment requests by 20261125 and nothing reads it now.
DROP TABLE "savings_deposit_requests";
