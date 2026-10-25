-- Phase 4 (F4.2): a cooperative sets, per loan product, how much a member must have saved to borrow
-- (the existing max_loan_to_savings_ratio, e.g. 2 = up to twice their savings). When lock_savings is on,
-- disbursing a loan holds principal / ratio of the member's savings (a savings_liens row) until repaid.
-- The savings balance is never debited; available = balance - outstanding liens.

-- CreateEnum
CREATE TYPE "SavingsLienStatus" AS ENUM ('ACTIVE', 'RELEASED');

-- AlterTable
ALTER TABLE "loan_products" ADD COLUMN "lock_savings" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "savings_liens" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "member_id" INTEGER NOT NULL,
    "loan_id" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "released_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "SavingsLienStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "savings_liens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "savings_liens_loan_id_key" ON "savings_liens"("loan_id");

-- CreateIndex
CREATE INDEX "savings_liens_association_id_member_id_status_idx" ON "savings_liens"("association_id", "member_id", "status");

-- AddForeignKey
ALTER TABLE "savings_liens" ADD CONSTRAINT "savings_liens_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "savings_liens" ADD CONSTRAINT "savings_liens_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "savings_liens" ADD CONSTRAINT "savings_liens_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
