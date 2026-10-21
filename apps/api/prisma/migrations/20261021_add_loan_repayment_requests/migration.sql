-- Phase 4 (F4.2): member loan repayments. A member declares a repayment they paid into the cooperative's bank
-- account with a receipt; it stays PENDING until an officer approves it, and only approval records the real
-- loan_repayments row (which also releases the matching share of any savings held against the loan).

-- CreateEnum
CREATE TYPE "LoanRepaymentRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "loan_repayment_requests" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "loan_id" INTEGER NOT NULL,
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
    "status" "LoanRepaymentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" INTEGER,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "loan_repayment_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_repayment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "loan_repayment_requests_association_id_status_idx" ON "loan_repayment_requests"("association_id", "status");

-- CreateIndex
CREATE INDEX "loan_repayment_requests_member_id_idx" ON "loan_repayment_requests"("member_id");

-- CreateIndex
CREATE INDEX "loan_repayment_requests_loan_id_idx" ON "loan_repayment_requests"("loan_id");

-- AddForeignKey
ALTER TABLE "loan_repayment_requests" ADD CONSTRAINT "loan_repayment_requests_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_repayment_requests" ADD CONSTRAINT "loan_repayment_requests_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_repayment_requests" ADD CONSTRAINT "loan_repayment_requests_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
