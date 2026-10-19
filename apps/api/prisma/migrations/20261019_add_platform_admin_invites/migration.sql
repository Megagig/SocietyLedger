-- A2.12 — Platform admin invites: email-link invite flow for adding new
-- platform admin console users. tokenHash follows the same
-- SHA-256-of-a-random-token pattern as impersonation_handoffs.code_hash
-- (never store the raw token — only what's needed to verify it).

CREATE TABLE IF NOT EXISTS "platform_admin_invites" (
  "id"            SERIAL PRIMARY KEY,
  "email"         TEXT NOT NULL,
  "platform_role" "PlatformRole" NOT NULL,
  "token_hash"    TEXT NOT NULL UNIQUE,
  "invited_by"    INTEGER NOT NULL REFERENCES "users"("id"),
  "expires_at"    TIMESTAMP(3) NOT NULL,
  "accepted_at"   TIMESTAMP(3),
  "revoked_at"    TIMESTAMP(3),
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "platform_admin_invites_email_idx" ON "platform_admin_invites"("email");
CREATE INDEX IF NOT EXISTS "platform_admin_invites_expires_at_idx" ON "platform_admin_invites"("expires_at");
