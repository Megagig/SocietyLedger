-- AI credits: a bought balance on top of the plan's daily allowance, and the units each AI request used.
CREATE TABLE IF NOT EXISTS "ai_credit_balances" (
  "id" SERIAL PRIMARY KEY,
  "association_id" INTEGER NOT NULL,
  "balance" INTEGER NOT NULL DEFAULT 0,
  "total_purchased" INTEGER NOT NULL DEFAULT 0,
  "total_used" INTEGER NOT NULL DEFAULT 0,
  "last_top_up_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_credit_balances_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ai_credit_balances_association_id_key" ON "ai_credit_balances"("association_id");

CREATE TABLE IF NOT EXISTS "ai_credit_purchases" (
  "id" SERIAL PRIMARY KEY,
  "association_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "credits" INTEGER NOT NULL,
  "price_per_credit" DECIMAL(10,2) NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "reference" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "paid_at" TIMESTAMP(3),
  "paystack_response" JSONB,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_credit_purchases_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_credit_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ai_credit_purchases_reference_key" ON "ai_credit_purchases"("reference");
CREATE INDEX IF NOT EXISTS "ai_credit_purchases_association_id_idx" ON "ai_credit_purchases"("association_id");
CREATE INDEX IF NOT EXISTS "ai_credit_purchases_status_idx" ON "ai_credit_purchases"("status");

ALTER TABLE "ai_audit_logs" ADD COLUMN IF NOT EXISTS "units" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ai_audit_logs" ADD COLUMN IF NOT EXISTS "allowance_units" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ai_audit_logs" ADD COLUMN IF NOT EXISTS "credit_units" INTEGER NOT NULL DEFAULT 0;
