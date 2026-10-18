-- A1.3 — Impersonation handoff (B4)
-- A1.4 — TOTP 2FA for platform users (B5)

-- User: add TOTP fields
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "totp_secret_enc" TEXT,
  ADD COLUMN IF NOT EXISTS "totp_enabled_at" TIMESTAMP(3);

-- ImpersonationHandoff model
CREATE TABLE IF NOT EXISTS "impersonation_handoffs" (
  "id"               SERIAL PRIMARY KEY,
  "code_hash"        TEXT NOT NULL UNIQUE,
  "admin_user_id"    INTEGER NOT NULL REFERENCES "users"("id"),
  "association_id"   INTEGER NOT NULL REFERENCES "associations"("id"),
  "reason"           TEXT NOT NULL,
  "duration_minutes" INTEGER NOT NULL DEFAULT 240,
  "expires_at"       TIMESTAMP(3) NOT NULL,
  "used_at"          TIMESTAMP(3),
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "impersonation_handoffs_admin_user_id_idx" ON "impersonation_handoffs"("admin_user_id");
CREATE INDEX IF NOT EXISTS "impersonation_handoffs_expires_at_idx" ON "impersonation_handoffs"("expires_at");

-- RecoveryCode model
CREATE TABLE IF NOT EXISTS "recovery_codes" (
  "id"         SERIAL PRIMARY KEY,
  "user_id"    INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "code_hash"  TEXT NOT NULL,
  "used_at"    TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "recovery_codes_user_id_idx" ON "recovery_codes"("user_id");

-- AdminLoginChallenge model
CREATE TABLE IF NOT EXISTS "admin_login_challenges" (
  "id"         SERIAL PRIMARY KEY,
  "user_id"    INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at"    TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "admin_login_challenges_user_id_idx" ON "admin_login_challenges"("user_id");
