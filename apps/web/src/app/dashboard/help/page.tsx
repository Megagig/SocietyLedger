'use client';

import { EmptyState } from '@/components/EmptyState';
import { IconHelp } from '@tabler/icons-react';

export default function HelpPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Help & Support
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Get help and access documentation
        </p>
      </div>

      <EmptyState
        icon={<IconHelp size={40} className="text-blue-500 dark:text-blue-400" />}
        title="Help Center Coming Soon"
        description="Access comprehensive documentation, video tutorials, FAQs, and submit support tickets. Includes live chat support for Professional and Enterprise tiers. Search knowledge base and get quick answers to common questions."
        comingSoon
      />
    </div>
  );
}
