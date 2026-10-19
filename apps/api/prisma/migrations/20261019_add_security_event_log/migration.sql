-- Immutable security-relevant event log across all tenants (logins, 2FA,
-- impersonation, password resets, suspensions, approvals, etc). Distinct
-- from the pre-existing "audit_log" table, which only tracks generic
-- record changes and has no severity or actor-type concept.

-- CreateEnum
CREATE TYPE "SecurityEventSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SecurityEventActorType" AS ENUM ('ADMIN', 'USER', 'SYSTEM');

-- CreateTable
CREATE TABLE "security_event_logs" (
    "id" SERIAL NOT NULL,
    "event_type" TEXT NOT NULL,
    "severity" "SecurityEventSeverity" NOT NULL DEFAULT 'INFO',
    "actor_type" "SecurityEventActorType" NOT NULL,
    "actor_id" INTEGER,
    "actor_email" TEXT,
    "target_type" TEXT,
    "target_id" TEXT,
    "target_name" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "details" JSONB,
    "association_id" INTEGER,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "security_event_logs_severity_idx" ON "security_event_logs"("severity");

-- CreateIndex
CREATE INDEX "security_event_logs_actor_type_idx" ON "security_event_logs"("actor_type");

-- CreateIndex
CREATE INDEX "security_event_logs_association_id_idx" ON "security_event_logs"("association_id");

-- CreateIndex
CREATE INDEX "security_event_logs_occurred_at_idx" ON "security_event_logs"("occurred_at");

-- AddForeignKey
ALTER TABLE "security_event_logs" ADD CONSTRAINT "security_event_logs_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
