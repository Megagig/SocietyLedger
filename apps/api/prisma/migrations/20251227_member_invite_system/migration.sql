-- Member Invite System Migration
-- Adds support for member login activation, self-registration, and passive members

-- Add MemberInvite table for tracking member login invitations
CREATE TABLE "member_invites" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "member_id" INTEGER NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "invite_token" TEXT NOT NULL,
    "invite_token_expires_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "invited_by" INTEGER NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_invites_pkey" PRIMARY KEY ("id")
);

-- Add unique constraint on invite token
CREATE UNIQUE INDEX "member_invites_invite_token_key" ON "member_invites"("invite_token");

-- Add index for faster lookups
CREATE INDEX "member_invites_association_id_status_idx" ON "member_invites"("association_id", "status");
CREATE INDEX "member_invites_member_id_idx" ON "member_invites"("member_id");

-- Add foreign key constraints
ALTER TABLE "member_invites" ADD CONSTRAINT "member_invites_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "member_invites" ADD CONSTRAINT "member_invites_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "member_invites" ADD CONSTRAINT "member_invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add login_status column to members table to track login capability
-- Values: 'no_login' (default for imported members), 'invited', 'active' (has user account)
ALTER TABLE "members" ADD COLUMN "login_status" TEXT NOT NULL DEFAULT 'no_login';

-- Create index for login_status
CREATE INDEX "members_login_status_idx" ON "members"("login_status");
