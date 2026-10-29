-- A guarantor can accept for themselves through a one-time link an officer sends them. Only a hash of the link's token is stored.
CREATE TABLE IF NOT EXISTS "ajo_guarantor_invites" (
  "id" SERIAL NOT NULL,
  "association_id" INTEGER NOT NULL,
  "membership_id" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "relationship" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "created_by" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ajo_guarantor_invites_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ajo_guarantor_invites_token_hash_key" ON "ajo_guarantor_invites"("token_hash");
CREATE INDEX IF NOT EXISTS "ajo_guarantor_invites_membership_id_idx" ON "ajo_guarantor_invites"("membership_id");
CREATE INDEX IF NOT EXISTS "ajo_guarantor_invites_association_id_idx" ON "ajo_guarantor_invites"("association_id");
DO $$ BEGIN
  ALTER TABLE "ajo_guarantor_invites" ADD CONSTRAINT "ajo_guarantor_invites_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "ajo_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
