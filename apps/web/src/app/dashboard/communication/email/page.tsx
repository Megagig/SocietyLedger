'use client';

import { EmptyState } from '@/components/EmptyState';
import { IconBell } from '@tabler/icons-react';

export default function EmailCampaignsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Email Campaigns
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Send email campaigns to members
        </p>
      </div>

      <EmptyState
        icon={<IconBell size={40} className="text-purple-500 dark:text-purple-400" />}
        title="Email Campaigns Coming Soon"
        description="Design and send professional email campaigns to members. Use templates, segment audiences, schedule sends, track open/click rates, and measure engagement. Perfect for newsletters, announcements, and updates. Part of Phase 6: Notifications & Communication."
        comingSoon
      />
    </div>
  );
}
