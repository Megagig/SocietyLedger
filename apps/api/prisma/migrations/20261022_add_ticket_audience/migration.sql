-- Phase 4 (F4.6): support tickets get an audience. ASSOCIATION (the default — every existing ticket) is a member
-- asking their own association's admins; PLATFORM is an association admin asking SocietyLedger support.
-- A PLATFORM ticket can record which ticket it was escalated from, but never copies that ticket's content.
-- Also adds the BILLING and DATA categories that Tier 2 tickets need.

-- CreateEnum
CREATE TYPE "TicketAudience" AS ENUM ('ASSOCIATION', 'PLATFORM');

-- AlterEnum
ALTER TYPE "TicketCategory" ADD VALUE IF NOT EXISTS 'BILLING';
ALTER TYPE "TicketCategory" ADD VALUE IF NOT EXISTS 'DATA';

-- AlterTable
ALTER TABLE "support_tickets" ADD COLUMN "audience" "TicketAudience" NOT NULL DEFAULT 'ASSOCIATION',
ADD COLUMN "escalated_from_id" INTEGER;

-- CreateIndex
CREATE INDEX "support_tickets_audience_status_idx" ON "support_tickets"("audience", "status");

-- CreateIndex
CREATE INDEX "support_tickets_escalated_from_id_idx" ON "support_tickets"("escalated_from_id");

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_escalated_from_id_fkey" FOREIGN KEY ("escalated_from_id") REFERENCES "support_tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
