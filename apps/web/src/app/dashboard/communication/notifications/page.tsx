'use client';

import { EmptyState } from '@/components/EmptyState';
import { IconBell } from '@tabler/icons-react';

export default function NotificationsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Notification Center
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          View and manage all notifications
        </p>
      </div>

      <EmptyState
        icon={<IconBell size={40} className="text-amber-500 dark:text-amber-400" />}
        title="Notification Center Coming Soon"
        description="View all system notifications, payment reminders, meeting alerts, and announcements in one place. Mark as read, filter by type, and manage notification preferences. Part of Phase 6: Notifications & Communication."
        comingSoon
      />
    </div>
  );
}
