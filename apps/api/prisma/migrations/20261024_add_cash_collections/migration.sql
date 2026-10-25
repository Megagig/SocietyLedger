-- CreateEnum
CREATE TYPE "CashCollectionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "CashReceiptStatus" AS ENUM ('ACTIVE', 'VOIDED');

-- CreateEnum
CREATE TYPE "CashItemKind" AS ENUM ('DUES', 'LEVY', 'SAVINGS', 'WELFARE', 'DONATION', 'LOAN_REPAYMENT');

-- CreateEnum
CREATE TYPE "CashLodgmentStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "cash_collections" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "meeting_id" INTEGER,
    "title" TEXT NOT NULL,
    "collected_by" INTEGER NOT NULL,
    "status" "CashCollectionStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_receipts" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "collection_id" INTEGER NOT NULL,
    "member_id" INTEGER NOT NULL,
    "receipt_number" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "status" "CashReceiptStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" INTEGER NOT NULL,
    "voided_by" INTEGER,
    "voided_at" TIMESTAMP(3),
    "void_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_receipt_items" (
    "id" SERIAL NOT NULL,
    "receipt_id" INTEGER NOT NULL,
    "kind" "CashItemKind" NOT NULL,
    "source_id" INTEGER,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "cash_receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_lodgments" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "bank_account_id" INTEGER NOT NULL,
    "lodged_by" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "expected_amount" DECIMAL(12,2) NOT NULL,
    "shortfall_reason" TEXT,
    "deposit_date" TIMESTAMP(3) NOT NULL,
    "bank_reference" TEXT,
    "slip_key" TEXT,
    "status" "CashLodgmentStatus" NOT NULL DEFAULT 'PENDING',
    "verified_by" INTEGER,
    "verified_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "accounting_entry_id" INTEGER,
    "overdue_notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_lodgments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_lodgment_allocations" (
    "id" SERIAL NOT NULL,
    "lodgment_id" INTEGER NOT NULL,
    "collection_id" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "cash_lodgment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cash_collections_association_id_status_idx" ON "cash_collections"("association_id", "status");

-- CreateIndex
CREATE INDEX "cash_collections_association_id_collected_by_idx" ON "cash_collections"("association_id", "collected_by");

-- CreateIndex
CREATE INDEX "cash_collections_meeting_id_idx" ON "cash_collections"("meeting_id");

-- CreateIndex
CREATE UNIQUE INDEX "cash_receipts_receipt_number_key" ON "cash_receipts"("receipt_number");

-- CreateIndex
CREATE INDEX "cash_receipts_collection_id_status_idx" ON "cash_receipts"("collection_id", "status");

-- CreateIndex
CREATE INDEX "cash_receipts_association_id_member_id_idx" ON "cash_receipts"("association_id", "member_id");

-- CreateIndex
CREATE UNIQUE INDEX "cash_receipts_association_id_idempotency_key_key" ON "cash_receipts"("association_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "cash_receipt_items_receipt_id_idx" ON "cash_receipt_items"("receipt_id");

-- CreateIndex
CREATE INDEX "cash_receipt_items_kind_source_id_idx" ON "cash_receipt_items"("kind", "source_id");

-- CreateIndex
CREATE INDEX "cash_lodgments_association_id_status_idx" ON "cash_lodgments"("association_id", "status");

-- CreateIndex
CREATE INDEX "cash_lodgments_association_id_lodged_by_idx" ON "cash_lodgments"("association_id", "lodged_by");

-- CreateIndex
CREATE INDEX "cash_lodgment_allocations_collection_id_idx" ON "cash_lodgment_allocations"("collection_id");

-- CreateIndex
CREATE UNIQUE INDEX "cash_lodgment_allocations_lodgment_id_collection_id_key" ON "cash_lodgment_allocations"("lodgment_id", "collection_id");

-- AddForeignKey
ALTER TABLE "cash_collections" ADD CONSTRAINT "cash_collections_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_receipts" ADD CONSTRAINT "cash_receipts_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_receipts" ADD CONSTRAINT "cash_receipts_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "cash_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_receipts" ADD CONSTRAINT "cash_receipts_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_receipt_items" ADD CONSTRAINT "cash_receipt_items_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "cash_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_lodgments" ADD CONSTRAINT "cash_lodgments_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_lodgment_allocations" ADD CONSTRAINT "cash_lodgment_allocations_lodgment_id_fkey" FOREIGN KEY ("lodgment_id") REFERENCES "cash_lodgments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_lodgment_allocations" ADD CONSTRAINT "cash_lodgment_allocations_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "cash_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

