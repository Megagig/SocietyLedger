'use client';

import { EmptyState } from '@/components/EmptyState';
import { IconCreditCard } from '@tabler/icons-react';

export default function CashFlowPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Cash Flow Statement
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Track cash inflows and outflows
        </p>
      </div>

      <EmptyState
        icon={<IconCreditCard size={40} className="text-blue-500 dark:text-blue-400" />}
        title="Cash Flow Statement Coming Soon"
        description="Monitor your association's cash movements with operating, investing, and financing activities. Understand cash generation, usage patterns, and liquidity position. Available with Professional tier and above. Part of Phase 9: Accounting System."
        comingSoon
      />
    </div>
  );
}
