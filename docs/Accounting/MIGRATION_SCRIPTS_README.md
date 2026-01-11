# ACCOUNTING INTEGRATION - MIGRATION SCRIPTS
## Quick Reference Guide

**Version:** 1.0  
**Date:** January 11, 2026  
**Status:** Production Ready  

---

## 📋 OVERVIEW

This directory contains scripts for migrating existing financial records to the accounting system and rolling back if needed.

### Scripts Available
1. **migrate-to-accounting.ts** - Migrate unsynced records to accounting
2. **rollback-accounting-sync.ts** - Rollback accounting sync

---

## 🚀 QUICK START

### Migrate Single Association
```bash
# Dry run first (recommended)
npm run migrate:accounting -- --dry-run --association-id=1

# Run actual migration
npm run migrate:accounting -- --association-id=1
```

### Migrate All Associations
```bash
# Dry run first (recommended)
npm run migrate:accounting -- --dry-run --all

# Run actual migration
npm run migrate:accounting -- --all
```

### Rollback if Needed
```bash
# Dry run first (recommended)
npm run rollback:accounting -- --dry-run --association-id=1

# Run actual rollback
npm run rollback:accounting -- --association-id=1
```

---

## 📖 MIGRATION SCRIPT

### Purpose
Syncs existing unsynced financial records to the accounting system by creating journal entries.

### What It Migrates
1. **Transactions** (Finance module)
2. **Payments** (Finance module)
3. **Welfare Contributions**
4. **Welfare Payouts**
5. **Savings Transactions**
6. **Loans**
7. **Loan Repayments**

### Command-Line Options

| Option | Description | Example |
|--------|-------------|---------|
| `--association-id=<id>` | Migrate single association | `--association-id=1` |
| `--all` | Migrate all associations | `--all` |
| `--dry-run` | Test without making changes | `--dry-run` |
| `--batch-size=<n>` | Records per batch (default: 50) | `--batch-size=100` |
| `--delay=<ms>` | Delay between batches (default: 100ms) | `--delay=200` |

### Usage Examples

#### Basic Migration
```bash
npm run migrate:accounting -- --association-id=1
```

#### Dry Run (Test First)
```bash
npm run migrate:accounting -- --dry-run --association-id=1
```

#### Custom Batch Size
```bash
npm run migrate:accounting -- --batch-size=100 --association-id=1
```

#### All Associations
```bash
npm run migrate:accounting -- --all
```

#### Custom Batch Size and Delay
```bash
npm run migrate:accounting -- --batch-size=100 --delay=200 --association-id=1
```

### How It Works

1. **Check Accounting Initialization**
   - Verifies chart of accounts exists
   - Skips association if not initialized

2. **Find Unsynced Records**
   - Queries records where `accountingSynced = false`
   - Filters by status (e.g., skips voided transactions)

3. **Process in Batches**
   - Processes records in configurable batches
   - Delays between batches to prevent overload

4. **Call Integration Service**
   - Uses existing `accountingIntegrationService` methods
   - Creates journal entries automatically

5. **Track Statistics**
   - Counts total, synced, and failed records
   - Displays success rate per module

6. **Handle Errors Gracefully**
   - Single failure doesn't stop migration
   - Errors logged to console and audit log
   - Can re-run to retry failed records

### Output Example

```
============================================================
MIGRATING ASSOCIATION: 1
============================================================

📝 Migrating Transactions for association 1...
  Found 150 unsynced transactions
  ✓ Synced transaction 1 (1/150)
  ✓ Synced transaction 2 (2/150)
  ...
  Processed 50/150, pausing...
  ...
  ✓ Synced transaction 150 (150/150)

💰 Migrating Payments for association 1...
  Found 120 unsynced payments
  ✓ Synced payment 1 (1/120)
  ...

✅ Migration completed for association 1 in 45.23s

============================================================
MIGRATION STATISTICS
============================================================

Transactions:
  Total:   150
  Synced:  148 ✓
  Failed:  2 ✗
  Success: 98.7%

Payments:
  Total:   120
  Synced:  120 ✓
  Failed:  0 ✗
  Success: 100.0%

[... other modules ...]

------------------------------------------------------------
OVERALL TOTALS:
  Total Records: 500
  Synced:        495 ✓
  Failed:        5 ✗
  Success Rate:  99.0%
============================================================
```

