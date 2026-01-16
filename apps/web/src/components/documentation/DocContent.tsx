'use client';

import { Paper } from '@mantine/core';
import { useEffect } from 'react';

interface DocContentProps {
  content: string;
}

export function DocContent({ content }: DocContentProps) {
  // Add lazy loading to images after render
  useEffect(() => {
    const images = document.querySelectorAll('.doc-content img');
    images.forEach((img) => {
      img.setAttribute('loading', 'lazy');
    });
  }, [content]);

  return (
    <Paper
      p="xl"
      withBorder
      shadow="sm"
      radius="md"
      className="prose prose-sm md:prose-base lg:prose-lg dark:prose-invert max-w-none"
    >
      <div
        dangerouslySetInnerHTML={{ __html: content }}
        className="doc-content"
      />
      <style jsx global>{`
        .doc-content h1 {
          font-size: 2rem;
          font-weight: 700;
          margin-top: 2rem;
          margin-bottom: 1rem;
          line-height: 1.2;
          color: #0f766e;
        }
        .dark .doc-content h1 {
          color: #2dd4bf;
        }
        .doc-content h2 {
          font-size: 1.75rem;
          font-weight: 600;
          margin-top: 1.75rem;
          margin-bottom: 0.875rem;
          line-height: 1.3;
          color: #0f766e;
        }
        .dark .doc-content h2 {
          color: #2dd4bf;
        }
        .doc-content h3 {
          font-size: 1.5rem;
          font-weight: 600;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          line-height: 1.4;
          color: #0d9488;
        }
        .dark .doc-content h3 {
          color: #14b8a6;
        }
        .doc-content h4 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 1.25rem;
          margin-bottom: 0.625rem;
          line-height: 1.5;
          color: #0d9488;
        }
        .dark .doc-content h4 {
          color: #14b8a6;
        }
        .doc-content p {
          margin-bottom: 1rem;
          line-height: 1.7;
          color: #374151;
        }
        .dark .doc-content p {
          color: #d1d5db;
        }
        .doc-content ul,
        .doc-content ol {
          margin-bottom: 1rem;
          padding-left: 1.5rem;
        }
        .doc-content li {
          margin-bottom: 0.5rem;
          line-height: 1.6;
          color: #374151;
        }
        .dark .doc-content li {
          color: #d1d5db;
        }
        .doc-content a {
          color: #0d9488;
          text-decoration: underline;
          font-weight: 500;
        }
        .doc-content a:hover {
          color: #0f766e;
        }
        .doc-content blockquote {
          border-left: 4px solid #0d9488;
          padding-left: 1rem;
          margin: 1.5rem 0;
          font-style: italic;
          color: #64748b;
          background-color: #f0fdfa;
          padding: 1rem;
          border-radius: 0 0.5rem 0.5rem 0;
        }
        .dark .doc-content blockquote {
          background-color: #1e293b;
          color: #94a3b8;
        }
        .doc-content code {
          background-color: #f1f5f9;
          padding: 0.125rem 0.25rem;
          border-radius: 0.25rem;
          font-size: 0.875em;
          font-family: 'Courier New', Courier, monospace;
          color: #0f766e;
        }
        .dark .doc-content code {
          background-color: #1e293b;
          color: #2dd4bf;
        }
        .doc-content pre {
          background-color: #1e293b;
          padding: 1rem;
          border-radius: 0.5rem;
          overflow-x: auto;
          margin: 1rem 0;
          border: 1px solid #334155;
        }
        .doc-content pre code {
          background-color: transparent;
          padding: 0;
          color: #e2e8f0;
        }
        .doc-content img {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
          margin: 1rem 0;
          border: 1px solid #e2e8f0;
        }
        .dark .doc-content img {
          border-color: #334155;
        }
        .doc-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 1rem 0;
          font-size: 0.875rem;
        }
        .doc-content th,
        .doc-content td {
          border: 1px solid #e2e8f0;
          padding: 0.5rem 0.75rem;
          text-align: left;
        }
        .doc-content th {
          background-color: #f0fdfa;
          font-weight: 600;
          color: #0f766e;
        }
        .dark .doc-content th {
          background-color: #1e293b;
          color: #2dd4bf;
          border-color: #334155;
        }
        .dark .doc-content td {
          border-color: #334155;
        }
        .doc-content tr:nth-child(even) {
          background-color: #f8fafc;
        }
        .dark .doc-content tr:nth-child(even) {
          background-color: #1e293b;
        }
        .doc-content hr {
          border: none;
          border-top: 2px solid #e2e8f0;
          margin: 2rem 0;
        }
        .dark .doc-content hr {
          border-top-color: #334155;
        }
      `}</style>
    </Paper>
  );
}
