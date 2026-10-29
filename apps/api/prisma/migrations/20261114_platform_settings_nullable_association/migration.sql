-- Platform-wide settings (the admin console's Settings page) belong to no association, so their rows have a null association_id.
-- The column was created NOT NULL, which meant a platform setting could never be saved on a database that had none yet.
ALTER TABLE "settings" ALTER COLUMN "association_id" DROP NOT NULL;

-- The existing unique index does not cover null association ids (NULLs are never equal), so cover them here.
CREATE UNIQUE INDEX IF NOT EXISTS "settings_platform_key_key" ON "settings" ("key") WHERE "association_id" IS NULL;
