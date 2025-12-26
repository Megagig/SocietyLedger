'use client';

import { EmptyState } from '@/components/EmptyState';
import { IconBell } from '@tabler/icons-react';

export default function WhatsAppPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          WhatsApp Messaging
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Send WhatsApp messages to members
        </p>
      </div>

      <EmptyState
        icon={<IconBell size={40} className="text-green-500 dark:text-green-400" />}
        title="WhatsApp Messaging Coming Soon"
        description="Send WhatsApp messages and notifications to members using official WhatsApp Business API. Create templates, send rich media, track delivery, and engage members on their preferred platform. Available with Professional tier. Part of Phase 6.5: Bulk SMS & WhatsApp."
        comingSoon
      />
    </div>
  );
}
