'use client';

import { EmptyState } from '@/components/EmptyState';
import { IconFileAnalytics } from '@tabler/icons-react';

export default function DocumentQAPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Document Q&A
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Ask questions about your uploaded documents
        </p>
      </div>

      <EmptyState
        icon={<IconFileAnalytics size={40} className="text-purple-500 dark:text-purple-400" />}
        title="Document Q&A Coming Soon"
        description="Upload documents and ask questions about their content using AI. Uses RAG (Retrieval Augmented Generation) with pgvector embeddings to search and answer questions from your constitution, bylaws, meeting minutes, and other documents. Part of Phase 17: AI Integration."
        comingSoon
      />
    </div>
  );
}
