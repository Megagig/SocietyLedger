# 🚀 Quick Start: Fix Missing Navigation Links

## Problem
Navigation links not showing: Payment Management, SMS Dashboard, Export Data, Cron Jobs

## Solution (2 minutes)

### Step 1: Run SQL Script
```bash
cd /home/megagig/Documents/PROJECTS/NEXTJS/SocietyLedger/apps/api
psql -h localhost -U postgres -d societyledger -f prisma/seeds/add-new-permissions.sql
```

*Replace `postgres` and `societyledger` with your database username and database name.*

### Step 2: Restart Servers
```bash
# Terminal 1 - API
cd /home/megagig/Documents/PROJECTS/NEXTJS/SocietyLedger/apps/api
npm run dev

# Terminal 2 - Web
cd /home/megagig/Documents/PROJECTS/NEXTJS/SocietyLedger/apps/web
npm run dev
```

### Step 3: Clear Browser Cache
- Press `Ctrl+Shift+R` (Linux/Windows) or `Cmd+Shift+R` (Mac)
- Or clear cache manually

### Step 4: Verify
Log in as admin and check sidebar for:
- ✅ Finance → **Payment Management**
- ✅ Communication → **SMS Dashboard**
- ✅ Reports → **Export Data**
- ✅ Settings → **Cron Jobs**

## Still Not Working?

### Check Database Connection
```bash
psql -h localhost -U postgres -d societyledger -c "SELECT COUNT(*) FROM \"Permission\" WHERE key LIKE 'payments.nigerian.%'"
```

Should return `5`.

### Check Your Role
```sql
SELECT email, role FROM "User" WHERE email = 'devinecare4ever@gmail.com';
```

Should be `admin`.

### Manual Permission Check
```sql
SELECT 
  r.name as role_name,
  COUNT(p.id) as permissions_count
FROM "Role" r
JOIN "RolePermission" rp ON r.id = rp."roleId"
JOIN "Permission" p ON rp."permissionId" = p.id
WHERE r.name = 'admin' 
  AND p.key IN (
    'payments.nigerian.record',
    'communication.sms.send',
    'exports.financial',
    'system.cron.view'
  )
GROUP BY r.name;
```

Should show `4` permissions for `admin` role.

## Alternative: Use Database Client

If psql doesn't work:
1. Open pgAdmin / DBeaver / TablePlus
2. Connect to your database
3. Open file: `apps/api/prisma/seeds/add-new-permissions.sql`
4. Execute the entire script
5. Restart servers

## What Was Added

- **17 new permissions** across 5 modules
- **Automatic role assignment**:
  - Admin: 17 permissions
  - Treasurer: 11 permissions
  - Financial Secretary: 9 permissions
  - Member: 3 permissions

## Documentation

- Full Setup: [apps/api/prisma/seeds/README-NEW-PERMISSIONS.md](../apps/api/prisma/seeds/README-NEW-PERMISSIONS.md)
- Testing Guide: [docs/gaps/MANUAL_TESTING_GUIDE.md](./MANUAL_TESTING_GUIDE.md)
- Feature Overview: [docs/gaps/README.md](./README.md)

## Need Help?

Check the comprehensive setup guide at:
`apps/api/prisma/seeds/README-NEW-PERMISSIONS.md`
