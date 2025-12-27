'use client';

import { EmptyState } from '@/components/EmptyState';
import { IconCurrencyNaira } from '@tabler/icons-react';

export default function SavingsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Member Savings
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Track member savings and deposits
        </p>
      </div>

      <EmptyState
        icon={<IconCurrencyNaira size={40} className="text-green-500 dark:text-green-400" />}
        title="Savings Management Coming Soon"
        description="Manage member savings accounts, record deposits and withdrawals, calculate interest, and generate savings statements. Supports multiple savings products, target savings, and automated interest calculations. Available with Enterprise tier only. Part of Phase 9.5: Cooperatives & Loans."
        comingSoon
      />
    </div>
  );
}
