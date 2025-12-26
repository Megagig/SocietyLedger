'use client';

import { EmptyState } from '@/components/EmptyState';
import { IconWallet } from '@tabler/icons-react';

export default function SocialFundsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Social & Welfare Funds
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage welfare funds for member support
        </p>
      </div>

      <EmptyState
        icon={<IconWallet size={40} className="text-emerald-500 dark:text-emerald-400" />}
        title="Social Funds Management Coming Soon"
        description="Create and manage welfare funds for bereavement, medical emergencies, celebrations, and other social support. Track fund balances, contributions, and disbursements with full transparency. Available with Professional tier. Part of Phase 5.5: Welfare & Social Funds."
        comingSoon
      />
    </div>
  );
}
