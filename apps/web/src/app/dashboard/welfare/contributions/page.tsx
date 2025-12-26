'use client';

import { EmptyState } from '@/components/EmptyState';
import { IconCurrencyNaira } from '@tabler/icons-react';

export default function ContributionsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Welfare Contributions
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Track member contributions to welfare funds
        </p>
      </div>

      <EmptyState
        icon={<IconCurrencyNaira size={40} className="text-green-500 dark:text-green-400" />}
        title="Welfare Contributions Coming Soon"
        description="Record welfare contributions, track payment status, send reminders, and generate contribution reports. Members can view their contribution history and fund balances. Available with Professional tier. Part of Phase 5.5: Welfare & Social Funds."
        comingSoon
      />
    </div>
  );
}
