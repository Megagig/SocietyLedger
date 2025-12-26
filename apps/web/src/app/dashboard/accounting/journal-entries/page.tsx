'use client';

import { EmptyState } from '@/components/EmptyState';
import { IconFileAnalytics } from '@tabler/icons-react';

export default function JournalEntriesPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Journal Entries
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Record and manage accounting journal entries
        </p>
      </div>

      <EmptyState
        icon={<IconFileAnalytics size={40} className="text-blue-500 dark:text-blue-400" />}
        title="Journal Entries Coming Soon"
        description="Create double-entry journal entries, manage adjustments, view audit trails, and ensure accurate bookkeeping. Supports maker-checker workflow for enterprise tier. Part of Phase 9: Accounting System."
        comingSoon
      />
    </div>
  );
}
