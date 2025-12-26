'use client';

import { EmptyState } from '@/components/EmptyState';
import { IconBadge } from '@tabler/icons-react';

export default function AIAssistantPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          AI Financial Assistant
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Ask questions about your association's finances
        </p>
      </div>

      <EmptyState
        icon={<IconBadge size={40} className="text-indigo-500 dark:text-indigo-400" />}
        title="AI Assistant Coming Soon"
        description="Ask natural language questions about your finances like 'How much did we collect last month?' or 'Who hasn't paid their dues?'. Powered by OpenRouter with GPT-4, Claude, and Gemini. Includes safety guardrails and audit logging. Part of Phase 17: AI Integration."
        comingSoon
      />
    </div>
  );
}
