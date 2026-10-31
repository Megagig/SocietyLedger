-- Ajo T2: phone-confirmation code fields on memberships, and payout account numbers stored encrypted.
--
-- ajo_payout_accounts has never held a row (no code wrote to it before T2), so replacing the plain-text account_number column with an
-- encrypted one loses nothing. The guard below stops the migration rather than destroy data if that is ever not true.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "ajo_payout_accounts") THEN
    RAISE EXCEPTION 'ajo_payout_accounts has rows; encrypt them before dropping account_number';
  END IF;
END $$;

-- AlterTable
ALTER TABLE "ajo_memberships" ADD COLUMN     "phone_code_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "phone_code_day" DATE,
ADD COLUMN     "phone_code_day_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "phone_code_expires_at" TIMESTAMP(3),
ADD COLUMN     "phone_code_hash" TEXT,
ADD COLUMN     "phone_code_sent_at" TIMESTAMP(3),
ADD COLUMN     "phone_confirmed_number" TEXT;

-- AlterTable
ALTER TABLE "ajo_payout_accounts" DROP COLUMN "account_number",
ADD COLUMN     "account_number_enc" TEXT NOT NULL,
ADD COLUMN     "last4" TEXT NOT NULL;
