'use client';

import { EmptyState } from '@/components/EmptyState';
import { IconReceipt } from '@tabler/icons-react';

export default function ChartOfAccountsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Chart of Accounts
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your association's account structure
        </p>
      </div>

      <EmptyState
        icon={<IconReceipt size={40} className="text-teal-500 dark:text-teal-400" />}
        title="Chart of Accounts Coming Soon"
        description="Set up and manage your complete chart of accounts with assets, liabilities, equity, income, and expense categories. Create custom account hierarchies tailored to your association's needs. Part of Phase 9: Accounting System."
        comingSoon
      />
    </div>
  );
}
