-- Setting the association's rules for who can vote and who can stand: the Election Committee and the Administrator hold it.
INSERT INTO "permissions" ("key", "description", "module", "examples", "is_active", "created_at", "updated_at") VALUES
  ('elections.rules.manage', 'Set the association''s rules for who can vote and who can stand in elections.', 'Voting', ARRAY['PUT /api/voting/eligibility/template','POST /api/voting/eligibility/preview'], true, NOW(), NOW())
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r."id", p."id", NOW()
FROM "roles" r
JOIN "permissions" p ON p."key" = 'elections.rules.manage'
WHERE r."name" IN ('admin', 'election_committee') AND r."association_id" IS NOT NULL
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
