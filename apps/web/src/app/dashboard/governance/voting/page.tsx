'use client';

import { EmptyState } from '@/components/EmptyState';
import { IconBadge } from '@tabler/icons-react';

export default function VotingPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Voting & Elections
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Conduct digital voting and manage elections
        </p>
      </div>

      <EmptyState
        icon={<IconBadge size={40} className="text-indigo-500 dark:text-indigo-400" />}
        title="Voting & Elections Coming Soon"
        description="Create elections, manage candidates, conduct secure digital voting, run polls, track voter turnout, and announce results transparently. Includes ballot customization, voting periods, and real-time results. Available with Professional tier. Part of Phase 4.5: Voting & Elections."
        comingSoon
      />
    </div>
  );
}
