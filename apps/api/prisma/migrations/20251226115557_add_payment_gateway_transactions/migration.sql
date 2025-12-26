-- CreateTable
CREATE TABLE "payment_gateway_transactions" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "transaction_id" INTEGER,
    "provider" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "metadata" JSONB,
    "webhook_received" BOOLEAN NOT NULL DEFAULT false,
    "paystack_response" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_gateway_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_gateway_transactions_reference_key" ON "payment_gateway_transactions"("reference");

-- CreateIndex
CREATE INDEX "payment_gateway_transactions_association_id_status_idx" ON "payment_gateway_transactions"("association_id", "status");

-- CreateIndex
CREATE INDEX "payment_gateway_transactions_reference_idx" ON "payment_gateway_transactions"("reference");

-- CreateIndex
CREATE INDEX "payment_gateway_transactions_transaction_id_idx" ON "payment_gateway_transactions"("transaction_id");

-- AddForeignKey
ALTER TABLE "payment_gateway_transactions" ADD CONSTRAINT "payment_gateway_transactions_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_gateway_transactions" ADD CONSTRAINT "payment_gateway_transactions_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
