'use client';

import { EmptyState } from '@/components/EmptyState';
import { IconChartBar } from '@tabler/icons-react';

export default function ReportsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Reports & Analytics
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Generate comprehensive financial and member reports
        </p>
      </div>

      <EmptyState
        icon={<IconChartBar size={40} className="text-teal-500 dark:text-teal-400" />}
        title="Reports & Analytics Coming Soon"
        description="Generate financial statements, member reports, payment analytics, aging analysis, trend reports, and custom exports. Export to PDF and Excel with your association's branding. Includes scheduled reports and email delivery. Part of Phase 5: Reporting System."
        comingSoon
      />
    </div>
  );
}
