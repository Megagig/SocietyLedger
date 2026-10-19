-- F0.2: mobile push notifications. New DeviceToken model (one row per
-- registered Expo push token), a push-specific master preference toggle
-- alongside the existing email/SMS/in-app ones, and an entityId column on
-- Notification for push deep-link routing (nullable — existing rows and
-- writers that don't pass one are unaffected).

-- AlterTable
ALTER TABLE "notification_preferences" ADD COLUMN     "push_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "entity_id" INTEGER;

-- CreateTable
CREATE TABLE "device_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "association_id" INTEGER,
    "expo_push_token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "device_name" TEXT,
    "app_version" TEXT,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_expo_push_token_key" ON "device_tokens"("expo_push_token");

-- CreateIndex
CREATE INDEX "device_tokens_user_id_association_id_idx" ON "device_tokens"("user_id", "association_id");

-- AddForeignKey
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
