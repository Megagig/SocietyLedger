'use client';

import { EmptyState } from '@/components/EmptyState';
import { IconChartBar } from '@tabler/icons-react';

export default function SmartReportsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          AI-Powered Reports
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Generate intelligent reports with AI insights
        </p>
      </div>

      <EmptyState
        icon={<IconChartBar size={40} className="text-teal-500 dark:text-teal-400" />}
        title="Smart Reports Coming Soon"
        description="AI-generated financial reports with insights, trends, predictions, and recommendations. Automatically identify late payment patterns, suggest cost optimizations, and predict cash flow. Includes natural language summaries of complex financial data. Part of Phase 17: AI Integration."
        comingSoon
      />
    </div>
  );
}
