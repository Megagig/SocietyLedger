-- Optional rules for who may vote and who may stand. NULL means every active member, exactly as before, so nothing changes until an
-- association sets a rule.
ALTER TABLE "elections" ADD COLUMN "eligibility_rules" JSONB;

-- A named member let in, or kept out, of one election's vote or candidacy, with the reason on record.
CREATE TABLE "election_eligibility_exceptions" (
    "id" SERIAL NOT NULL,
    "election_id" INTEGER NOT NULL,
    "member_id" INTEGER NOT NULL,
    "scope" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "election_eligibility_exceptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "election_eligibility_exceptions_election_id_member_id_scope_key" ON "election_eligibility_exceptions"("election_id", "member_id", "scope");
CREATE INDEX "election_eligibility_exceptions_election_id_idx" ON "election_eligibility_exceptions"("election_id");

ALTER TABLE "election_eligibility_exceptions" ADD CONSTRAINT "election_eligibility_exceptions_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "election_eligibility_exceptions" ADD CONSTRAINT "election_eligibility_exceptions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
