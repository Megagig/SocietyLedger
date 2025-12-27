'use client';

import { EmptyState } from '@/components/EmptyState';
import { IconSettings } from '@tabler/icons-react';

export default function SettingsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Association Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Configure your association's preferences and settings
        </p>
      </div>

      <EmptyState
        icon={<IconSettings size={40} className="text-gray-500 dark:text-gray-400" />}
        title="Settings Coming Soon"
        description="Configure association details, branding (logo, colors), payment methods, notification preferences, roles and permissions, fiscal year settings, and integration options. Includes user management and security settings."
        comingSoon
      />
    </div>
  );
}
