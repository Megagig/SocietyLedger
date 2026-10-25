-- Phase 8: an invite can carry an officer role, and the setup wizard remembers which steps were skipped (apart from the ones finished).
ALTER TABLE "member_invites" ADD COLUMN IF NOT EXISTS "role_name" TEXT;
ALTER TABLE "onboarding_progress" ADD COLUMN IF NOT EXISTS "skipped_steps" JSONB NOT NULL DEFAULT '[]';
