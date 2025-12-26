'use client';

import { EmptyState } from '@/components/EmptyState';
import { IconWallet } from '@tabler/icons-react';

export default function LeviesPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Levies & Special Assessments
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage one-time and special levies
        </p>
      </div>

      <EmptyState
        icon={<IconWallet size={40} className="text-green-500 dark:text-green-400" />}
        title="Levies Management Coming Soon"
        description="Create special levies, track contributions, manage payment plans, and monitor collection rates. Perfect for project-specific fundraising and special assessments."
        comingSoon
      />
    </div>
  );
}
