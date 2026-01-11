# ACCOUNTING INTEGRATION - QUICK REFERENCE

**One-page guide for developers**

---

## 🎯 WHAT WE'RE BUILDING

A central integration service that automatically syncs ALL financial transactions to the accounting module using double-entry bookkeeping.

---

## 📁 KEY FILES TO CREATE/MODIFY

### NEW FILES (Create These)
```
apps/api/src/services/
└── accounting-integration.service.ts  ← MAIN INTEGRATION SERVICE

apps/web/src/app/dashboard/settings/
└── accounting-integration/
    └── page.tsx  ← SETTINGS PAGE
```

### FILES TO MODIFY (Add Sync Calls)
```
apps/api/src/modules/finance/
└── finance.controller.ts  ← Lines ~730, ~800, ~1650, ~1750

apps/api/src/modules/nigerian-payments/
└── nigerian-payments.controller.ts  ← verifyBankTransfer, confirmReconciliation

apps/api/src/modules/welfare/
└── welfare.service.ts  ← Lines ~340, ~650

apps/api/src/modules/cooperatives/
└── cooperatives.service.ts  ← Lines ~330, ~905, ~1253

apps/api/src/modules/reports/
└── reports.service.ts  ← Add data merging functions

apps/api/src/modules/accounting/
└── accounting.types.ts  ← Add new accounts to STANDARD_CHART_OF_ACCOUNTS
```

---

## 🔧 INTEGRATION PATTERN (Copy-Paste Template)

### In Any Controller/Service:

```typescript
// 1. Import the service
import { accountingIntegrationService } from '../../services/accounting-integration.service';

// 2. After creating/updating a financial record, call the appropriate method:

// For Finance transactions:
await accountingIntegrationService.onTransactionCreated(transaction, userId);

// For Finance payments:
await accountingIntegrationService.onPaymentRecorded(payment, userId);

// For Welfare contributions:
await accountingIntegrationService.onWelfareContributionConfirmed(contribution, fund, userId);

// For Welfare payouts:
await accountingIntegrationService.onWelfarePayoutDisbursed(payout, fund, userId);

// For Savings deposits:
await accountingIntegrationService.onSavingsDeposit(transaction, account, userId);

// For Savings withdrawals:
await accountingIntegrationService.onSavingsWithdrawal(transaction, account, userId);

// For Loan disbursements:
await accountingIntegrationService.onLoanDisbursed(loan, application, userId);

// For Loan repayments:
await accountingIntegrationService.onLoanRepayment(repayment, loan, userId);
```

### IMPORTANT: Always wrap in try-catch!

```typescript
try {
  // Your existing code to create/update record
  const transaction = await prisma.transaction.create({...});
  
  // Add accounting sync
  await accountingIntegrationService.onTransactionCreated(transaction, userId);
  
  return res.status(201).json({ success: true, data: transaction });
} catch (error) {
  // Accounting sync errors should NOT break the operation
  console.error('Accounting sync failed:', error);
  // Still return success for the main operation
  return res.status(201).json({ success: true, data: transaction });
}
```

---

## 📊 NEW ACCOUNTS TO ADD

Add these to `accounting.types.ts` in `STANDARD_CHART_OF_ACCOUNTS`:

```typescript
// Assets
{ code: '1300', name: 'Loans Receivable', type: 'ASSET', subType: 'current_asset', normalBalance: 'DEBIT' },

// Liabilities
{ code: '2300', name: 'Welfare Fund Liability', type: 'LIABILITY', subType: 'current_liability', normalBalance: 'CREDIT' },
{ code: '2400', name: 'Member Savings Liability', type: 'LIABILITY', subType: 'current_liability', normalBalance: 'CREDIT' },

// Income
{ code: '4700', name: 'Welfare Interest Income', type: 'INCOME', normalBalance: 'CREDIT' },
{ code: '4800', name: 'Loan Interest Income', type: 'INCOME', normalBalance: 'CREDIT' },
{ code: '4900', name: 'Fee Income', type: 'INCOME', normalBalance: 'CREDIT' },

// Expenses
{ code: '5800', name: 'Savings Interest Expense', type: 'EXPENSE', normalBalance: 'DEBIT' },
```

---

## 🗄️ DATABASE MIGRATION

Add these fields to ALL financial tables:

```prisma
model Transaction {
  // ... existing fields
  accountingSynced   Boolean  @default(false)
  accountingEntryId  Int?
}

model Payment {
  // ... existing fields
  accountingSynced   Boolean  @default(false)
  accountingEntryId  Int?
}

model WelfareContribution {
  // ... existing fields
  accountingSynced   Boolean  @default(false)
  accountingEntryId  Int?
}

model WelfarePayoutRequest {
  // ... existing fields
  accountingSynced   Boolean  @default(false)
  accountingEntryId  Int?
}

model SavingsTransaction {
  // ... existing fields
  accountingSynced   Boolean  @default(false)
  accountingEntryId  Int?
}

model Loan {
  // ... existing fields
  accountingSynced   Boolean  @default(false)
  accountingEntryId  Int?
}

model LoanRepayment {
  // ... existing fields
  accountingSynced   Boolean  @default(false)
  accountingEntryId  Int?
}
```

