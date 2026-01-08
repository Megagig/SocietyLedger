# Adding New Permissions for API-UI Gaps Implementation

## Problem

The new UI pages created for the API-UI gaps implementation (Nigerian Payments, SMS, Exports, Notifications, Cron Jobs) require specific permissions that don't exist in the database yet. Without these permissions, admin users won't see the navigation links for these new features.

## Solution

We've created permissions and updated the codebase. You need to run the SQL script to add these permissions to your database.

## Step 1: Run the SQL Script

### Option A: Using psql (Recommended)

```bash
# From the project root
cd apps/api

# Run the SQL script (replace with your database connection details)
psql -h localhost -U your_username -d your_database_name -f prisma/seeds/add-new-permissions.sql
```

### Option B: Using a Database Client

1. Open your preferred PostgreSQL client (pgAdmin, DBeaver, TablePlus, etc.)
2. Connect to your database
3. Open and execute the file: `apps/api/prisma/seeds/add-new-permissions.sql`

### Option C: Copy and Paste

Open the SQL file and copy-paste its contents into your database query tool and execute.

## Step 2: Verify Permissions Were Added

After running the script, you should see output like this:

```
Permissions Added | count
-----------------+-------
                 | 17

Role Permissions Added | role_name          | new_permissions
----------------------+--------------------+----------------
                      | admin              | 17
                      | treasurer          | 11
                      | financial_secretary| 9  
                      | member             | 3
```

## Step 3: Restart Your Application

```bash
# Restart API server
cd apps/api
npm run dev

# Restart Web server  
cd apps/web
npm run dev
```

## Step 4: Verify in UI

1. Log in as an admin user
2. Navigate to **Settings → Roles & Permissions**
3. You should now see these new permission modules:
   - **Nigerian Payments** (5 permissions)
   - **SMS Communications** (4 permissions)
   - **Notifications** (2 permissions)
   - **Exports** (3 permissions)
   - **System** (2 permissions for Cron Jobs)

## Step 5: Check Sidebar Navigation

After adding permissions, the following links should now appear in the sidebar:

- **Finance → Payment Management** (requires `payments.nigerian.record`)
- **Communication → SMS Dashboard** (requires `communication.sms.send`)
- **Reports → Export Data** (requires `exports.financial`)
- **Settings → Cron Jobs** (requires `system.cron.view`)

## What Was Added

### New Permissions

| Module | Permission Key | Description |
|--------|---------------|-------------|
| **Nigerian Payments** | `payments.nigerian.view` | View payment records and transfers |
| | `payments.nigerian.record` | Record bank transfers |
| | `payments.nigerian.verify` | Verify payment proofs |
| | `payments.nigerian.reconcile` | Reconcile statements |
| | `payments.nigerian.import` | Import bank statements |
| **SMS Communications** | `communication.sms.view` | View SMS dashboard |
| | `communication.sms.send` | Send SMS messages |
| | `communication.sms.campaign` | Manage campaigns |
| | `communication.sms.template` | Manage templates |
| **Notifications** | `notifications.view` | View notifications |
| | `notifications.send` | Send announcements |
| **Exports** | `exports.financial` | Export financial reports |
| | `exports.members` | Export member data |
| | `exports.view_history` | View export history |
| **System/Cron** | `system.cron.view` | View cron job status |
| | `system.cron.trigger` | Manually trigger jobs |

### Role Assignments

**Admin**: Gets all 17 permissions  
**Treasurer**: Gets 11 permissions (all financial + view communications)  
**Financial Secretary**: Gets 9 permissions (financial operations, no verify)  
**Member**: Gets 3 permissions (view only)

## Troubleshooting

### Navigation Links Still Not Showing

1. **Check your user's role**:
   ```sql
   SELECT email, role FROM "User" WHERE email = 'your-email@example.com';
   ```

2. **Check role permissions**:
   ```sql
   SELECT r.name, p.key
   FROM "Role" r
   JOIN "RolePermission" rp ON r.id = rp."roleId"
   JOIN "Permission" p ON rp."permissionId" = p.id
   WHERE r.name = 'admin' AND p.key LIKE 'payments.nigerian.%';
   ```

3. **Clear browser cache and refresh**

4. **Check browser console for errors**

### Permission Check Failing

If you're getting permission errors, verify the user has the role with permissions:

```sql
-- Check user's roles and permissions
SELECT 
  u.email,
  r.name as role_name,
  p.key as permission_key
FROM "User" u
JOIN "UserRole" ur ON u.id = ur."userId"
JOIN "Role" r ON ur."roleId" = r.id
JOIN "RolePermission" rp ON r.id = rp."roleId"
JOIN "Permission" p ON rp."permissionId" = p.id
WHERE u.email = 'your-email@example.com'
  AND p.key IN (
    'payments.nigerian.record',
    'communication.sms.send',
    'exports.financial',
    'system.cron.view'
  );
```

## Alternative: Re-run Full RBAC Seed

If you prefer to re-seed the entire RBAC system (will update all permissions and roles):

```bash
cd apps/api
npm run seed:rbac
```

**⚠️ Warning**: This will reset custom roles and permissions you may have created!

## Files Modified

### Seed Files
- `apps/api/prisma/seeds/rbac-seed.ts` - Added new permissions to registry
- `apps/api/prisma/seeds/add-new-permissions.sql` - SQL script to add permissions

### Permission Constants
- `apps/api/src/lib/permissions.ts` - Added permission constants
- `apps/web/src/lib/permissions.ts` - Added permission constants

### No Changes Needed
- `apps/web/src/components/layout/Sidebar.tsx` - Already uses correct permission constants
- All new UI pages - Already using correct Can component with proper permissions

## Next Steps

After successfully adding permissions:

1. ✅ Verify navigation links appear
2. ✅ Test access to all new pages
3. ✅ Follow the [Manual Testing Guide](../../docs/gaps/MANUAL_TESTING_GUIDE.md)
4. ✅ Grant permissions to other roles as needed via UI (Settings → Roles & Permissions)

---

**Questions or Issues?**

If you encounter any problems, check:
1. Database connection is working
2. SQL script ran without errors
3. API server was restarted
4. Browser cache was cleared
