'use client';

import { EmptyState } from '@/components/EmptyState';
import { IconUsers } from '@tabler/icons-react';

export default function MeetingsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Meetings Management
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Schedule and manage association meetings
        </p>
      </div>

      <EmptyState
        icon={<IconUsers size={40} className="text-teal-500 dark:text-teal-400" />}
        title="Meetings Management Coming Soon"
        description="Schedule meetings, send invitations, create agendas, share minutes, and track RSVPs. Includes recurring meetings, calendar integration, and automated reminders via SMS/Email. Part of Phase 12.5: Meetings & Attendance."
        comingSoon
      />
    </div>
  );
}
