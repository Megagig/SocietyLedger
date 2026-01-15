'use client';

import { Box, CopyButton, ActionIcon, Tooltip, Text } from '@mantine/core';
import { IconCopy, IconCheck } from '@tabler/icons-react';

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
}

export function CodeBlock({ code, language = 'typescript', filename }: CodeBlockProps) {
  return (
    <Box className="code-block-wrapper">
      {filename && (
        <Box className="code-block-filename">
          <Text size="xs" c="dimmed" fw={500}>
            {filename}
          </Text>
        </Box>
      )}
      <Box className="code-block-container">
        <pre className={`language-${language}`}>
          <code>{code}</code>
        </pre>
        <CopyButton value={code} timeout={2000}>
          {({ copied, copy }) => (
            <Tooltip label={copied ? 'Copied!' : 'Copy code'} position="top">
              <ActionIcon
                className="code-block-copy"
                color={copied ? 'teal' : 'gray'}
                variant="filled"
                onClick={copy}
              >
                {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>
      </Box>
      <style jsx global>{`
        .code-block-wrapper {
          margin: 1rem 0;
          border-radius: 0.5rem;
          overflow: hidden;
          border: 1px solid #334155;
        }
        .code-block-filename {
          background-color: #1e293b;
          padding: 0.5rem 1rem;
          border-bottom: 1px solid #334155;
        }
        .code-block-container {
          position: relative;
          background-color: #0f172a;
        }
        .code-block-container pre {
          margin: 0;
          padding: 1rem;
          overflow-x: auto;
          background-color: #0f172a;
        }
        .code-block-container code {
          font-family: 'Courier New', Courier, monospace;
          font-size: 0.875rem;
          line-height: 1.6;
          color: #e2e8f0;
        }
        .code-block-copy {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .code-block-container:hover .code-block-copy {
          opacity: 1;
        }
        /* Syntax highlighting colors */
        .code-block-container .token.comment,
        .code-block-container .token.prolog,
        .code-block-container .token.doctype,
        .code-block-container .token.cdata {
          color: #64748b;
          font-style: italic;
        }
        .code-block-container .token.punctuation {
          color: #94a3b8;
        }
        .code-block-container .token.property,
        .code-block-container .token.tag,
        .code-block-container .token.boolean,
        .code-block-container .token.number,
        .code-block-container .token.constant,
        .code-block-container .token.symbol,
        .code-block-container .token.deleted {
          color: #f472b6;
        }
        .code-block-container .token.selector,
        .code-block-container .token.attr-name,
        .code-block-container .token.string,
        .code-block-container .token.char,
        .code-block-container .token.builtin,
        .code-block-container .token.inserted {
          color: #a5b4fc;
        }
        .code-block-container .token.operator,
        .code-block-container .token.entity,
        .code-block-container .token.url,
        .code-block-container .token.variable {
          color: #fbbf24;
        }
        .code-block-container .token.atrule,
        .code-block-container .token.attr-value,
        .code-block-container .token.function,
        .code-block-container .token.class-name {
          color: #34d399;
        }
        .code-block-container .token.keyword {
          color: #60a5fa;
        }
        .code-block-container .token.regex,
        .code-block-container .token.important {
          color: #f87171;
        }
      `}</style>
    </Box>
  );
}
