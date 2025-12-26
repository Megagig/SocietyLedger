/*
  Warnings:

  - Added the required column `updated_at` to the `payment_history` table without a default value. This is not possible if the table is not empty.
  - Made the column `provider` on table `payment_history` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "payment_history" ADD COLUMN     "access_code" TEXT,
ADD COLUMN     "authorization_url" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "provider" SET NOT NULL,
ALTER COLUMN "provider" SET DEFAULT 'paystack';

-- CreateIndex
CREATE INDEX "payment_history_reference_idx" ON "payment_history"("reference");
