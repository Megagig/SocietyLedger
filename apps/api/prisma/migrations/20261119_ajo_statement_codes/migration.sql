-- Circle statements (spec §16.4.10): each statement a member downloads carries a short code. Anyone with the code can open a page that says
-- when the statement was made and whether the circle's figures still match it. The code is random and unguessable, and the page shows only
-- circle totals (never a name).
CREATE TABLE IF NOT EXISTS "ajo_statement_codes" (
  "id" SERIAL PRIMARY KEY,
  "association_id" INTEGER NOT NULL,
  "group_id" INTEGER NOT NULL REFERENCES "ajo_groups"("id") ON DELETE CASCADE,
  "code" TEXT NOT NULL,
  "generated_by" INTEGER,
  "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "snapshot" JSONB NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "ajo_statement_codes_code_key" ON "ajo_statement_codes"("code");
CREATE INDEX IF NOT EXISTS "ajo_statement_codes_group_id_idx" ON "ajo_statement_codes"("group_id");
