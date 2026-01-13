-- Add webhook event log model
-- This model tracks all webhook events (both incoming and test webhooks)

CREATE TABLE IF NOT EXISTS "webhook_event_logs" (
    id SERIAL PRIMARY KEY,
    "association_id" INTEGER NOT NULL,
    "event_type" VARCHAR(255) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "status_code" INTEGER,
    "duration" INTEGER,
    "payload" JSONB,
    "response_body" JSONB,
    "error_message" TEXT,
    "source" VARCHAR(100) NOT NULL DEFAULT 'paystack',
    "endpoint" TEXT,
    "retry_count" INTEGER DEFAULT 0,
    "is_test" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "webhook_event_logs_association_id_idx" ON "webhook_event_logs"("association_id");
CREATE INDEX IF NOT EXISTS "webhook_event_logs_status_idx" ON "webhook_event_logs"("status");
CREATE INDEX IF NOT EXISTS "webhook_event_logs_event_type_idx" ON "webhook_event_logs"("event_type");
CREATE INDEX IF NOT EXISTS "webhook_event_logs_source_idx" ON "webhook_event_logs"("source");
CREATE INDEX IF NOT EXISTS "webhook_event_logs_created_at_idx" ON "webhook_event_logs"("created_at");
CREATE INDEX IF NOT EXISTS "webhook_event_logs_is_test_idx" ON "webhook_event_logs"("is_test");

-- Add foreign key constraint
ALTER TABLE "webhook_event_logs"
ADD CONSTRAINT "webhook_event_logs_association_id_fkey"
FOREIGN KEY ("association_id") REFERENCES "associations"(id) ON DELETE CASCADE;
