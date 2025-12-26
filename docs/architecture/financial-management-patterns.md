# Financial Management Implementation Patterns

**Document Type:** Architecture & Best Practices  
**Created:** December 26, 2025  
**Purpose:** Knowledge base for financial management patterns and reusable code

---

## 🎯 Core Patterns

### 1. **Money Handling Pattern**

**Problem:** JavaScript numbers lose precision with decimal arithmetic  
**Solution:** Use Prisma Decimal for all money calculations

```typescript
import { Decimal } from '@prisma/client/runtime/library';

// ❌ WRONG - Loses precision
const total = 10.1 + 20.2; // 30.299999999999997

// ✅ CORRECT - Exact precision
const amount1 = new Decimal(10.1);
const amount2 = new Decimal(20.2);
const total = amount1.plus(amount2); // Decimal(30.3)

// Decimal methods
total.plus(amount);      // Addition
total.minus(amount);     // Subtraction
total.times(amount);     // Multiplication
total.dividedBy(amount); // Division
total.toNumber();        // Convert to number for display
```

**Database Schema:**
```prisma
model Transaction {
  amount Decimal @db.Decimal(10, 2) // 10 digits, 2 decimal places
}
```

**API Response:**
```typescript
// Decimals serialize to strings in JSON
{
  "amount": "1000.50",  // String, not number
  "balance": "250.75"
}

// Frontend: Parse back to number for display
const amount = Number(transaction.amount);
```

---

### 2. **Atomic Transaction Pattern**

**Problem:** Multiple database operations must succeed or fail together  
**Solution:** Use Prisma transactions

```typescript
// ✅ CORRECT - Atomic payment recording
const [payment] = await prisma.$transaction([
  // Create payment record
  prisma.payment.create({
    data: {
      transactionId: txnId,
      amountPaid: amount,
      receiptNumber: receiptNo,
    },
  }),
  
  // Update transaction status
  prisma.transaction.update({
    where: { id: txnId },
    data: { 
      status: 'paid',
      paymentDate: new Date(),
    },
  }),
]);

// If either fails, both rollback
```

**Use Cases:**
- Recording payments (payment + transaction update)
- Bulk operations (multiple creates/updates)
- Financial transfers (debit + credit)

---

### 3. **Audit Logging Pattern**

**Problem:** Need to track who did what and when  
**Solution:** Log all financial actions

```typescript
// After any financial operation
await prisma.auditLog.create({
  data: {
    associationId,
    userId: req.user!.id,
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'BULK_CREATE',
    tableName: 'transactions' | 'payments' | 'financial_categories',
    recordId: record.id,
    oldValues: existing, // For updates/deletes
    newValues: updated,  // For creates/updates
  },
});
```

**Benefits:**
- Compliance (who approved what)
- Debugging (trace issues)
- Accountability (financial transparency)
- Rollback capability (restore previous state)

---

### 4. **Multi-Tenant Isolation Pattern**

**Problem:** Prevent data leakage between associations  
**Solution:** Always filter by associationId

```typescript
// ✅ CORRECT - Every query includes associationId
const associationId = req.user?.associationId;

const transactions = await prisma.transaction.findMany({
  where: { 
    associationId,  // CRITICAL - Always include
    status: 'pending',
  },
});

// ❌ WRONG - Missing associationId
const transactions = await prisma.transaction.findMany({
  where: { status: 'pending' }, // Leaks data across tenants!
});
```

**Middleware Enforcement:**
```typescript
// apps/api/src/middleware/tenant.middleware.ts
export const tenantMiddleware = (req, res, next) => {
  const associationId = req.user?.associationId;
  if (!associationId) {
    return res.status(400).json({ error: 'Association required' });
  }
  req.associationId = associationId;
  next();
};
```

---

### 5. **Reference Number Generation Pattern**

**Problem:** Need unique, human-readable identifiers  
**Solution:** Prefix + sequential number with padding

```typescript
// Transaction reference: TXN000001, TXN000002, ...
const txnCount = await prisma.transaction.count({ 
  where: { associationId } 
});
const referenceNumber = `TXN${String(txnCount + 1).padStart(6, '0')}`;

// Payment receipt: RCP000001, RCP000002, ...
const paymentCount = await prisma.payment.count({ 
  where: { associationId } 
});
const receiptNumber = `RCP${String(paymentCount + 1).padStart(6, '0')}`;
```

**Benefits:**
- Human-readable
- Sortable
- Unique per association
- Easy to search

**Considerations:**
- Race conditions: Use database-level unique constraints
- Gaps: Acceptable (failed transactions leave gaps)
- Prefix: Customize per association (future enhancement)

