'use client';

import { Box, Paper, Text } from '@mantine/core';

interface PostContentProps {
  content: string;
}

export function PostContent({ content }: PostContentProps) {
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
        className="blog-content"
      />
      <style jsx global>{`
        .blog-content h1 {
          font-size: 2rem;
          font-weight: 700;
          margin-top: 2rem;
          margin-bottom: 1rem;
          line-height: 1.2;
        }
        .blog-content h2 {
          font-size: 1.75rem;
          font-weight: 600;
          margin-top: 1.75rem;
          margin-bottom: 0.875rem;
          line-height: 1.3;
        }
        .blog-content h3 {
          font-size: 1.5rem;
          font-weight: 600;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          line-height: 1.4;
        }
        .blog-content p {
          margin-bottom: 1rem;
          line-height: 1.7;
        }
        .blog-content ul,
        .blog-content ol {
          margin-bottom: 1rem;
          padding-left: 1.5rem;
        }
        .blog-content li {
          margin-bottom: 0.5rem;
          line-height: 1.6;
        }
        .blog-content a {
          color: #0d9488;
          text-decoration: underline;
        }
        .blog-content a:hover {
          color: #0f766e;
        }
        .blog-content blockquote {
          border-left: 4px solid #0d9488;
          padding-left: 1rem;
          margin: 1.5rem 0;
          font-style: italic;
          color: #64748b;
        }
        .blog-content code {
          background-color: #f1f5f9;
          padding: 0.125rem 0.25rem;
          border-radius: 0.25rem;
          font-size: 0.875em;
        }
        .dark .blog-content code {
          background-color: #1e293b;
        }
        .blog-content pre {
          background-color: #f1f5f9;
          padding: 1rem;
          border-radius: 0.5rem;
          overflow-x: auto;
          margin: 1rem 0;
        }
        .dark .blog-content pre {
          background-color: #1e293b;
        }
        .blog-content pre code {
          background-color: transparent;
          padding: 0;
        }
        .blog-content img {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
          margin: 1rem 0;
        }
        .blog-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 1rem 0;
        }
        .blog-content th,
        .blog-content td {
          border: 1px solid #e2e8f0;
          padding: 0.5rem 0.75rem;
          text-align: left;
        }
        .blog-content th {
          background-color: #f8fafc;
          font-weight: 600;
        }
        .dark .blog-content th {
          background-color: #1e293b;
        }
        .dark .blog-content th,
        .dark .blog-content td {
          border-color: #334155;
        }
      `}</style>
    </Paper>
  );
}
