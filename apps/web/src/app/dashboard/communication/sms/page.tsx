'use client';

import { EmptyState } from '@/components/EmptyState';
import { IconBell } from '@tabler/icons-react';

export default function BulkSMSPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Bulk SMS
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Send SMS messages to members
        </p>
      </div>

      <EmptyState
        icon={<IconBell size={40} className="text-blue-500 dark:text-blue-400" />}
        title="Bulk SMS Coming Soon"
        description="Send SMS to individual members or groups. Create templates, schedule messages, track delivery status, and monitor SMS usage. Includes payment reminders, meeting alerts, and custom announcements. Available with Professional tier. Part of Phase 6.5: Bulk SMS & WhatsApp."
        comingSoon
      />
    </div>
  );
}
