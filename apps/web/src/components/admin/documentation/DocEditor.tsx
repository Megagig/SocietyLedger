'use client';

import { useState } from 'react';

interface DocEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
}

export default function DocEditor({ value, onChange, placeholder = 'Write your content here...', minHeight = '400px' }: DocEditorProps) {
  const [previewMode, setPreviewMode] = useState(false);

  // Simple markdown preview
  const renderMarkdown = (markdown: string) => {
    if (!markdown) return '<p class="text-gray-500">No content</p>';

    let html = markdown
      // Headers
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-4 mb-2">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>')
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
      .replace(/(<li.*<\/li>)/gim, '<ul class="list-disc">$1</ul>')
      // Line breaks
      .replace(/\n/gim, '<br />');

    return html;
  };

  return (
    <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-300 dark:border-gray-600">
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span>Markdown supported</span>
        </div>
        <button
          type="button"
          onClick={() => setPreviewMode(!previewMode)}
          className="text-sm px-3 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
        >
          {previewMode ? 'Edit' : 'Preview'}
        </button>
      </div>

      {/* Editor/Preview */}
      <div style={{ minHeight }}>
        {previewMode ? (
          <div
            className="p-4 prose dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(value) }}
          />
        ) : (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full h-full min-h-[400px] p-4 bg-transparent text-gray-900 dark:text-white font-mono text-sm resize-none focus:outline-none"
          />
        )}
      </div>

      {/* Markdown Help */}
      {!previewMode && (
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-300 dark:border-gray-600">
          <details className="text-xs">
            <summary className="cursor-pointer text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
              Markdown Quick Reference
            </summary>
            <div className="mt-2 grid grid-cols-2 gap-2 text-gray-500 dark:text-gray-400">
              <div>
                <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded"># Heading 1</code>
              </div>
              <div>
                <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">## Heading 2</code>
              </div>
              <div>
                <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">**bold**</code>
              </div>
              <div>
                <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">*italic*</code>
              </div>
              <div>
                <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">`code`</code>
              </div>
              <div>
                <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">[link](url)</code>
              </div>
              <div>
                <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">- list item</code>
              </div>
              <div>
                <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">```code block```</code>
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