---

## 🔄 ROLLBACK SCRIPT

### Purpose
Rolls back accounting sync by voiding journal entries and resetting sync flags.

### What It Does
1. **Voids Journal Entries**
   - Finds entries created by auto-sync
   - Updates status to VOIDED
   - Adds "[VOIDED BY ROLLBACK]" to description

2. **Resets Sync Flags**
   - Sets `accountingSynced = false`
   - Clears `accountingEntryId` references
   - Applies to all 7 tables

### Command-Line Options

| Option | Description | Example |
|--------|-------------|---------|
| `--association-id=<id>` | Rollback single association | `--association-id=1` |
| `--all` | Rollback all associations | `--all` |
| `--dry-run` | Test without making changes | `--dry-run` |
| `--date-from=<date>` | Rollback from date | `--date-from=2026-01-01` |
| `--date-to=<date>` | Rollback to date | `--date-to=2026-01-31` |

### Usage Examples

#### Basic Rollback
```bash
npm run rollback:accounting -- --association-id=1
```

#### Dry Run (Test First)
```bash
npm run rollback:accounting -- --dry-run --association-id=1
```

#### Rollback Specific Date Range
```bash
npm run rollback:accounting -- --date-from=2026-01-01 --association-id=1
```

#### Rollback Date Range
```bash
npm run rollback:accounting -- --date-from=2026-01-01 --date-to=2026-01-31 --association-id=1
```

#### All Associations
```bash
npm run rollback:accounting -- --all
```

### Safety Features

1. **5-Second Confirmation Delay**
   - Displays configuration
   - Waits 5 seconds before execution
   - User can press Ctrl+C to cancel

2. **Dry Run Mode**
   - Test rollback without making changes
   - See what would be rolled back

3. **Non-Destructive**
   - Voids entries instead of deleting
   - Maintains audit trail
   - Can be re-synced later

4. **Date Range Filtering**
   - Rollback specific time periods
   - Precision control

### Output Example

```
============================================================
ACCOUNTING INTEGRATION - ROLLBACK
============================================================

Configuration:
  Association ID: 1
  Dry Run:        false
  Date From:      2026-01-01T00:00:00.000Z
  Date To:        N/A

⚠️  WARNING: This will void journal entries and reset sync flags!
   Press Ctrl+C to cancel, or wait 5 seconds to continue...

============================================================
ROLLING BACK ASSOCIATION: 1
============================================================

📋 Voiding auto-synced journal entries for association 1...
  Found 50 journal entries to void
  ✓ Voided journal entry JE-2026-001
  ✓ Voided journal entry JE-2026-002
  ...

📝 Resetting transaction sync flags for association 1...
  Found 150 synced transactions
  ✓ Reset 150 transactions

💰 Resetting payment sync flags for association 1...
  Found 120 synced payments
  ✓ Reset 120 payments

[... other modules ...]

✅ Rollback completed for association 1 in 12.45s

============================================================
ROLLBACK STATISTICS
============================================================

Journal Entries:
  Total:  50
  Voided: 50 ✓
  Failed: 0 ✗

Transactions:
  Total: 150
  Reset: 150 ✓
  Failed: 0 ✗

[... other modules ...]

------------------------------------------------------------
OVERALL TOTALS:
  Total Records: 520
  Reset/Voided:  520 ✓
  Failed:        0 ✗
============================================================
```

---

## ⚠️ IMPORTANT NOTES

### Before Running Migration

1. **Backup Database**
   ```bash
   pg_dump your_database > backup_$(date +%Y%m%d).sql
   ```

2. **Test with Dry Run**
   ```bash
   npm run migrate:accounting -- --dry-run --association-id=1
   ```

3. **Verify Accounting Initialized**
   - Ensure chart of accounts exists
   - Check required accounts present

4. **Start with Single Association**
   - Test on one association first
   - Verify results before migrating all

### During Migration

1. **Monitor Progress**
   - Watch console output
   - Check for errors
   - Note success rates

