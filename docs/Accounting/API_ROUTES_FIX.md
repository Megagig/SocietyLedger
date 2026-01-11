# Accounting Integration API Routes Fix

## Issues Resolved

### 1. Missing API Endpoints (404 Errors)
The accounting integration UI was failing with 404 errors for:
- `GET /api/accounting/sync/status`
- `GET /api/accounting/sync/errors`
- `POST /api/accounting/sync/transactions/bulk`
- `POST /api/accounting/sync/payments/bulk`

### 2. React Duplicate Key Warning
Breadcrumbs component was generating duplicate keys for `/dashboard` path.

## Root Causes

### API Routes Issue
- Sync status methods existed in `accounting-sync.controller.ts`
- Methods were NOT exported in main `accounting.controller.ts`
- Routes were NOT registered in `accounting.routes.ts`

### Breadcrumbs Issue
- Using `crumb.href` as key caused duplicates when multiple breadcrumbs had same href

## Solutions Applied

### 1. Added Sync Routes
**File**: `apps/api/src/modules/accounting/accounting.routes.ts`

Added 4 new routes:
```typescript
// Get sync status for all modules
GET /api/accounting/sync/status
→ accountingController.getSyncStatus

// Get sync error logs
GET /api/accounting/sync/errors
→ accountingController.getSyncErrors

// Bulk sync unsynced transactions
POST /api/accounting/sync/transactions/bulk
→ accountingController.bulkSyncTransactions

// Bulk sync unsynced payments
POST /api/accounting/sync/payments/bulk
→ accountingController.bulkSyncPayments
```

### 2. Added Controller Methods
**File**: `apps/api/src/modules/accounting/accounting.controller.ts`

Added 4 methods to the accountingController export:

#### `getSyncStatus()`
- Returns comprehensive sync status for all modules
- Modules: Finance (transactions, payments), Welfare (contributions, payouts), Cooperatives (savings, loans, repayments)
- Calculates: total, synced, unsynced, syncRate for each
- Returns overall aggregated stats

#### `bulkSyncTransactions()`
- Syncs up to 100 unsynced transactions at once
- Uses `accountingIntegrationService.onTransactionCreated()`
- Returns: total, synced, failed counts + first 10 errors

#### `bulkSyncPayments()`
- Syncs up to 100 unsynced payments at once
- Uses `accountingIntegrationService.onPaymentRecorded()`
- Returns: total, synced, failed counts + first 10 errors

#### `getSyncErrors()`
- Fetches last 50 sync error logs from audit log
- Filters by: `action: 'ACCOUNTING_SYNC_FAILED'`
- Ordered by: `createdAt DESC`

### 3. Fixed Breadcrumbs Duplicate Key
**File**: `apps/web/src/components/layout/Breadcrumbs.tsx`

Changed key generation:
```typescript
// Before (caused duplicates)
key={crumb.href}

// After (unique keys)
key={`${crumb.href}-${index}`}
```

## Verification

✅ All files compile without errors
✅ No TypeScript diagnostics
✅ Routes properly registered
✅ Controller methods exported
✅ Breadcrumbs keys unique

## Testing

To test the fixes:

1. **Navigate to Accounting Integration page**:
   - Go to Settings > Accounting Integration
   - Page should load without 404 errors

2. **Check sync status**:
   - Should display sync metrics for all modules
   - Overall sync rate should be visible

3. **Test manual sync** (if unsynced records exist):
   - Click "Sync Now" on Transactions or Payments
   - Should sync successfully and update counts

4. **Check breadcrumbs**:
   - Navigate through different pages
   - No duplicate key warnings in console

## Files Modified

1. `apps/api/src/modules/accounting/accounting.routes.ts` - Added 4 sync routes
2. `apps/api/src/modules/accounting/accounting.controller.ts` - Added 4 sync methods
3. `apps/web/src/components/layout/Breadcrumbs.tsx` - Fixed duplicate key issue

## Related Files

- `apps/api/src/modules/accounting/accounting-sync.controller.ts` - Original sync methods (can be deprecated)
- `apps/web/src/app/dashboard/settings/accounting-integration/page.tsx` - UI that consumes these endpoints
- `apps/api/src/services/accounting-integration.service.ts` - Service used by bulk sync methods
