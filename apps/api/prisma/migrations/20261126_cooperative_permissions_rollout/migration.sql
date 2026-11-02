-- The cooperative enhancements add permissions (withdraw, manage types, two withdrawal stages). They used to exist only after
-- running the RBAC seed, and until then requirePermission refused everyone, the administrator included. This migration creates them
-- and gives them to the existing system roles, so a deploy no longer depends on a manual seed. It is idempotent, and the seed stays
-- the source of truth for descriptions. Custom roles are left alone: an administrator grants them deliberately.

INSERT INTO "permissions" ("key", "description", "module", "examples", "is_active", "created_at", "updated_at") VALUES
  ('cooperatives.view_own', 'View your own cooperative profile, savings accounts, loans, loan applications and repayments, and the loan products on offer.', 'Cooperatives', ARRAY['GET /api/cooperatives/my-dashboard'], true, NOW(), NOW()),
  ('cooperatives.apply_own', 'Apply for a cooperative loan.', 'Cooperatives', ARRAY['POST /api/cooperatives/loan-applications'], true, NOW(), NOW()),
  ('cooperatives.guarantor_own', 'See and answer requests to guarantee another member''s loan.', 'Cooperatives', ARRAY['GET /api/cooperatives/guarantor-requests'], true, NOW(), NOW()),
  ('cooperatives.withdraw_own', 'Ask to withdraw from your own withdrawable savings, and follow or cancel the request.', 'Cooperatives', ARRAY['POST /api/cooperatives/withdrawal-requests'], true, NOW(), NOW()),
  ('cooperatives.manage_types', 'Create and edit the association''s savings account types and loan categories.', 'Cooperatives', ARRAY['POST /api/cooperatives/account-types'], true, NOW(), NOW()),
  ('cooperatives.withdrawals.review', 'Stage one of a member''s withdrawal: check eligibility and balance, then pass it on for approval or reject it. Never your own request.', 'Cooperatives', ARRAY['POST /api/cooperatives/withdrawal-requests/:id/review'], true, NOW(), NOW()),
  ('cooperatives.withdrawals.approve', 'Stage two of a member''s withdrawal: approve it and record the payout, or reject it. Never your own request, and never one you reviewed.', 'Cooperatives', ARRAY['POST /api/cooperatives/withdrawal-requests/:id/approve'], true, NOW(), NOW())
ON CONFLICT ("key") DO NOTHING;

WITH grants(role_name, perm_key) AS (VALUES
  ('admin', 'cooperatives.view_own'), ('admin', 'cooperatives.apply_own'), ('admin', 'cooperatives.guarantor_own'),
  ('admin', 'cooperatives.withdraw_own'), ('admin', 'cooperatives.manage_types'),
  ('admin', 'cooperatives.withdrawals.review'), ('admin', 'cooperatives.withdrawals.approve'),
  ('treasurer', 'cooperatives.view_own'), ('treasurer', 'cooperatives.apply_own'), ('treasurer', 'cooperatives.guarantor_own'),
  ('treasurer', 'cooperatives.withdraw_own'), ('treasurer', 'cooperatives.manage_types'), ('treasurer', 'cooperatives.withdrawals.review'),
  ('financial_secretary', 'cooperatives.view_own'), ('financial_secretary', 'cooperatives.apply_own'), ('financial_secretary', 'cooperatives.guarantor_own'),
  ('financial_secretary', 'cooperatives.withdraw_own'), ('financial_secretary', 'cooperatives.withdrawals.review'),
  ('member', 'cooperatives.withdraw_own'), ('election_committee', 'cooperatives.withdraw_own'),
  ('ajo_collector', 'cooperatives.withdraw_own'), ('ajo_officer', 'cooperatives.withdraw_own')
)
INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r."id", p."id", NOW()
FROM grants g
JOIN "roles" r ON r."name" = g.role_name AND r."is_system_role" = true
JOIN "permissions" p ON p."key" = g.perm_key
LEFT JOIN "associations" a ON a."id" = r."association_id"
WHERE a."kind" IS DISTINCT FROM 'THRIFT_GROUP'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