2. **Check Database Load**
   - Monitor CPU usage
   - Monitor memory usage
   - Adjust batch size if needed

3. **Don't Interrupt**
   - Let migration complete
   - Graceful error handling continues on failure

### After Migration

1. **Verify Results**
   ```bash
   # Check sync status
   curl http://localhost:3000/api/accounting/sync/status
   ```

2. **Review Errors**
   ```bash
   # View sync errors
   curl http://localhost:3000/api/accounting/sync/errors
   ```

3. **Verify Financial Statements**
   - Generate income statement
   - Generate balance sheet
   - Verify accuracy

4. **Retry Failed Records**
   - Re-run migration to retry failures
   - Only unsynced records will be processed

---

## 🐛 TROUBLESHOOTING

### Migration Issues

#### Issue: "Accounting not initialized"
**Solution:** Initialize chart of accounts first
```bash
POST /api/accounting/initialize
```

#### Issue: "Required accounts not found"
**Solution:** Ensure all required accounts exist:
- 1112 (Bank Account)
- 1121 (Dues Receivable)
- 1122 (Levy Receivable)
- 1300 (Loans Receivable)
- 2300 (Welfare Liability)
- 2400 (Savings Liability)
- 4110 (Membership Dues)
- 4200 (Levy Income)
- 4800 (Interest Income)

#### Issue: High failure rate
**Solution:**
1. Check error logs
2. Verify data integrity
3. Fix data issues
4. Re-run migration

#### Issue: Slow performance
**Solution:**
1. Increase batch size: `--batch-size=100`
2. Reduce delay: `--delay=50`
3. Check database performance
4. Run during off-peak hours

### Rollback Issues

#### Issue: Can't find journal entries
**Solution:** Check entry descriptions contain "auto_sync"

#### Issue: Rollback too broad
**Solution:** Use date range filtering:
```bash
npm run rollback:accounting -- --date-from=2026-01-01 --date-to=2026-01-31 --association-id=1
```

---

## 📊 MONITORING

### Check Sync Status
```bash
curl http://localhost:3000/api/accounting/sync/status
```

### View Sync Errors
```bash
curl http://localhost:3000/api/accounting/sync/errors
```

### Check Database
```sql
-- Count unsynced records
SELECT 
  'Transactions' as module,
  COUNT(*) as unsynced
FROM "Transaction"
WHERE "accountingSynced" = false

UNION ALL

SELECT 
  'Payments' as module,
  COUNT(*) as unsynced
FROM "Payment"
WHERE "accountingSynced" = false;
```

---

## 🎯 BEST PRACTICES

1. **Always Dry Run First**
   - Test before production
   - Verify expected results

2. **Backup Before Migration**
   - Database backup essential
   - Test restore procedure

3. **Start Small**
   - Single association first
   - Verify before scaling

4. **Monitor Progress**
   - Watch console output
   - Check database load
   - Review error logs

5. **Verify Results**
   - Check sync status
   - Review financial statements
   - Validate accuracy

6. **Document Issues**
   - Note any errors
   - Track resolution
   - Update procedures

---

## 📞 SUPPORT

### Common Commands

```bash
# Migration dry run
npm run migrate:accounting -- --dry-run --association-id=1

# Migration production
npm run migrate:accounting -- --association-id=1

# Rollback dry run
npm run rollback:accounting -- --dry-run --association-id=1

# Rollback production
npm run rollback:accounting -- --association-id=1

# Check sync status
curl http://localhost:3000/api/accounting/sync/status

# View errors
curl http://localhost:3000/api/accounting/sync/errors
```

### Documentation
- **Implementation Log**: `docs/Accounting/IMPLEMENTATION_LOG.md`
- **Testing Guide**: `docs/Accounting/WEEK_5_TESTING_GUIDE.md`
- **Day 29-30 Summary**: `docs/Accounting/WEEK_5_DAY_29-30_SUMMARY.md`
- **Complete Roadmap**: `docs/Accounting/COMPLETE_ACCOUNTING_INTEGRATION_ROADMAP.md`

---

**Version:** 1.0  
**Last Updated:** January 11, 2026  
**Status:** Production Ready  
**Maintainer:** SocietyLedger Development Team