---

### 6. **Payment Status Calculation Pattern**

**Problem:** Determine if transaction is paid, partial, or pending  
**Solution:** Calculate from payment history

```typescript
// Get transaction with payments
const transaction = await prisma.transaction.findFirst({
  where: { id: txnId, associationId },
  include: { payments: true },
});

// Calculate total paid
const totalPaid = transaction.payments.reduce(
  (sum, p) => sum.plus(p.amountPaid),
  new Decimal(0)
);

// Calculate balance
const balance = new Decimal(transaction.amount).minus(totalPaid);

// Determine status
let status: string;
if (balance.lessThanOrEqualTo(0)) {
  status = 'paid';
} else if (totalPaid.greaterThan(0)) {
  status = 'partial';
} else {
  status = 'pending';
}

// Update transaction
await prisma.transaction.update({
  where: { id: txnId },
  data: { status },
});
```

---

### 7. **Bulk Operation Pattern**

**Problem:** Create transactions for multiple members efficiently  
**Solution:** Use Prisma batch operations

```typescript
// ✅ CORRECT - Batch create
const transactions = await prisma.$transaction(
  memberIds.map((memberId, index) =>
    prisma.transaction.create({
      data: {
        associationId,
        memberId,
        categoryId,
        amount,
        referenceNumber: `TXN${String(txnCount + index + 1).padStart(6, '0')}`,
        status: 'pending',
      },
    })
  )
);

// ❌ WRONG - Sequential creates (slow)
for (const memberId of memberIds) {
  await prisma.transaction.create({ ... });
}
```

**Benefits:**
- Faster (single database round-trip)
- Atomic (all succeed or all fail)
- Consistent reference numbers

---

### 8. **Validation Schema Pattern**

**Problem:** Ensure data integrity at API boundary  
**Solution:** Zod schemas for type-safe validation

```typescript
import { z } from 'zod';

// Define schema
const createTransactionSchema = z.object({
  memberId: z.number().int().positive('Member ID is required'),
  categoryId: z.number().int().positive('Category ID is required'),
  amount: z.number().positive('Amount must be positive'),
  dueDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// Validate in controller
try {
  const validatedData = createTransactionSchema.parse(req.body);
  // Use validatedData (type-safe)
} catch (error) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ 
      success: false, 
      message: 'Validation error', 
      errors: error.errors 
    });
  }
}
```

**Benefits:**
- Type safety (TypeScript inference)
- Clear error messages
- Reusable schemas
- Runtime validation

---

### 9. **Permission-Based Access Pattern**

**Problem:** Control who can perform financial operations  
**Solution:** RBAC middleware + frontend guards

**Backend:**
```typescript
// apps/api/src/modules/finance/finance.routes.ts
import { requirePermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';

router.post('/transactions',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.TRANSACTION_CREATE),
  financeController.createTransaction
);
```

**Frontend:**
```typescript
// apps/web/src/app/dashboard/finance/transactions/page.tsx
import { Can } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';

<Can permission={PERMISSIONS.TRANSACTION_CREATE}>
  <button onClick={createTransaction}>
    Create Transaction
  </button>
</Can>
```

**Permissions:**
```typescript
// Shared permissions constant
export const PERMISSIONS = {
  // Finance
  FINANCE_VIEW: 'finance:view',
  FINANCE_CREATE: 'finance:create',
  FINANCE_EDIT: 'finance:edit',
  FINANCE_DELETE: 'finance:delete',
  
  // Transactions
  TRANSACTION_VIEW: 'transaction:view',
  TRANSACTION_CREATE: 'transaction:create',
  TRANSACTION_EDIT: 'transaction:edit',
  TRANSACTION_DELETE: 'transaction:delete',
  
  // Payments
  PAYMENT_VIEW: 'payment:view',
  PAYMENT_CREATE: 'payment:create',
  PAYMENT_CONFIRM: 'payment:confirm',
};
```

---

### 10. **Pagination Pattern**

**Problem:** Large datasets slow down API and UI  
**Solution:** Cursor-based or offset pagination

```typescript
// Parse query params
const page = parseInt(req.query.page as string) || 1;
const limit = parseInt(req.query.limit as string) || 20;
const skip = (page - 1) * limit;

// Query with pagination
const [transactions, totalCount] = await Promise.all([
  prisma.transaction.findMany({
    where: { associationId },
    skip,
    take: limit,
    orderBy: { createdAt: 'desc' },
  }),
  prisma.transaction.count({ where: { associationId } }),
]);

// Return with pagination metadata
return res.json({
  success: true,
  data: {
    transactions,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      hasMore: skip + transactions.length < totalCount,
    },
  },
});
```

