'use client';

import { EmptyState } from '@/components/EmptyState';
import { IconUsers } from '@tabler/icons-react';

export default function GuarantorsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Loan Guarantors
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage loan guarantor relationships
        </p>
      </div>

      <EmptyState
        icon={<IconUsers size={40} className="text-purple-500 dark:text-purple-400" />}
        title="Guarantors Management Coming Soon"
        description="Track guarantor commitments, verify guarantor eligibility, manage guarantor limits, and monitor liability exposure. Includes guarantor consent forms and notification workflows. Available with Enterprise tier only. Part of Phase 9.5: Cooperatives & Loans."
        comingSoon
      />
    </div>
  );
}
