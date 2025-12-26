'use client';

import { EmptyState } from '@/components/EmptyState';
import { IconWallet } from '@tabler/icons-react';

export default function LoansPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Cooperative Loans
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage member loans and repayments
        </p>
      </div>

      <EmptyState
        icon={<IconWallet size={40} className="text-blue-500 dark:text-blue-400" />}
        title="Loans Management Coming Soon"
        description="Issue loans to members, calculate interest, track repayments, manage guarantors, and generate loan statements. Supports multiple loan types, grace periods, and penalty calculations. Available with Enterprise tier only. Part of Phase 9.5: Cooperatives & Loans."
        comingSoon
      />
    </div>
  );
}
