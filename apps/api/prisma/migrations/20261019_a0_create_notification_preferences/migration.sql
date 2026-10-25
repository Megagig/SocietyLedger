-- Fills a gap in the migration history: `notification_preferences` was created outside any migration
-- (it exists on databases built earlier), but 20261019_f0_2_push_notifications and
-- 20261101_add_announcements_and_sms_safety ALTER it. On a brand-new database those two failed with
-- `relation "notification_preferences" does not exist`.
--
-- This runs just before them and creates the table as it was BEFORE they alter it (so it leaves out
-- `push_enabled` and `announcement_sms_opt_out`, which those two add). On a database that already has
-- the table it does nothing.

DO $$
BEGIN
  IF to_regclass('public.notification_preferences') IS NULL THEN
    CREATE TABLE "notification_preferences" (
        "id" SERIAL NOT NULL,
        "association_id" INTEGER NOT NULL,
        "user_id" INTEGER NOT NULL,
        "email_enabled" BOOLEAN NOT NULL DEFAULT true,
        "sms_enabled" BOOLEAN NOT NULL DEFAULT false,
        "in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
        "payment_due_email" BOOLEAN NOT NULL DEFAULT true,
        "payment_due_sms" BOOLEAN NOT NULL DEFAULT false,
        "payment_due_in_app" BOOLEAN NOT NULL DEFAULT true,
        "payment_received_email" BOOLEAN NOT NULL DEFAULT true,
        "payment_received_sms" BOOLEAN NOT NULL DEFAULT false,
        "payment_received_in_app" BOOLEAN NOT NULL DEFAULT true,
        "system_email" BOOLEAN NOT NULL DEFAULT true,
        "system_sms" BOOLEAN NOT NULL DEFAULT false,
        "system_in_app" BOOLEAN NOT NULL DEFAULT true,
        "approval_email" BOOLEAN NOT NULL DEFAULT true,
        "approval_sms" BOOLEAN NOT NULL DEFAULT false,
        "approval_in_app" BOOLEAN NOT NULL DEFAULT true,
        "announcement_email" BOOLEAN NOT NULL DEFAULT true,
        "announcement_sms" BOOLEAN NOT NULL DEFAULT false,
        "announcement_in_app" BOOLEAN NOT NULL DEFAULT true,
        "quiet_hours_enabled" BOOLEAN NOT NULL DEFAULT false,
        "quiet_hours_start" TEXT NOT NULL DEFAULT '22:00',
        "quiet_hours_end" TEXT NOT NULL DEFAULT '08:00',
        "quiet_hours_timezone" TEXT NOT NULL DEFAULT 'UTC',
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL,

        CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
    );

    CREATE UNIQUE INDEX "notification_preferences_association_id_user_id_key"
        ON "notification_preferences"("association_id", "user_id");

    ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_association_id_fkey"
        FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