Run migration:
```bash
npx prisma migrate dev --name add_accounting_sync_fields
npx prisma generate
```

---

## 🧪 TESTING CHECKLIST

### Unit Tests
```typescript
describe('accountingIntegrationService', () => {
  it('should sync transaction to accounting', async () => {
    const transaction = await createTestTransaction();
    await accountingIntegrationService.onTransactionCreated(transaction, 1);
    
    const entry = await prisma.journalEntry.findFirst({
      where: { sourceType: 'auto_sync', sourceId: transaction.id }
    });
    
    expect(entry).toBeDefined();
    expect(entry.status).toBe('POSTED');
  });
  
  it('should handle missing accounts gracefully', async () => {
    // Test with association that has no chart of accounts
    const transaction = await createTestTransaction();
    
    // Should not throw error
    await expect(
      accountingIntegrationService.onTransactionCreated(transaction, 1)
    ).resolves.not.toThrow();
  });
});
```

### Integration Tests
```bash
# Test complete workflow
1. Create transaction → Verify journal entry created
2. Record payment → Verify journal entry created
3. Check financial statements → Verify data is accurate
4. Test with multiple modules → Verify all synced
```

---

## 🚀 DEPLOYMENT STEPS

### 1. Pre-Deployment
```bash
# Backup database
pg_dump societyledger > backup_$(date +%Y%m%d).sql

# Run tests
npm test

# Build
npm run build
```

### 2. Deploy to Staging
```bash
# Deploy code
git push staging feature/accounting-integration

# Run migrations
npm run db:migrate

# Test on staging
npm run test:e2e
```

### 3. Deploy to Production
```bash
# Deploy code
git push production main

# Run migrations
npm run db:migrate

# Monitor logs
pm2 logs
```

### 4. Post-Deployment
```bash
# Run data migration (if needed)
npm run migrate:accounting

# Monitor sync status
curl https://api.yourdomain.com/api/accounting/sync/status

# Check for errors
tail -f logs/accounting-sync.log
```

---

## 🐛 TROUBLESHOOTING

### Issue: Sync not working
```bash
# Check if accounting is initialized
SELECT COUNT(*) FROM "ChartOfAccount" WHERE "associationId" = 1;
# Should return > 0

# Check for sync errors
SELECT * FROM "AuditLog" WHERE action = 'ACCOUNTING_SYNC_FAILED';

# Check sync status
SELECT COUNT(*) FROM "Transaction" WHERE "accountingSynced" = false;
```

### Issue: Journal entries not balanced
```bash
# Find unbalanced entries
SELECT 
  id, 
  "entryNumber", 
  "totalDebit", 
  "totalCredit",
  ("totalDebit" - "totalCredit") as difference
FROM "JournalEntry"
WHERE "totalDebit" != "totalCredit";
```

### Issue: Missing accounts
```bash
# Check if required accounts exist
SELECT code, name FROM "ChartOfAccount" 
WHERE "associationId" = 1 
AND code IN ('1112', '1121', '1122', '1300', '2300', '2400', '4110', '4800');

# If missing, initialize chart of accounts
POST /api/accounting/chart-of-accounts/initialize
```

---

## 📞 SUPPORT

### Documentation
- Full Roadmap: `COMPLETE_ACCOUNTING_INTEGRATION_ROADMAP.md`
- Architecture: `INTEGRATION_ARCHITECTURE.md`
- Summary: `INTEGRATION_SUMMARY.md`

### Code Examples
- Integration Service: `apps/api/src/services/accounting-integration.service.ts`
- Accounting Service: `apps/api/src/modules/accounting/accounting.service.ts`

### Testing
- Unit Tests: `apps/api/__tests__/accounting-integration.test.ts`
- Integration Tests: `apps/api/__tests__/e2e/accounting-integration.test.ts`

---

## ✅ QUICK WIN CHECKLIST

Day 1:
- [ ] Create `accounting-integration.service.ts`
- [ ] Add new accounts to chart
- [ ] Write helper methods

Day 2:
- [ ] Implement Finance integration methods
- [ ] Add sync calls to finance.controller.ts
- [ ] Test transaction sync

Day 3:
- [ ] Implement Welfare integration methods
- [ ] Add sync calls to welfare.service.ts
- [ ] Test welfare sync

Day 4:
- [ ] Implement Cooperatives integration methods
- [ ] Add sync calls to cooperatives.service.ts
- [ ] Test cooperative sync

Day 5:
- [ ] Run database migrations
- [ ] Deploy to staging
- [ ] Full integration testing

---

**Remember: Accounting sync should NEVER break module operations!**

**Always use try-catch and graceful error handling.**

