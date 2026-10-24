-- Elections get their own permissions, and a new Election Committee role (people chosen to conduct elections, outside the officers).
-- Polls get their own permission too; the Administrator keeps running polls. Mirrors ROLE_PERMISSION_MAPPING.

INSERT INTO "permissions" ("key", "description", "module", "examples", "is_active", "created_at", "updated_at") VALUES
  ('elections.manage', 'Create, edit and delete elections and their positions, and cancel an election.', 'Voting', ARRAY['POST /api/voting/elections','PUT /api/voting/elections/:id','POST /api/voting/elections/:id/cancel'], true, NOW(), NOW()),
  ('elections.candidates.manage', 'Register candidates, and approve or reject nominations.', 'Voting', ARRAY['POST /api/voting/elections/:id/candidates','POST /api/voting/candidates/:id/approve'], true, NOW(), NOW()),
  ('elections.run', 'Open and close nominations and voting.', 'Voting', ARRAY['POST /api/voting/elections/:id/start-voting','POST /api/voting/elections/:id/close-voting'], true, NOW(), NOW()),
  ('elections.results.view', 'See an election''s results as soon as voting closes, before they are published.', 'Voting', ARRAY['GET /api/voting/elections/:id/results'], true, NOW(), NOW()),
  ('elections.results.publish', 'Publish an election''s results to the members.', 'Voting', ARRAY['POST /api/voting/elections/:id/publish-results'], true, NOW(), NOW()),
  ('polls.manage', 'Create, edit, start, close and cancel polls.', 'Voting', ARRAY['POST /api/voting/polls','POST /api/voting/polls/:id/start'], true, NOW(), NOW())
ON CONFLICT ("key") DO NOTHING;

-- One Election Committee role per association.
INSERT INTO "roles" ("association_id", "name", "display_name", "description", "is_system_role", "is_active", "created_at", "updated_at")
SELECT a."id", 'election_committee', 'Election Committee', 'People chosen to conduct elections, separate from the officers', true, true, NOW(), NOW()
FROM "associations" a
ON CONFLICT ("association_id", "name") DO NOTHING;

-- The committee are members first: copy everything the member role has...
INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT c."id", rp."permission_id", NOW()
FROM "roles" c
JOIN "roles" m ON m."association_id" = c."association_id" AND m."name" = 'member'
JOIN "role_permissions" rp ON rp."role_id" = m."id"
WHERE c."name" = 'election_committee'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- ...then add what only the committee can do.
INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT c."id", p."id", NOW()
FROM "roles" c
JOIN "permissions" p ON p."key" IN ('elections.manage','elections.candidates.manage','elections.run','elections.results.view','elections.results.publish','polls.manage')
WHERE c."name" = 'election_committee'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- The Administrator keeps running polls.
INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r."id", p."id", NOW()
FROM "roles" r
JOIN "permissions" p ON p."key" = 'polls.manage'
WHERE r."name" = 'admin' AND r."association_id" IS NOT NULL
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