**Frontend:**
```typescript
const [page, setPage] = useState(1);
const [limit, setLimit] = useState(20);

// Fetch with pagination
useEffect(() => {
  fetchTransactions(page, limit);
}, [page, limit]);

// Pagination controls
<button onClick={() => setPage(page - 1)} disabled={page === 1}>
  Previous
</button>
<span>Page {page} of {totalPages}</span>
<button onClick={() => setPage(page + 1)} disabled={page === totalPages}>
  Next
</button>
```

---

## 🎨 UI Patterns

### 1. **Status Badge Pattern**

**Problem:** Visually distinguish transaction statuses  
**Solution:** Color-coded badges with icons

```typescript
const getStatusBadge = (status: string) => {
  const badges: Record<string, { class: string; icon: JSX.Element }> = {
    paid: { 
      class: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      icon: <CheckCircle className="w-3 h-3" />
    },
    pending: { 
      class: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      icon: <Clock className="w-3 h-3" />
    },
    overdue: { 
      class: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      icon: <AlertTriangle className="w-3 h-3" />
    },
  };

  const badge = badges[status] || badges.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.class}`}>
      {badge.icon}
      {status}
    </span>
  );
};
```

---

### 2. **Currency Formatting Pattern**

**Problem:** Display money consistently  
**Solution:** Reusable formatter function

```typescript
const formatCurrency = (amount: number | string) => {
  return `₦${Number(amount).toLocaleString()}`;
};

// Usage
<p>{formatCurrency(transaction.amount)}</p>
// Output: ₦1,000.50
```

**With Intl API (more robust):**
```typescript
const formatCurrency = (amount: number | string, currency = 'NGN') => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
  }).format(Number(amount));
};
```

---

### 3. **Filter State Pattern**

**Problem:** Manage multiple filter states  
**Solution:** Centralized filter state with URL sync

```typescript
const [filters, setFilters] = useState({
  search: '',
  status: '',
  type: '',
  categoryId: '',
  startDate: '',
  endDate: '',
});

// Update filter
const updateFilter = (key: string, value: string) => {
  setFilters(prev => ({ ...prev, [key]: value }));
  setPage(1); // Reset to first page
};

// Build query params
const params = new URLSearchParams({
  page: page.toString(),
  limit: limit.toString(),
  ...(filters.search && { search: filters.search }),
  ...(filters.status && { status: filters.status }),
  ...(filters.type && { type: filters.type }),
});

// Fetch with filters
useEffect(() => {
  fetchTransactions(params);
}, [filters, page, limit]);
```

---

### 4. **Loading State Pattern**

**Problem:** Show feedback during async operations  
**Solution:** Loading states with skeleton screens

```typescript
const [isLoading, setIsLoading] = useState(true);
const [data, setData] = useState(null);
const [error, setError] = useState('');

const fetchData = async () => {
  setIsLoading(true);
  setError('');
  try {
    const response = await apiGet('/api/finance/transactions');
    const result = await response.json();
    setData(result.data);
  } catch (err: any) {
    setError(err.message);
  } finally {
    setIsLoading(false);
  }
};

// Render
if (isLoading) return <LoadingSpinner />;
if (error) return <ErrorMessage message={error} />;
if (!data) return <EmptyState />;
return <DataTable data={data} />;
```

---

## 🔒 Security Patterns

### 1. **Input Sanitization**

```typescript
// Backend: Zod validation
const schema = z.object({
  notes: z.string().max(500).optional(),
});

// Frontend: Trim and validate
const sanitizeInput = (input: string) => {
  return input.trim().slice(0, 500);
};
```

### 2. **SQL Injection Prevention**

```typescript
// ✅ CORRECT - Prisma uses parameterized queries
const transactions = await prisma.transaction.findMany({
  where: { 
    referenceNumber: { contains: userInput } // Safe
  },
});

// ❌ WRONG - Raw SQL with user input
await prisma.$queryRaw`
  SELECT * FROM transactions 
  WHERE reference_number LIKE '%${userInput}%'
`; // Vulnerable to SQL injection!
```

### 3. **Authorization Checks**

```typescript
// Always verify ownership before operations
const transaction = await prisma.transaction.findFirst({
  where: { 
    id: txnId,
    associationId: req.user.associationId, // Verify ownership
  },
});

