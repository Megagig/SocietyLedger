'use client';

import { EmptyState } from '@/components/EmptyState';
import { IconReceipt } from '@tabler/icons-react';

export default function DuesPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Member Dues
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Track and manage recurring member dues
        </p>
      </div>

      <EmptyState
        icon={<IconReceipt size={40} className="text-teal-500 dark:text-teal-400" />}
        title="Dues Management Coming Soon"
        description="Set up recurring dues, track payments, send automated reminders, and generate member statements. This comprehensive dues management system will be available in Phase 3."
        comingSoon
      />
    </div>
  );
}
