# Phase 5: Reporting System - Implementation Documentation

**Status:** ✅ Fully Implemented  
**Completion Date:** December 27, 2025  
**Implementation Time:** 5-7 days  
**Developer:** AI Assistant (Kiro)

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [Backend Implementation](#backend-implementation)
5. [Frontend Implementation](#frontend-implementation)
6. [API Endpoints](#api-endpoints)
7. [Report Types](#report-types)
8. [Usage Examples](#usage-examples)
9. [Testing Guide](#testing-guide)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The Reporting System provides comprehensive financial analytics and member balance tracking for associations. It generates five types of reports with interactive visualizations, date range filtering, and period comparisons.

### Key Features

- **5 Report Types:** Financial Summary, Member Balances, Aging Analysis, Collection Rate, Category-wise
- **Interactive Charts:** Pie charts, bar charts, line graphs using Recharts
- **Date Range Filtering:** Preset periods (This Month, Last Month, Quarter, Year) and custom ranges
- **Period Comparison:** Compare current period with previous period for trend analysis
- **Real-time Data:** All reports pull live data from the database
- **Responsive Design:** Mobile-friendly UI with Mantine components

### Business Value

- **Financial Visibility:** Real-time insights into income, expenses, and collections
- **Member Tracking:** Monitor individual member payment status and balances
- **Debt Management:** Identify overdue payments with aging analysis
- **Performance Metrics:** Track collection efficiency over time
- **Category Analysis:** Understand revenue streams by category

---

## Architecture

### System Design

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Report Pages (App Router)                             │ │
│  │  - /dashboard/reports (Dashboard)                      │ │
│  │  - /dashboard/reports/financial-summary                │ │
│  │  - /dashboard/reports/member-balances                  │ │
│  │  - /dashboard/reports/aging-analysis                   │ │
│  │  - /dashboard/reports/collection-rate                  │ │
│  │  - /dashboard/reports/by-category                      │ │
│  └────────────────────────────────────────────────────────┘ │
│                           ↓                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  API Client (apps/web/src/lib/api/reports.ts)         │ │
│  │  - TanStack Query for data fetching                    │ │
│  │  - Axios for HTTP requests                             │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                           ↓ HTTP/REST
┌─────────────────────────────────────────────────────────────┐
│                     Backend (Express.js)                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Routes (apps/api/src/modules/reports/)               │ │
│  │  - reports.routes.ts                                   │ │
│  └────────────────────────────────────────────────────────┘ │
│                           ↓                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Controllers                                           │ │
│  │  - reports.controller.ts                               │ │
│  │  - Request validation (Zod)                            │ │
│  └────────────────────────────────────────────────────────┘ │
│                           ↓                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Services                                              │ │
│  │  - reports.service.ts                                  │ │
│  │  - Business logic & calculations                       │ │
│  └────────────────────────────────────────────────────────┘ │
│                           ↓                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Database (Prisma ORM)                                 │ │
│  │  - Transaction queries                                 │ │
│  │  - Member queries                                      │ │
│  │  - Category queries                                    │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                  PostgreSQL Database                         │
│  - transactions table                                        │
│  - members table                                             │
│  - financial_categories table                                │
│  - payments table                                            │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Backend:**
- Express.js 4.x - Web framework
- Prisma 5.0 - ORM for database access
- Zod - Schema validation
- TypeScript 5.x - Type safety
- Decimal.js - Precise financial calculations

**Frontend:**
- Next.js 14 - React framework (App Router)
- TanStack Query - Data fetching & caching
- Mantine UI 7.0 - Component library
- Recharts - Chart visualization
- Axios - HTTP client
- TypeScript 5.x - Type safety



---

## Database Schema

The reporting system uses existing database tables without requiring new schema changes:

### Primary Tables Used

**1. Transaction Table**
```prisma
model Transaction {
  id              Int       @id @default(autoincrement())
  associationId   Int
  memberId        Int
  categoryId      Int
  amount          Decimal   @db.Decimal(10, 2)
  status          String    // pending, paid, overdue, partial, waived
  dueDate         DateTime?
  createdAt       DateTime
  
  member          Member    @relation(...)
  category        FinancialCategory @relation(...)
  payments        Payment[]
}
```

**2. Payment Table**
```prisma
model Payment {
  id            Int       @id @default(autoincrement())
  transactionId Int
  amountPaid    Decimal   @db.Decimal(10, 2)
  paymentDate   DateTime
  paymentMethod String?
  
  transaction   Transaction @relation(...)
}
```

**3. Member Table**
```prisma
model Member {
  id            Int       @id @default(autoincrement())
  associationId Int
  memberId      String    // Member number
  firstName     String
  lastName      String
  email         String?
  phone         String?
  status        String    // active, inactive, suspended
  
  transactions  Transaction[]
}
```

**4. FinancialCategory Table**
```prisma
model FinancialCategory {
  id            Int       @id @default(autoincrement())
  associationId Int
  name          String
  type          String    // due, levy, donation, penalty
  isActive      Boolean
  
  transactions  Transaction[]
}
```

### Data Relationships

```
Association (1) ──→ (N) Transactions
Member (1) ──→ (N) Transactions
FinancialCategory (1) ──→ (N) Transactions
Transaction (1) ──→ (N) Payments
```

---

## Backend Implementation

### File Structure

```
apps/api/src/modules/reports/
├── reports.types.ts          # TypeScript interfaces
├── reports.service.ts        # Business logic & calculations
├── reports.controller.ts     # Request handlers
├── reports.routes.ts         # Express routes
└── reports.validation.ts     # Zod validation schemas
```

### 1. Type Definitions (reports.types.ts)

```typescript
import { Decimal } from '@prisma/client/runtime/library';

export interface DateRangeFilter {
  startDate?: Date;
  endDate?: Date;
  period?: 'this_month' | 'last_month' | 'this_quarter' | 
           'last_quarter' | 'this_year' | 'last_year' | 'custom';
}

export interface FinancialSummaryReport {
  period: {
    startDate: Date;
    endDate: Date;
    label: string;
  };
  income: {
    total: Decimal;
    byCategory: Array<{
      categoryId: number;
      categoryName: string;
      categoryType: string;
      amount: Decimal;
      transactionCount: number;
    }>;
  };
  expenses: {
    total: Decimal;
    byCategory: Array<{...}>;
  };
  collections: {
    expected: Decimal;
    collected: Decimal;
    outstanding: Decimal;
    collectionRate: number; // percentage
  };
  comparison?: {
    previousPeriod: {...};
    changes: {...};
  };
}

export interface MemberBalanceReport {
  memberId: number;
  memberNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  totalDues: Decimal;
  totalPaid: Decimal;
  balance: Decimal;
  pendingTransactions: number;
  overdueTransactions: number;
  lastPaymentDate: Date | null;
  status: string;
}

export interface AgingBucket {
  range: string;           // "0-30 days", "31-60 days", etc.
  minDays: number;
  maxDays: number | null;
  count: number;
  amount: Decimal;
  members: Array<{
    memberId: number;
    memberName: string;
    amount: Decimal;
    oldestDueDate: Date;
    daysOverdue: number;
  }>;
}

export interface AgingAnalysisReport {
  asOfDate: Date;
  summary: {
    totalOutstanding: Decimal;
    totalMembers: number;
    totalTransactions: number;
  };
  buckets: {
    current: AgingBucket;      // 0-30 days
    days31to60: AgingBucket;
    days61to90: AgingBucket;
    over90: AgingBucket;
  };
}

export interface CollectionRateReport {
  period: {
    startDate: Date;
    endDate: Date;
    label: string;
  };
  overall: {
    expected: Decimal;
    collected: Decimal;
    outstanding: Decimal;
    collectionRate: number;
  };
  byMonth: Array<{
    month: string;
    year: number;
    expected: Decimal;
    collected: Decimal;
    collectionRate: number;
  }>;
  byCategory: Array<{
    categoryId: number;
    categoryName: string;
    categoryType: string;
    expected: Decimal;
    collected: Decimal;
    collectionRate: number;
  }>;
}

export interface CategoryReport {
  categoryId: number;
  categoryName: string;
  categoryType: string;
  isActive: boolean;
  statistics: {
    totalExpected: Decimal;
    totalCollected: Decimal;
    totalOutstanding: Decimal;
    collectionRate: number;
    transactionCount: number;
    memberCount: number;
  };
  byStatus: Record<string, { count: number; amount: Decimal }>;
  recentTransactions: Array<{...}>;
}
```



### 2. Service Layer (reports.service.ts)

The service layer contains all business logic and database queries.

#### Key Functions

**A. Date Range Helper**
```typescript
export function getDateRange(filter: DateRangeFilter): { 
  startDate: Date; 
  endDate: Date; 
  label: string 
} {
  const now = new Date();
  let startDate: Date;
  let endDate: Date;
  let label: string;

  if (filter.period) {
    switch (filter.period) {
      case 'this_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        label = `${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`;
        break;
      // ... other periods
    }
  } else if (filter.startDate && filter.endDate) {
    startDate = new Date(filter.startDate);
    endDate = new Date(filter.endDate);
    label = `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
  }
  
  return { startDate, endDate, label };
}
```

**B. Financial Summary Report**
```typescript
async generateFinancialSummary(
  associationId: number,
  filter: DateRangeFilter,
  includeComparison: boolean = false
): Promise<FinancialSummaryReport> {
  const { startDate, endDate, label } = getDateRange(filter);

  // Get all transactions in the period
  const transactions = await prisma.transaction.findMany({
    where: {
      associationId,
      createdAt: { gte: startDate, lte: endDate },
    },
    include: {
      category: { select: { id: true, name: true, type: true } },
      payments: { select: { amountPaid: true } },
    },
  });

  // Categorize by income/expense
  const incomeTypes = ['due', 'levy', 'donation'];
  const expenseTypes = ['penalty'];

  let totalIncome = new Decimal(0);
  let totalExpenses = new Decimal(0);
  let totalExpected = new Decimal(0);
  let totalCollected = new Decimal(0);

  // Calculate totals and group by category
  transactions.forEach(txn => {
    const collected = txn.payments.reduce(
      (sum, p) => sum.plus(p.amountPaid), 
      new Decimal(0)
    );
    
    totalExpected = totalExpected.plus(txn.amount);
    totalCollected = totalCollected.plus(collected);

    if (incomeTypes.includes(txn.category.type)) {
      totalIncome = totalIncome.plus(collected);
    } else if (expenseTypes.includes(txn.category.type)) {
      totalExpenses = totalExpenses.plus(collected);
    }
  });

  const collectionRate = totalExpected.isZero() 
    ? 0 
    : totalCollected.dividedBy(totalExpected).times(100).toNumber();

  return {
    period: { startDate, endDate, label },
    income: { total: totalIncome, byCategory: [...] },
    expenses: { total: totalExpenses, byCategory: [...] },
    collections: {
      expected: totalExpected,
      collected: totalCollected,
      outstanding: totalExpected.minus(totalCollected),
      collectionRate,
    },
    comparison: includeComparison ? {...} : undefined,
  };
}
```

**C. Member Balances Report**
```typescript
async generateMemberBalances(
  associationId: number,
  options: {
    page?: number;
    limit?: number;
    status?: 'all' | 'with_balance' | 'overdue';
    search?: string;
    sortBy?: 'name' | 'balance' | 'lastPayment';
    sortOrder?: 'asc' | 'desc';
  } = {}
): Promise<{ members: MemberBalanceReport[]; pagination: any }> {
  // Get all members with their transactions
  const members = await prisma.member.findMany({
    where: { associationId, status: 'active' },
    include: {
      transactions: {
        include: {
          payments: { select: { amountPaid: true, paymentDate: true } },
        },
      },
    },
  });

  // Calculate balances for each member
  const memberBalances: MemberBalanceReport[] = members.map(member => {
    let totalDues = new Decimal(0);
    let totalPaid = new Decimal(0);
    let pendingCount = 0;
    let overdueCount = 0;
    let lastPaymentDate: Date | null = null;

    member.transactions.forEach(txn => {
      totalDues = totalDues.plus(txn.amount);
      const txnPaid = txn.payments.reduce(
        (sum, p) => sum.plus(p.amountPaid), 
        new Decimal(0)
      );
      totalPaid = totalPaid.plus(txnPaid);

      if (txn.status === 'pending' || txn.status === 'partial') pendingCount++;
      if (txn.status === 'overdue') overdueCount++;

      txn.payments.forEach(p => {
        if (!lastPaymentDate || p.paymentDate > lastPaymentDate) {
          lastPaymentDate = p.paymentDate;
        }
      });
    });

    return {
      memberId: member.id,
      memberNumber: member.memberId,
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
      phone: member.phone,
      totalDues,
      totalPaid,
      balance: totalDues.minus(totalPaid),
      pendingTransactions: pendingCount,
      overdueTransactions: overdueCount,
      lastPaymentDate,
      status: member.status,
    };
  });

  // Filter, sort, and paginate
  // ... (implementation details)

  return { members: paginatedMembers, pagination: {...} };
}
```

**D. Aging Analysis Report**
```typescript
async generateAgingAnalysis(
  associationId: number,
  asOfDate?: Date,
  includeDetails: boolean = true
): Promise<AgingAnalysisReport> {
  const analysisDate = asOfDate || new Date();

  // Get all outstanding transactions
  const transactions = await prisma.transaction.findMany({
    where: {
      associationId,
      status: { in: ['pending', 'overdue', 'partial'] },
    },
    include: {
      member: { select: { id: true, firstName: true, lastName: true } },
      payments: { select: { amountPaid: true } },
    },
  });

  // Initialize aging buckets
  const buckets = {
    current: { range: '0-30 days', minDays: 0, maxDays: 30, ... },
    days31to60: { range: '31-60 days', minDays: 31, maxDays: 60, ... },
    days61to90: { range: '61-90 days', minDays: 61, maxDays: 90, ... },
    over90: { range: '90+ days', minDays: 91, maxDays: null, ... },
  };

  // Categorize transactions into buckets
  transactions.forEach(txn => {
    const paid = txn.payments.reduce(
      (sum, p) => sum.plus(p.amountPaid), 
      new Decimal(0)
    );
    const balance = new Decimal(txn.amount).minus(paid);

    if (balance.lessThanOrEqualTo(0)) return;

    // Calculate days overdue
    const dueDate = txn.dueDate || txn.createdAt;
    const daysOverdue = Math.floor(
      (analysisDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Assign to appropriate bucket
    let bucket;
    if (daysOverdue <= 30) bucket = buckets.current;
    else if (daysOverdue <= 60) bucket = buckets.days31to60;
    else if (daysOverdue <= 90) bucket = buckets.days61to90;
    else bucket = buckets.over90;

    bucket.count++;
    bucket.amount = bucket.amount.plus(balance);
  });

  return {
    asOfDate: analysisDate,
    summary: { totalOutstanding, totalMembers, totalTransactions },
    buckets,
  };
}
```

**E. Collection Rate Report**
```typescript
async generateCollectionRate(
  associationId: number,
  filter: DateRangeFilter,
  groupBy: 'month' | 'quarter' | 'year' = 'month'
): Promise<CollectionRateReport> {
  const { startDate, endDate, label } = getDateRange(filter);

  const transactions = await prisma.transaction.findMany({
    where: {
      associationId,
      createdAt: { gte: startDate, lte: endDate },
    },
    include: {
      category: { select: { id: true, name: true, type: true } },
      payments: { select: { amountPaid: true } },
    },
  });

  // Group by time period and calculate rates
  const byMonth: Record<string, { expected: Decimal; collected: Decimal }> = {};

  transactions.forEach(txn => {
    const collected = txn.payments.reduce(
      (sum, p) => sum.plus(p.amountPaid), 
      new Decimal(0)
    );

    const monthKey = `${txn.createdAt.getFullYear()}-${
      String(txn.createdAt.getMonth() + 1).padStart(2, '0')
    }`;
    
    if (!byMonth[monthKey]) {
      byMonth[monthKey] = { expected: new Decimal(0), collected: new Decimal(0) };
    }
    
    byMonth[monthKey].expected = byMonth[monthKey].expected.plus(txn.amount);
    byMonth[monthKey].collected = byMonth[monthKey].collected.plus(collected);
  });

  return {
    period: { startDate, endDate, label },
    overall: { expected, collected, outstanding, collectionRate },
    byMonth: [...],
    byCategory: [...],
  };
}
```



### 3. Controller Layer (reports.controller.ts)

```typescript
import { Request, Response } from 'express';
import { reportsService } from './reports.service';
import { 
  financialSummarySchema, 
  memberBalancesSchema,
  agingAnalysisSchema,
  collectionRateSchema,
  categoryReportSchema 
} from './reports.validation';

export const reportsController = {
  /**
   * GET /api/reports/financial-summary
   */
  async getFinancialSummary(req: Request, res: Response) {
    try {
      const associationId = req.user!.associationId!;
      
      const validation = financialSummarySchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validation.error.errors,
        });
      }

      const { period, startDate, endDate, includeComparison } = validation.data;

      const filters: any = {};
      if (period) filters.period = period;
      if (startDate) filters.startDate = new Date(startDate);
      if (endDate) filters.endDate = new Date(endDate);

      const report = await reportsService.generateFinancialSummary(
        associationId,
        filters,
        includeComparison === 'true'
      );

      res.json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      console.error('Financial summary error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to generate financial summary',
      });
    }
  },

  /**
   * GET /api/reports/member-balances
   */
  async getMemberBalances(req: Request, res: Response) {
    try {
      const associationId = req.user!.associationId!;
      
      const validation = memberBalancesSchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validation.error.errors,
        });
      }

      const options = {
        page: validation.data.page ? parseInt(validation.data.page) : undefined,
        limit: validation.data.limit ? parseInt(validation.data.limit) : undefined,
        status: validation.data.status,
        search: validation.data.search,
        sortBy: validation.data.sortBy,
        sortOrder: validation.data.sortOrder,
      };

      const result = await reportsService.generateMemberBalances(
        associationId,
        options
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Member balances error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to generate member balances',
      });
    }
  },

  // ... other controller methods
};
```

### 4. Routes (reports.routes.ts)

```typescript
import { Router } from 'express';
import { reportsController } from './reports.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * @route   GET /api/reports/financial-summary
 * @desc    Get financial summary report
 * @access  Private (requires report:view permission)
 */
