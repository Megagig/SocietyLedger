-- SQL Script to add new permissions for API-UI Gaps Implementation
-- Run this after the main RBAC seed

-- Nigerian Payments Permissions
INSERT INTO permissions (key, description, module, examples, created_at, updated_at)
VALUES 
  ('payments.nigerian.view', 'View Nigerian payment records and transfers.', 'Nigerian Payments', ARRAY['GET /api/payments/nigerian/transfers', 'Payment dashboard']::text[], NOW(), NOW()),
  ('payments.nigerian.record', 'Record bank transfers and upload payment proofs.', 'Nigerian Payments', ARRAY['POST /api/payments/nigerian/transfers', 'Record payment page']::text[], NOW(), NOW()),
  ('payments.nigerian.verify', 'Verify and approve payment proofs.', 'Nigerian Payments', ARRAY['PUT /api/payments/nigerian/transfers/:id/verify', 'Verification queue']::text[], NOW(), NOW()),
  ('payments.nigerian.reconcile', 'Reconcile bank statements with transactions.', 'Nigerian Payments', ARRAY['POST /api/payments/nigerian/reconcile', 'Reconciliation page']::text[], NOW(), NOW()),
  ('payments.nigerian.import', 'Import bank statements via CSV.', 'Nigerian Payments', ARRAY['POST /api/payments/nigerian/import', 'Import page']::text[], NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  module = EXCLUDED.module,
  examples = EXCLUDED.examples,
  updated_at = NOW();

-- SMS & Communications Permissions
INSERT INTO permissions (key, description, module, examples, created_at, updated_at)
VALUES
  ('communication.sms.view', 'View SMS messages and campaigns.', 'SMS Communications', ARRAY['GET /api/communication/sms', 'SMS dashboard']::text[], NOW(), NOW()),
  ('communication.sms.send', 'Send SMS messages and create campaigns.', 'SMS Communications', ARRAY['POST /api/communication/sms/send', 'Quick send page']::text[], NOW(), NOW()),
  ('communication.sms.campaign', 'Manage SMS campaigns.', 'SMS Communications', ARRAY['POST /api/communication/campaigns', 'Campaign management']::text[], NOW(), NOW()),
  ('communication.sms.template', 'Manage SMS templates.', 'SMS Communications', ARRAY['POST /api/communication/templates', 'Template management']::text[], NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  module = EXCLUDED.module,
  examples = EXCLUDED.examples,
  updated_at = NOW();

-- Notifications & Announcements Permissions
INSERT INTO permissions (key, description, module, examples, created_at, updated_at)
VALUES
  ('notifications.view', 'View notifications.', 'Notifications', ARRAY['GET /api/notifications', 'Notifications center']::text[], NOW(), NOW()),
  ('notifications.send', 'Send announcements and broadcast notifications.', 'Notifications', ARRAY['POST /api/notifications/announcements', 'Create announcement']::text[], NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  module = EXCLUDED.module,
  examples = EXCLUDED.examples,
  updated_at = NOW();

-- Exports Permissions
INSERT INTO permissions (key, description, module, examples, created_at, updated_at)
VALUES
  ('exports.financial', 'Export financial reports (PDF/Excel).', 'Exports', ARRAY['POST /api/exports/financial', 'Export data page']::text[], NOW(), NOW()),
  ('exports.members', 'Export member data.', 'Exports', ARRAY['POST /api/exports/members', 'Member exports']::text[], NOW(), NOW()),
  ('exports.view_history', 'View and download export history.', 'Exports', ARRAY['GET /api/exports/history', 'Export history page']::text[], NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  module = EXCLUDED.module,
  examples = EXCLUDED.examples,
  updated_at = NOW();

-- Cron Jobs & System Permissions
INSERT INTO permissions (key, description, module, examples, created_at, updated_at)
VALUES
  ('system.cron.view', 'View cron job status and history.', 'System', ARRAY['GET /api/cron/status', 'Cron jobs dashboard']::text[], NOW(), NOW()),
  ('system.cron.trigger', 'Manually trigger cron jobs.', 'System', ARRAY['POST /api/cron/trigger/:job', 'Manual job execution']::text[], NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  module = EXCLUDED.module,
  examples = EXCLUDED.examples,
  updated_at = NOW();

-- Now assign these permissions to admin roles for all associations
DO $$
DECLARE
  role_record RECORD;
  perm_record RECORD;
BEGIN
  -- Loop through all admin roles (in each association)
  FOR role_record IN 
    SELECT id FROM roles WHERE name = 'admin'
  LOOP
    -- Assign all new permissions to admin role
    FOR perm_record IN
      SELECT id FROM permissions WHERE key IN (
        'payments.nigerian.view', 'payments.nigerian.record', 'payments.nigerian.verify', 
        'payments.nigerian.reconcile', 'payments.nigerian.import',
        'communication.sms.view', 'communication.sms.send', 'communication.sms.campaign', 'communication.sms.template',
        'notifications.view', 'notifications.send',
        'exports.financial', 'exports.members', 'exports.view_history',
        'system.cron.view', 'system.cron.trigger'
      )
    LOOP
      INSERT INTO role_permissions (role_id, permission_id, created_at)
      VALUES (role_record.id, perm_record.id, NOW())
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    END LOOP;
  END LOOP;
  
  -- Also assign relevant permissions to treasurer roles
  FOR role_record IN 
    SELECT id FROM roles WHERE name = 'treasurer'
  LOOP
    FOR perm_record IN
      SELECT id FROM permissions WHERE key IN (
        'payments.nigerian.view', 'payments.nigerian.record', 'payments.nigerian.verify', 
        'payments.nigerian.reconcile', 'payments.nigerian.import',
        'communication.sms.view',
        'notifications.view',
        'exports.financial', 'exports.members', 'exports.view_history'
      )
    LOOP
      INSERT INTO role_permissions (role_id, permission_id, created_at)
      VALUES (role_record.id, perm_record.id, NOW())
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    END LOOP;
  END LOOP;
  
  -- Assign relevant permissions to financial_secretary roles
  FOR role_record IN 
    SELECT id FROM roles WHERE name = 'financial_secretary'
  LOOP
    FOR perm_record IN
      SELECT id FROM permissions WHERE key IN (
        'payments.nigerian.view', 'payments.nigerian.record', 
        'payments.nigerian.reconcile', 'payments.nigerian.import',
        'communication.sms.view',
        'notifications.view',
        'exports.financial', 'exports.members', 'exports.view_history'
      )
    LOOP
      INSERT INTO role_permissions (role_id, permission_id, created_at)
      VALUES (role_record.id, perm_record.id, NOW())
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    END LOOP;
  END LOOP;
  
  -- Assign view permissions to member roles
  FOR role_record IN 
    SELECT id FROM roles WHERE name = 'member'
  LOOP
    FOR perm_record IN
      SELECT id FROM permissions WHERE key IN (
        'payments.nigerian.view',
        'notifications.view',
        'exports.view_history'
      )
    LOOP
      INSERT INTO role_permissions (role_id, permission_id, created_at)
      VALUES (role_record.id, perm_record.id, NOW())
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Summary
SELECT 
  'Permissions Added' as status,
  COUNT(*) as count
FROM permissions
WHERE key LIKE 'payments.nigerian.%' 
   OR key LIKE 'communication.sms.%'
   OR key LIKE 'notifications.%'
   OR key LIKE 'exports.%'
   OR key LIKE 'system.cron.%';

SELECT
  'Role Permissions Added' as status,
  r.name as role_name,
  COUNT(rp.id) as new_permissions
FROM roles r
JOIN role_permissions rp ON r.id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
WHERE p.key IN (
  'payments.nigerian.view', 'payments.nigerian.record', 'payments.nigerian.verify', 
  'payments.nigerian.reconcile', 'payments.nigerian.import',
  'communication.sms.view', 'communication.sms.send', 'communication.sms.campaign', 'communication.sms.template',
  'notifications.view', 'notifications.send',
  'exports.financial', 'exports.members', 'exports.view_history',
  'system.cron.view', 'system.cron.trigger'
)
GROUP BY r.name
ORDER BY r.name;
