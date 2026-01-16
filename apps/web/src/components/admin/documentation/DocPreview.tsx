'use client';

import { useState } from 'react';

interface DocPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
  excerpt?: string | null;
}

export default function DocPreview({ isOpen, onClose, title, content, excerpt }: DocPreviewProps) {
  const [viewMode, setViewMode] = useState<'preview' | 'raw'>('preview');

  // Simple markdown rendering
  const renderMarkdown = (markdown: string) => {
    if (!markdown) return '<p class="text-gray-500">No content</p>';

    let html = markdown
      // Headers
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold mt-6 mb-3">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-4 mb-3">$1</h1>')
      // Bold
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      // Code
      .replace(/`([^`]+)`/gim, '<code class="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-sm">$1</code>')
      // Code blocks
      .replace(/```([\s\S]*?)```/gim, '<pre class="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg overflow-x-auto my-4"><code>$1</code></pre>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" class="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>')
      // Lists
      .replace(/^\s*-\s+(.*$)/gim, '<li class="ml-4">$1</li>')
      .replace(/(<li.*<\/li>)/gim, '<ul class="list-disc my-2">$1</ul>')
      // Line breaks
      .replace(/\n/gim, '<br />');

    return html;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Preview: {title}
          </h2>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition ${
                  viewMode === 'preview'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Preview
              </button>
              <button
                type="button"
                onClick={() => setViewMode('raw')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition ${
                  viewMode === 'raw'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Raw
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {viewMode === 'preview' ? (
            <div className="p-6">
              {excerpt && (
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <strong>Excerpt:</strong> {excerpt}
                  </p>
                </div>
              )}
              <div
                className="prose dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
              />
            </div>
          ) : (
            <div className="p-6">
              <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm font-mono">
                <code>{content}</code>
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition text-sm font-medium"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