if (!transaction) {
  return res.status(404).json({ error: 'Not found' });
}
```

---

## 📊 Performance Patterns

### 1. **Selective Field Loading**

```typescript
// ✅ CORRECT - Only load needed fields
const transactions = await prisma.transaction.findMany({
  select: {
    id: true,
    referenceNumber: true,
    amount: true,
    status: true,
    member: {
      select: { firstName: true, lastName: true },
    },
  },
});

// ❌ WRONG - Loads all fields
const transactions = await prisma.transaction.findMany({
  include: { member: true }, // Loads all member fields
});
```

### 2. **Parallel Queries**

```typescript
// ✅ CORRECT - Parallel execution
const [transactions, categories, stats] = await Promise.all([
  prisma.transaction.findMany({ ... }),
  prisma.financialCategory.findMany({ ... }),
  prisma.transaction.aggregate({ ... }),
]);

// ❌ WRONG - Sequential execution
const transactions = await prisma.transaction.findMany({ ... });
const categories = await prisma.financialCategory.findMany({ ... });
const stats = await prisma.transaction.aggregate({ ... });
```

### 3. **Debounced Search**

```typescript
import { useDebounce } from '@/hooks/useDebounce';

const [search, setSearch] = useState('');
const debouncedSearch = useDebounce(search, 500); // 500ms delay

useEffect(() => {
  fetchTransactions(debouncedSearch);
}, [debouncedSearch]);
```

---

## 🧪 Testing Patterns

### 1. **Unit Test Pattern**

```typescript
describe('Payment Recording', () => {
  it('should record payment and update transaction status', async () => {
    // Arrange
    const transaction = await createTestTransaction({ amount: 1000 });
    
    // Act
    const payment = await recordPayment({
      transactionId: transaction.id,
      amountPaid: 1000,
    });
    
    // Assert
    expect(payment.amountPaid).toBe(1000);
    
    const updated = await getTransaction(transaction.id);
    expect(updated.status).toBe('paid');
  });
  
  it('should prevent overpayment', async () => {
    const transaction = await createTestTransaction({ amount: 1000 });
    
    await expect(
      recordPayment({
        transactionId: transaction.id,
        amountPaid: 1500, // More than amount
      })
    ).rejects.toThrow('Payment amount exceeds balance');
  });
});
```

### 2. **Integration Test Pattern**

```typescript
describe('Due Generation Workflow', () => {
  it('should generate dues for multiple members', async () => {
    // Create test data
    const category = await createTestCategory({ type: 'due', amount: 500 });
    const members = await createTestMembers(10);
    
    // Generate dues
    const response = await request(app)
      .post('/api/finance/transactions/bulk')
      .send({
        categoryId: category.id,
        memberIds: members.map(m => m.id),
        amount: 500,
      });
    
    expect(response.status).toBe(201);
    expect(response.body.data.count).toBe(10);
    
    // Verify transactions created
    const transactions = await prisma.transaction.findMany({
      where: { categoryId: category.id },
    });
    expect(transactions).toHaveLength(10);
  });
});
```

---

## 📚 Reusable Code Snippets

### 1. **API Client Wrapper**

```typescript
// apps/web/src/utils/api.ts
export const apiGet = async (url: string) => {
  return fetch(url, {
    method: 'GET',
    credentials: 'include', // Include cookies
    headers: { 'Content-Type': 'application/json' },
  });
};

export const apiPost = async (url: string, data: any) => {
  return fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
};
```

### 2. **Error Handler Middleware**

```typescript
// apps/api/src/middleware/error.middleware.ts
export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: err.errors,
    });
  }
  
  res.status(500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
};
```

### 3. **Date Formatter**

```typescript
export const formatDate = (date: string | Date, format = 'short') => {
  const d = new Date(date);
  
  if (format === 'short') {
    return d.toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
  
  if (format === 'long') {
    return d.toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  
  return d.toISOString();
};
```

---

## 🎓 Best Practices Summary

### **DO:**
✅ Use Decimal for money calculations  
✅ Always filter by associationId  
✅ Log all financial actions  
✅ Validate inputs with Zod  
✅ Use atomic transactions  
✅ Generate unique reference numbers  
✅ Check permissions before operations  
✅ Handle errors gracefully  
✅ Paginate large datasets  
✅ Use TypeScript strictly  

### **DON'T:**
❌ Use JavaScript numbers for money  
❌ Skip associationId in queries  
❌ Allow operations without audit logs  
❌ Trust user input without validation  
❌ Perform multiple DB operations without transactions  
❌ Reuse reference numbers  
❌ Skip permission checks  
❌ Expose raw errors to users  
❌ Load all data at once  
❌ Use `any` types  

---

**This document serves as a knowledge base for future financial feature development.**

**Last Updated:** December 26, 2025
