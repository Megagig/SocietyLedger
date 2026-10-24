-- Announcements are kept as a record; SMS credits are reserved before sending and given back for texts that didn't go out; a member can
-- opt out of announcement texts.
ALTER TYPE "SMSCampaignStatus" ADD VALUE IF NOT EXISTS 'INTERRUPTED';

CREATE TYPE "AnnouncementAudience" AS ENUM ('ALL', 'CATEGORY', 'SELECTED');
CREATE TYPE "AnnouncementStatus" AS ENUM ('SENDING', 'COMPLETED', 'INTERRUPTED');

CREATE TABLE "announcements" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'info',
    "audience" "AnnouncementAudience" NOT NULL DEFAULT 'ALL',
    "audience_filter" JSONB,
    "send_email" BOOLEAN NOT NULL DEFAULT false,
    "send_sms" BOOLEAN NOT NULL DEFAULT false,
    "sms_text" TEXT,
    "status" "AnnouncementStatus" NOT NULL DEFAULT 'COMPLETED',
    "member_count" INTEGER NOT NULL DEFAULT 0,
    "in_app_count" INTEGER NOT NULL DEFAULT 0,
    "no_login_count" INTEGER NOT NULL DEFAULT 0,
    "email_count" INTEGER NOT NULL DEFAULT 0,
    "sms_requested" INTEGER NOT NULL DEFAULT 0,
    "sms_sent" INTEGER NOT NULL DEFAULT 0,
    "sms_failed" INTEGER NOT NULL DEFAULT 0,
    "no_phone_count" INTEGER NOT NULL DEFAULT 0,
    "opted_out_count" INTEGER NOT NULL DEFAULT 0,
    "credits_used" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "announcements_association_id_created_at_idx" ON "announcements"("association_id", "created_at");
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sms_messages" ADD COLUMN "announcement_id" INTEGER;
ALTER TABLE "sms_messages" ADD COLUMN "refunded" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "sms_messages_announcement_id_idx" ON "sms_messages"("announcement_id");
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "notification_preferences" ADD COLUMN "announcement_sms_opt_out" BOOLEAN NOT NULL DEFAULT false;
