'use client';

import { EmptyState } from '@/components/EmptyState';
import { IconChartBar } from '@tabler/icons-react';

export default function IncomeStatementPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Income Statement (P&L)
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          View profit and loss statement for any period
        </p>
      </div>

      <EmptyState
        icon={<IconChartBar size={40} className="text-green-500 dark:text-green-400" />}
        title="Income Statement Coming Soon"
        description="Generate professional income statements showing revenue, expenses, and net profit/loss. Filter by date range, compare periods, and export to PDF. Available with Professional tier and above. Part of Phase 9: Accounting System."
        comingSoon
      />
    </div>
  );
}
