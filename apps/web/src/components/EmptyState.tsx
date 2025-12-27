'use client';

import { Button } from '@mantine/core';
import { IconInbox, IconArrowLeft } from '@tabler/icons-react';
import Link from 'next/link';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  comingSoon?: boolean;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  comingSoon = false,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-500/20 to-green-500/20 border-2 border-teal-500/30 flex items-center justify-center mb-6">
        {icon || <IconInbox size={40} className="text-teal-500 dark:text-teal-400" />}
      </div>
      
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
        {title}
      </h2>
      
      <p className="text-gray-600 dark:text-gray-400 max-w-md mb-8 leading-relaxed">
        {description}
      </p>
      
      {comingSoon && (
        <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full glass border-2 border-teal-500/30 mb-6">
          <span className="text-sm font-medium text-teal-600 dark:text-teal-400">
            🚀 Coming Soon
          </span>
        </div>
      )}
      
      {actionLabel && actionHref && !comingSoon && (
        <Button
          component={Link}
          href={actionHref}
          size="lg"
          className="bg-gradient-to-r from-teal-500 to-green-500 hover:from-teal-600 hover:to-green-600 text-white"
        >
          {actionLabel}
        </Button>
      )}
      
      <Button
        component={Link}
        href="/dashboard"
        variant="subtle"
        leftSection={<IconArrowLeft size={18} />}
        className="mt-4"
      >
        Back to Dashboard
      </Button>
    </div>
  );
}
