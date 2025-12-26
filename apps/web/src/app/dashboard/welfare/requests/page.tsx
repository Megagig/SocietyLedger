'use client';

import { EmptyState } from '@/components/EmptyState';
import { IconHeart } from '@tabler/icons-react';

export default function WelfareRequestsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Welfare Requests & Payouts
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Process member welfare requests and disbursements
        </p>
      </div>

      <EmptyState
        icon={<IconHeart size={40} className="text-rose-500 dark:text-rose-400" />}
        title="Welfare Requests Coming Soon"
        description="Members can submit welfare requests with supporting documents. Admins review, approve, and process payouts. Track request status, approval workflows, and disbursement history. Includes notifications and reporting. Available with Professional tier. Part of Phase 5.5: Welfare & Social Funds."
        comingSoon
      />
    </div>
  );
}
