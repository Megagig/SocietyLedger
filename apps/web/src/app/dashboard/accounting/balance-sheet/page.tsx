'use client';

import { EmptyState } from '@/components/EmptyState';
import { IconWallet } from '@tabler/icons-react';

export default function BalanceSheetPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Balance Sheet
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          View your association's financial position
        </p>
      </div>

      <EmptyState
        icon={<IconWallet size={40} className="text-purple-500 dark:text-purple-400" />}
        title="Balance Sheet Coming Soon"
        description="See your association's assets, liabilities, and equity at any point in time. Track financial position trends, compare periods, and ensure balanced books. Available with Professional tier and above. Part of Phase 9: Accounting System."
        comingSoon
      />
    </div>
  );
}
