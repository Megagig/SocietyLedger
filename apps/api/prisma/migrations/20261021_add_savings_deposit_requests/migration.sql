-- Phase 4 (F4.1): member savings deposits. A member declares a deposit they paid into the cooperative's
-- bank account with a receipt; it stays PENDING until an officer approves it, and only approval creates the
-- real savings_transactions row and raises the balance.

-- CreateEnum
CREATE TYPE "SavingsDepositStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "savings_deposit_requests" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "savings_account_id" INTEGER NOT NULL,
    "member_id" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "bank_account_id" INTEGER,
    "reference" TEXT,
    "member_note" TEXT,
    "filename" TEXT NOT NULL,
    "filepath" TEXT NOT NULL,
    "file_size" INTEGER,
    "mime_type" TEXT,
    "status" "SavingsDepositStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" INTEGER,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "savings_transaction_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "savings_deposit_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "savings_deposit_requests_association_id_status_idx" ON "savings_deposit_requests"("association_id", "status");

-- CreateIndex
CREATE INDEX "savings_deposit_requests_member_id_idx" ON "savings_deposit_requests"("member_id");

-- CreateIndex
CREATE INDEX "savings_deposit_requests_savings_account_id_idx" ON "savings_deposit_requests"("savings_account_id");

-- AddForeignKey
ALTER TABLE "savings_deposit_requests" ADD CONSTRAINT "savings_deposit_requests_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "savings_deposit_requests" ADD CONSTRAINT "savings_deposit_requests_savings_account_id_fkey" FOREIGN KEY ("savings_account_id") REFERENCES "savings_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "savings_deposit_requests" ADD CONSTRAINT "savings_deposit_requests_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
