'use client';

import { EmptyState } from '@/components/EmptyState';
import { IconHeart } from '@tabler/icons-react';

export default function DonationsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Donations & Fundraising
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Track donations and manage fundraising campaigns
        </p>
      </div>

      <EmptyState
        icon={<IconHeart size={40} className="text-rose-500 dark:text-rose-400" />}
        title="Donations Management Coming Soon"
        description="Create fundraising campaigns, track donor contributions, issue receipts, manage pledges, and generate donor reports. Build transparency and trust with your members through comprehensive donation tracking."
        comingSoon
      />
    </div>
  );
}
