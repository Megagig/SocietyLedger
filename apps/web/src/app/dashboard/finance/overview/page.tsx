'use client';

import { EmptyState } from '@/components/EmptyState';
import { IconChartBar } from '@tabler/icons-react';

export default function FinanceOverviewPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Finance Overview
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Get a comprehensive view of your association's financial health
        </p>
      </div>

      <EmptyState
        icon={<IconChartBar size={40} className="text-teal-500 dark:text-teal-400" />}
        title="Financial Overview Dashboard Coming Soon"
        description="View real-time financial metrics, income vs expenses, cash flow trends, outstanding balances, and financial health indicators all in one place. This powerful dashboard will help you make informed financial decisions."
        comingSoon
      />
    </div>
  );
}
