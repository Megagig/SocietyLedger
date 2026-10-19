-- Optional display-name fields for platform-admin users (admin console account page).
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "first_name"     TEXT,
  ADD COLUMN IF NOT EXISTS "last_name"      TEXT,
  ADD COLUMN IF NOT EXISTS "last_login_at"  TIMESTAMP(3);