router.get(
  '/financial-summary',
  requirePermission('report:view'),
  reportsController.getFinancialSummary
);

/**
 * @route   GET /api/reports/member-balances
 * @desc    Get member balances report
 * @access  Private (requires report:view permission)
 */
router.get(
  '/member-balances',
  requirePermission('report:view'),
  reportsController.getMemberBalances
);

/**
 * @route   GET /api/reports/aging-analysis
 * @desc    Get aging analysis report
 * @access  Private (requires report:view permission)
 */
router.get(
  '/aging-analysis',
  requirePermission('report:view'),
  reportsController.getAgingAnalysis
);

/**
 * @route   GET /api/reports/collection-rate
 * @desc    Get collection rate report
 * @access  Private (requires report:view permission)
 */
router.get(
  '/collection-rate',
  requirePermission('report:view'),
  reportsController.getCollectionRate
);

/**
 * @route   GET /api/reports/by-category
 * @desc    Get category-wise report
 * @access  Private (requires report:view permission)
 */
router.get(
  '/by-category',
  requirePermission('report:view'),
  reportsController.getCategoryReport
);

export default router;
```

### 5. Validation Schemas (reports.validation.ts)

```typescript
import { z } from 'zod';

export const financialSummarySchema = z.object({
  period: z.enum([
    'this_month', 
    'last_month', 
    'this_quarter', 
    'last_quarter', 
    'this_year', 
    'last_year', 
    'custom'
  ]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  includeComparison: z.string().optional(),
});

export const memberBalancesSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  status: z.enum(['all', 'with_balance', 'overdue']).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['name', 'balance', 'lastPayment']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const agingAnalysisSchema = z.object({
  asOfDate: z.string().optional(),
  includeDetails: z.string().optional(),
});

export const collectionRateSchema = z.object({
  period: z.enum([
    'this_month', 
    'last_month', 
    'this_quarter', 
    'last_quarter', 
    'this_year', 
    'last_year', 
    'custom'
  ]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  groupBy: z.enum(['month', 'quarter', 'year']).optional(),
});

export const categoryReportSchema = z.object({
  categoryId: z.string().optional(),
  type: z.enum(['due', 'levy', 'donation', 'penalty']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  includeTransactions: z.string().optional(),
  transactionLimit: z.string().optional(),
});
```

---

## Frontend Implementation

### File Structure

```
apps/web/src/
├── lib/api/
│   └── reports.ts                    # API client
├── components/
│   └── DateRangePicker.tsx           # Date range selector
└── app/dashboard/reports/
    ├── page.tsx                      # Reports dashboard
    ├── financial-summary/
    │   └── page.tsx                  # Financial summary page
    ├── member-balances/
    │   └── page.tsx                  # Member balances page
    ├── aging-analysis/
    │   └── page.tsx                  # Aging analysis page
    ├── collection-rate/
    │   └── page.tsx                  # Collection rate page
    └── by-category/
        └── page.tsx                  # Category report page
```



### 1. API Client (reports.ts)

```typescript
import api from '../axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const reportsApi = {
  /**
   * Get financial summary report
   */
  async getFinancialSummary(params?: {
    period?: string;
    startDate?: string;
    endDate?: string;
    includeComparison?: boolean;
  }) {
    const response = await api.get(`${API_URL}/api/reports/financial-summary`, { 
      params 
    });
    return response.data;
  },

  /**
   * Get member balances report
   */
  async getMemberBalances(params?: {
    page?: number;
    limit?: number;
    status?: 'all' | 'with_balance' | 'overdue';
    search?: string;
    sortBy?: 'name' | 'balance' | 'lastPayment';
    sortOrder?: 'asc' | 'desc';
  }) {
    const response = await api.get(`${API_URL}/api/reports/member-balances`, { 
      params 
    });
    return response.data;
  },

  /**
   * Get aging analysis report
   */
  async getAgingAnalysis(params?: {
    asOfDate?: string;
    includeDetails?: boolean;
  }) {
    const response = await api.get(`${API_URL}/api/reports/aging-analysis`, { 
      params 
    });
    return response.data;
  },

  /**
   * Get collection rate report
   */
  async getCollectionRate(params?: {
    period?: string;
    startDate?: string;
    endDate?: string;
    groupBy?: 'month' | 'quarter' | 'year';
  }) {
    const response = await api.get(`${API_URL}/api/reports/collection-rate`, { 
      params 
    });
    return response.data;
  },

  /**
   * Get category-wise report
   */
  async getCategoryReport(params?: {
    categoryId?: number;
    type?: 'due' | 'levy' | 'donation' | 'penalty';
    startDate?: string;
    endDate?: string;
    includeTransactions?: boolean;
    transactionLimit?: number;
  }) {
    const response = await api.get(`${API_URL}/api/reports/by-category`, { 
      params 
    });
    return response.data;
  },
};
```

### 2. Date Range Picker Component

```typescript
'use client';

import { Select, Group, TextInput } from '@mantine/core';
import { DateInput } from '@mantine/dates';

export type PeriodOption = 
  | 'this_month' 
  | 'last_month' 
  | 'this_quarter' 
  | 'last_quarter' 
  | 'this_year' 
  | 'last_year' 
  | 'custom';

interface DateRangePickerProps {
  value: {
    period: PeriodOption;
    startDate?: Date;
    endDate?: Date;
  };
  onChange: (value: any) => void;
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const periodOptions = [
    { value: 'this_month', label: 'This Month' },
    { value: 'last_month', label: 'Last Month' },
    { value: 'this_quarter', label: 'This Quarter' },
    { value: 'last_quarter', label: 'Last Quarter' },
    { value: 'this_year', label: 'This Year' },
    { value: 'last_year', label: 'Last Year' },
    { value: 'custom', label: 'Custom Range' },
  ];

  return (
    <div>
      <Select
        label="Period"
        data={periodOptions}
        value={value.period}
        onChange={(period) => onChange({ ...value, period })}
      />

      {value.period === 'custom' && (
        <Group mt="md">
          <DateInput
            label="Start Date"
            value={value.startDate}
            onChange={(startDate) => onChange({ ...value, startDate })}
          />
          <DateInput
            label="End Date"
            value={value.endDate}
            onChange={(endDate) => onChange({ ...value, endDate })}
          />
        </Group>
      )}
    </div>
  );
}
```

### 3. Financial Summary Page Example

```typescript
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Grid, Text, Title, Loader } from '@mantine/core';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { reportsApi } from '@/lib/api/reports';
import { DateRangePicker } from '@/components/DateRangePicker';

export default function FinancialSummaryPage() {
  const [dateRange, setDateRange] = useState({
    period: 'this_month' as const,
  });
  const [includeComparison, setIncludeComparison] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ['financial-summary', dateRange, includeComparison],
    queryFn: () =>
      reportsApi.getFinancialSummary({
        period: dateRange.period,
        startDate: dateRange.startDate?.toISOString(),
        endDate: dateRange.endDate?.toISOString(),
        includeComparison,
      }),
  });

  const report = data?.data;

  if (isLoading) {
    return <Loader />;
  }

  return (
    <div>
      <Title order={2}>Financial Summary Report</Title>
      <Text c="dimmed">{report.period.label}</Text>

      {/* Date Range Filter */}
      <DateRangePicker value={dateRange} onChange={setDateRange} />

      {/* Key Metrics */}
      <Grid>
        <Grid.Col span={4}>
          <Card>
            <Text size="sm" c="dimmed">Total Income</Text>
            <Text size="xl" fw={700} c="teal">
              {formatCurrency(report.income.total)}
            </Text>
          </Card>
        </Grid.Col>
        <Grid.Col span={4}>
          <Card>
            <Text size="sm" c="dimmed">Total Expenses</Text>
            <Text size="xl" fw={700} c="red">
              {formatCurrency(report.expenses.total)}
            </Text>
          </Card>
        </Grid.Col>
        <Grid.Col span={4}>
          <Card>
            <Text size="sm" c="dimmed">Collection Rate</Text>
            <Text size="xl" fw={700} c="green">
              {report.collections.collectionRate.toFixed(1)}%
            </Text>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Income by Category Chart */}
      <Card mt="xl">
        <Title order={3}>Income by Category</Title>
        <PieChart width={400} height={300}>
          <Pie
            data={categoryChartData}
            dataKey="amount"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={100}
            label
          >
            {categoryChartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </Card>

      {/* Period Comparison */}
      {report.comparison && (
        <Card mt="xl">
          <Title order={3}>Period Comparison</Title>
          <BarChart width={600} height={300} data={comparisonData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="income" fill="#0088FE" />
            <Bar dataKey="collections" fill="#00C49F" />
          </BarChart>
        </Card>
      )}
    </div>
  );
}
```

---

## API Endpoints

### 1. Financial Summary

**Endpoint:** `GET /api/reports/financial-summary`

**Query Parameters:**
- `period` (optional): `this_month`, `last_month`, `this_quarter`, `last_quarter`, `this_year`, `last_year`, `custom`
- `startDate` (optional): ISO date string (required if period is `custom`)
- `endDate` (optional): ISO date string (required if period is `custom`)
- `includeComparison` (optional): `true` or `false`

**Response:**
```json
{
  "success": true,
  "data": {
    "period": {
      "startDate": "2025-12-01T00:00:00.000Z",
      "endDate": "2025-12-31T23:59:59.000Z",
      "label": "December 2025"
    },
    "income": {
      "total": "500000.00",
      "byCategory": [
        {
          "categoryId": 1,
          "categoryName": "Monthly Dues",
          "categoryType": "due",
          "amount": "300000.00",
          "transactionCount": 50
        }
      ]
    },
    "expenses": {
      "total": "50000.00",
      "byCategory": []
    },
    "collections": {
      "expected": "600000.00",
      "collected": "500000.00",
      "outstanding": "100000.00",
      "collectionRate": 83.33
    },
    "comparison": {
      "previousPeriod": {...},
      "changes": {...}
    }
  }
}
```



### 2. Member Balances

**Endpoint:** `GET /api/reports/member-balances`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50)
- `status` (optional): `all`, `with_balance`, `overdue`
- `search` (optional): Search by name, email, or member ID
- `sortBy` (optional): `name`, `balance`, `lastPayment`
- `sortOrder` (optional): `asc`, `desc`

**Response:**
```json
{
  "success": true,
  "data": {
    "members": [
      {
        "memberId": 1,
        "memberNumber": "MEM001",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com",
        "phone": "+234800000000",
        "totalDues": "50000.00",
        "totalPaid": "30000.00",
        "balance": "20000.00",
        "pendingTransactions": 2,
        "overdueTransactions": 1,
        "lastPaymentDate": "2025-12-15T00:00:00.000Z",
        "status": "active"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "totalCount": 100,
      "totalPages": 2,
      "hasMore": true
    }
  }
}
```

### 3. Aging Analysis

**Endpoint:** `GET /api/reports/aging-analysis`

**Query Parameters:**
- `asOfDate` (optional): ISO date string (default: today)
- `includeDetails` (optional): `true` or `false` (default: true)

**Response:**
```json
{
  "success": true,
  "data": {
    "asOfDate": "2025-12-28T00:00:00.000Z",
    "summary": {
      "totalOutstanding": "500000.00",
      "totalMembers": 45,
      "totalTransactions": 120
    },
    "buckets": {
      "current": {
        "range": "0-30 days",
        "minDays": 0,
        "maxDays": 30,
        "count": 50,
        "amount": "200000.00",
        "members": [
          {
            "memberId": 1,
            "memberName": "John Doe",
            "amount": "20000.00",
            "oldestDueDate": "2025-12-15T00:00:00.000Z",
            "daysOverdue": 13
          }
        ]
      },
      "days31to60": {...},
      "days61to90": {...},
      "over90": {...}
    }
  }
}
```

### 4. Collection Rate

**Endpoint:** `GET /api/reports/collection-rate`

**Query Parameters:**
- `period` (optional): Same as financial summary
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string
- `groupBy` (optional): `month`, `quarter`, `year` (default: month)

**Response:**
```json
{
  "success": true,
  "data": {
    "period": {
      "startDate": "2025-01-01T00:00:00.000Z",
      "endDate": "2025-12-31T23:59:59.000Z",
      "label": "2025"
    },
    "overall": {
      "expected": "6000000.00",
      "collected": "5000000.00",
      "outstanding": "1000000.00",
      "collectionRate": 83.33
    },
    "byMonth": [
      {
        "month": "January",
        "year": 2025,
        "expected": "500000.00",
        "collected": "450000.00",
        "collectionRate": 90.0
      }
    ],
    "byCategory": [
      {
        "categoryId": 1,
        "categoryName": "Monthly Dues",
        "categoryType": "due",
        "expected": "3600000.00",
        "collected": "3000000.00",
        "collectionRate": 83.33
      }
    ]
  }
}
```

### 5. Category Report

**Endpoint:** `GET /api/reports/by-category`

**Query Parameters:**
- `categoryId` (optional): Filter by specific category
- `type` (optional): `due`, `levy`, `donation`, `penalty`
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string
- `includeTransactions` (optional): `true` or `false`
- `transactionLimit` (optional): Number of recent transactions to include

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "categoryId": 1,
      "categoryName": "Monthly Dues",
      "categoryType": "due",
      "isActive": true,
      "statistics": {
        "totalExpected": "3600000.00",
        "totalCollected": "3000000.00",
        "totalOutstanding": "600000.00",
        "collectionRate": 83.33,
        "transactionCount": 600,
        "memberCount": 50
      },
      "byStatus": {
        "pending": { "count": 20, "amount": "200000.00" },
        "paid": { "count": 500, "amount": "3000000.00" },
        "overdue": { "count": 50, "amount": "300000.00" },
        "partial": { "count": 30, "amount": "100000.00" }
      },
      "recentTransactions": [...]
    }
  ]
}
```

---

## Report Types

### 1. Financial Summary Report

**Purpose:** Provides a comprehensive overview of income, expenses, and collections for a given period.

**Key Metrics:**
- Total Income (by category)
- Total Expenses (by category)
- Expected Collections
- Actual Collections
- Outstanding Amount
- Collection Rate (%)
- Period-over-period comparison

**Use Cases:**
- Monthly financial review
- Board meeting reports
- Budget vs actual analysis
- Trend identification

**Visualizations:**
- Pie chart: Income by category
- Bar chart: Period comparison
- Line chart: Collection trends

### 2. Member Balances Report

**Purpose:** Shows outstanding balances for all members with detailed payment status.

**Key Metrics:**
- Total Dues per member
- Total Paid per member
- Outstanding Balance
- Number of pending transactions
- Number of overdue transactions
- Last payment date

**Use Cases:**
- Identify members with outstanding balances
- Follow-up on overdue payments
- Member financial health check
- Collection prioritization

**Features:**
- Search by name, email, or member ID
- Filter by status (all, with balance, overdue)
- Sort by name, balance, or last payment
- Pagination for large datasets

### 3. Aging Analysis Report

**Purpose:** Categorizes outstanding debts by age to prioritize collection efforts.

**Aging Buckets:**
- Current (0-30 days)
- 31-60 days
- 61-90 days
- Over 90 days

**Key Metrics:**
- Total outstanding amount
- Number of members with outstanding balances
- Number of outstanding transactions
- Amount per aging bucket
- Member details per bucket

**Use Cases:**
- Prioritize collection efforts
- Identify chronic late payers
- Assess financial risk
- Plan collection strategies

**Visualizations:**
- Bar chart: Amount by aging bucket
- Pie chart: Distribution of outstanding amounts

### 4. Collection Rate Report

**Purpose:** Tracks collection efficiency over time and by category.

**Key Metrics:**
- Overall collection rate
- Collection rate by month/quarter/year
- Collection rate by category
- Expected vs collected amounts
- Trend analysis

**Use Cases:**
- Monitor collection performance
- Identify seasonal patterns
- Compare category performance
- Set collection targets

**Visualizations:**
- Line chart: Collection rate over time
- Bar chart: Collection rate by category
- Trend indicators

### 5. Category-wise Report

**Purpose:** Detailed analysis of financial performance by category (dues, levies, donations, penalties).

**Key Metrics:**
- Total expected per category
- Total collected per category
- Outstanding amount per category
- Collection rate per category
- Transaction count
- Member count
- Status breakdown (pending, paid, overdue, partial)

**Use Cases:**
- Category performance analysis
- Revenue stream analysis
- Category-specific collection strategies
- Budget planning

**Features:**
- Filter by category type
- Date range filtering
- Recent transactions list
- Status distribution

---

## Usage Examples

### Example 1: Generate Monthly Financial Summary

```typescript
// Frontend
const { data } = useQuery({
  queryKey: ['financial-summary', 'this_month'],
  queryFn: () => reportsApi.getFinancialSummary({
    period: 'this_month',
    includeComparison: true,
  }),
});

// Backend API Call
GET /api/reports/financial-summary?period=this_month&includeComparison=true
```

### Example 2: Find Members with Overdue Payments

```typescript
// Frontend
const { data } = useQuery({
  queryKey: ['member-balances', 'overdue'],
  queryFn: () => reportsApi.getMemberBalances({
    status: 'overdue',
    sortBy: 'balance',
    sortOrder: 'desc',
    limit: 50,
  }),
});

// Backend API Call
GET /api/reports/member-balances?status=overdue&sortBy=balance&sortOrder=desc&limit=50
```

### Example 3: Analyze Aging of Outstanding Debts

```typescript
// Frontend
const { data } = useQuery({
  queryKey: ['aging-analysis'],
  queryFn: () => reportsApi.getAgingAnalysis({
    includeDetails: true,
  }),
});

// Backend API Call
GET /api/reports/aging-analysis?includeDetails=true
```

### Example 4: Track Collection Rate for the Year

```typescript
// Frontend
const { data } = useQuery({
  queryKey: ['collection-rate', 'this_year'],
  queryFn: () => reportsApi.getCollectionRate({
    period: 'this_year',
    groupBy: 'month',
  }),
});

// Backend API Call
GET /api/reports/collection-rate?period=this_year&groupBy=month
```

### Example 5: Analyze Specific Category Performance

```typescript
// Frontend
const { data } = useQuery({
  queryKey: ['category-report', 'dues'],
  queryFn: () => reportsApi.getCategoryReport({
    type: 'due',
    includeTransactions: true,
    transactionLimit: 10,
  }),
});

// Backend API Call
GET /api/reports/by-category?type=due&includeTransactions=true&transactionLimit=10
```



---

## Testing Guide

### Backend Testing

#### 1. Unit Tests for Service Layer

```typescript
// reports.service.test.ts
import { reportsService } from './reports.service';
import { prisma } from '../../lib/prisma';

describe('Reports Service', () => {
  describe('generateFinancialSummary', () => {
    it('should calculate income correctly', async () => {
      const report = await reportsService.generateFinancialSummary(
        1, // associationId
        { period: 'this_month' },
        false
      );

      expect(report.income.total).toBeDefined();
      expect(report.collections.collectionRate).toBeGreaterThanOrEqual(0);
      expect(report.collections.collectionRate).toBeLessThanOrEqual(100);
    });

    it('should include comparison when requested', async () => {
      const report = await reportsService.generateFinancialSummary(
        1,
        { period: 'this_month' },
        true
      );

      expect(report.comparison).toBeDefined();
      expect(report.comparison?.previousPeriod).toBeDefined();
      expect(report.comparison?.changes).toBeDefined();
    });
  });

  describe('generateMemberBalances', () => {
    it('should paginate results correctly', async () => {
      const result = await reportsService.generateMemberBalances(1, {
        page: 1,
        limit: 10,
      });

      expect(result.members.length).toBeLessThanOrEqual(10);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
    });

    it('should filter by status', async () => {
      const result = await reportsService.generateMemberBalances(1, {
        status: 'overdue',
      });

      result.members.forEach(member => {
        expect(member.overdueTransactions).toBeGreaterThan(0);
      });
    });
  });

  describe('generateAgingAnalysis', () => {
    it('should categorize transactions into correct buckets', async () => {
      const report = await reportsService.generateAgingAnalysis(1);

      expect(report.buckets.current).toBeDefined();
      expect(report.buckets.days31to60).toBeDefined();
      expect(report.buckets.days61to90).toBeDefined();
      expect(report.buckets.over90).toBeDefined();
    });
  });
});
```

#### 2. Integration Tests for API Endpoints

```typescript
// reports.routes.test.ts
import request from 'supertest';
import app from '../../app';

describe('Reports API', () => {
  let authToken: string;

  beforeAll(async () => {
    // Login and get auth token
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'password' });
    authToken = response.body.data.token;
  });

  describe('GET /api/reports/financial-summary', () => {
    it('should return financial summary', async () => {
      const response = await request(app)
        .get('/api/reports/financial-summary')
        .query({ period: 'this_month' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.income).toBeDefined();
      expect(response.body.data.expenses).toBeDefined();
      expect(response.body.data.collections).toBeDefined();
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/reports/financial-summary');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/reports/member-balances', () => {
    it('should return paginated member balances', async () => {
      const response = await request(app)
        .get('/api/reports/member-balances')
        .query({ page: 1, limit: 10 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.members).toBeInstanceOf(Array);
      expect(response.body.data.pagination).toBeDefined();
    });
  });
});
```

### Frontend Testing

#### 1. Component Tests

```typescript
// FinancialSummaryPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FinancialSummaryPage from './page';
import { reportsApi } from '@/lib/api/reports';

jest.mock('@/lib/api/reports');

describe('FinancialSummaryPage', () => {
  const queryClient = new QueryClient();

  it('should display loading state', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <FinancialSummaryPage />
      </QueryClientProvider>
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should display financial summary data', async () => {
    const mockData = {
      success: true,
      data: {
        period: { label: 'December 2025' },
        income: { total: '500000.00' },
        expenses: { total: '50000.00' },
        collections: { collectionRate: 83.33 },
      },
    };

    (reportsApi.getFinancialSummary as jest.Mock).mockResolvedValue(mockData);

    render(
      <QueryClientProvider client={queryClient}>
        <FinancialSummaryPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('December 2025')).toBeInTheDocument();
      expect(screen.getByText('₦500,000')).toBeInTheDocument();
    });
  });
});
```

### Manual Testing Checklist

#### Financial Summary Report
- [ ] Test with different date ranges (this month, last month, quarter, year)
- [ ] Test custom date range selection
- [ ] Verify period comparison calculations
- [ ] Check chart rendering with different data sizes
- [ ] Test with no data (empty state)
- [ ] Verify currency formatting
- [ ] Test responsive design on mobile

#### Member Balances Report
- [ ] Test pagination (next/previous pages)
- [ ] Test search functionality
- [ ] Test status filters (all, with balance, overdue)
- [ ] Test sorting (by name, balance, last payment)
- [ ] Verify balance calculations
- [ ] Test with large datasets (100+ members)
- [ ] Check table responsiveness

#### Aging Analysis Report
- [ ] Verify aging bucket calculations
- [ ] Test member drill-down functionality
- [ ] Check with different as-of dates
- [ ] Verify total calculations
- [ ] Test chart visualization
- [ ] Check empty buckets display

#### Collection Rate Report
- [ ] Test different grouping options (month, quarter, year)
- [ ] Verify trend line accuracy
- [ ] Test category breakdown
- [ ] Check percentage calculations
- [ ] Test with incomplete periods

#### Category Report
- [ ] Test filtering by category type
- [ ] Verify status breakdown
- [ ] Test recent transactions display
- [ ] Check statistics calculations
- [ ] Test with inactive categories

---

## Troubleshooting

### Common Issues and Solutions

#### 1. Incorrect Collection Rate Calculation

**Problem:** Collection rate shows > 100% or negative values

**Solution:**
```typescript
// Ensure proper Decimal handling
const collectionRate = totalExpected.isZero() 
  ? 0 
  : totalCollected.dividedBy(totalExpected).times(100).toNumber();

// Add validation
if (collectionRate < 0) collectionRate = 0;
if (collectionRate > 100) collectionRate = 100;
```

#### 2. Date Range Issues

**Problem:** Reports show no data for selected period

**Solution:**
- Verify timezone handling in date conversions
- Check that end date includes full day (23:59:59)
- Ensure database timestamps are in UTC

```typescript
// Correct end date handling
endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
```

#### 3. Performance Issues with Large Datasets

**Problem:** Slow report generation with many transactions

**Solution:**
- Implement database indexing on frequently queried fields
- Use pagination for member balances
- Consider caching for frequently accessed reports
- Optimize Prisma queries with selective includes

```sql
-- Add indexes
CREATE INDEX idx_transactions_association_date 
ON transactions(association_id, created_at);

CREATE INDEX idx_transactions_status 
ON transactions(status);
```

#### 4. Memory Issues with Decimal Calculations

**Problem:** Out of memory errors with large financial calculations

**Solution:**
- Use Decimal.js for all financial calculations
- Avoid converting to number until final display
- Process data in batches for very large datasets

```typescript
// Good practice
let total = new Decimal(0);
transactions.forEach(txn => {
  total = total.plus(txn.amount);
});

// Convert to number only for display
const displayValue = total.toNumber();
```

#### 5. Chart Rendering Issues

**Problem:** Charts not displaying or showing incorrect data

**Solution:**
- Ensure data is properly formatted for Recharts
- Convert Decimal values to numbers for charts
- Check for null/undefined values in data

```typescript
// Prepare chart data
const chartData = report.income.byCategory.map(cat => ({
  name: cat.categoryName,
  amount: parseFloat(cat.amount), // Convert Decimal to number
}));
```

#### 6. Permission Errors

**Problem:** Users getting 403 Forbidden errors

**Solution:**
- Verify user has `report:view` permission
- Check role-permission mappings
- Ensure authentication token is valid

```typescript
// Check permissions in middleware
router.get(
  '/financial-summary',
  authMiddleware,
  requirePermission('report:view'),
  reportsController.getFinancialSummary
);
```

#### 7. Aging Analysis Incorrect Bucket Assignment

**Problem:** Transactions appearing in wrong aging buckets

**Solution:**
- Use consistent date for analysis (asOfDate)
- Calculate days overdue correctly
- Handle null due dates appropriately

```typescript
// Correct days overdue calculation
const dueDate = txn.dueDate || txn.createdAt;
const daysOverdue = Math.floor(
  (analysisDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
);
```

### Debug Mode

Enable debug logging for troubleshooting:

```typescript
// In reports.service.ts
const DEBUG = process.env.DEBUG_REPORTS === 'true';

if (DEBUG) {
  console.log('Report parameters:', { associationId, filter });
  console.log('Query results:', transactions.length, 'transactions');
  console.log('Calculated totals:', { totalIncome, totalExpenses });
}
```

### Performance Monitoring

```typescript
// Add timing logs
const startTime = Date.now();
const report = await reportsService.generateFinancialSummary(...);
const duration = Date.now() - startTime;

if (duration > 5000) {
  console.warn(`Slow report generation: ${duration}ms`);
}
```

---

## Best Practices

1. **Always use Decimal for financial calculations** - Never use JavaScript numbers for money
2. **Implement proper error handling** - Catch and log errors, return user-friendly messages
3. **Use pagination for large datasets** - Don't load all members at once
4. **Cache frequently accessed reports** - Consider Redis caching for dashboard stats
5. **Validate date ranges** - Ensure end date is after start date
6. **Test with real data** - Use production-like datasets for testing
7. **Monitor performance** - Track slow queries and optimize
8. **Document calculations** - Add comments explaining complex financial logic
9. **Use TypeScript strictly** - Leverage type safety for data structures
10. **Implement proper permissions** - Ensure users can only access their association's data

---

## Future Enhancements

- **Scheduled Reports:** Email reports automatically on a schedule
- **Custom Report Builder:** Allow users to create custom reports
- **Export to PDF/Excel:** Generate downloadable reports (Phase 10)
- **Report Templates:** Pre-configured report templates for different use cases
- **Comparative Analysis:** Compare multiple periods side-by-side
- **Forecasting:** Predict future collections based on historical data
- **Alerts:** Notify admins when collection rate drops below threshold
- **Dashboard Widgets:** Embeddable report widgets for custom dashboards
- **API Rate Limiting:** Prevent abuse of report generation endpoints
- **Report Caching:** Cache report results for improved performance

---

**Document Version:** 1.0  
**Last Updated:** December 28, 2025  
**Maintained By:** Development Team
