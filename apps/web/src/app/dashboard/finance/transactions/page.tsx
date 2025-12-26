'use client';

import { EmptyState } from '@/components/EmptyState';
import { IconCreditCard } from '@tabler/icons-react';

export default function TransactionsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Transaction History
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          View all financial transactions and payments
        </p>
      </div>

      <EmptyState
        icon={<IconCreditCard size={40} className="text-blue-500 dark:text-blue-400" />}
        title="Transaction Management Coming Soon"
        description="View complete transaction history, filter by date and type, reconcile payments, and export statements. Full transaction management will be available in Phase 3."
        comingSoon
      />
    </div>
  );
}
