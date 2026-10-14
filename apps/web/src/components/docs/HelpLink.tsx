'use client';

import { ActionIcon, Tooltip } from '@mantine/core';
import { IconHelpCircle } from '@tabler/icons-react';
import { usePathname } from 'next/navigation';
import { docsUrl, getHelpDocsPath } from '@/lib/docs';

/**
 * "Help for this page" icon button (architecture.md §15.3.4) — renders
 * nothing on a route with no entry in `DOCS_LINKS`, rather than linking
 * somewhere generic.
 */
export function HelpLink() {
  const pathname = usePathname();
  const docsPath = getHelpDocsPath(pathname);

  if (!docsPath) return null;

  return (
    <Tooltip label="Help for this page">
      <ActionIcon
        component="a"
        href={docsUrl(docsPath, 'web_help_link')}
        target="_blank"
        rel="noopener noreferrer"
        variant="subtle"
        color="gray"
        aria-label="Help for this page"
      >
        <IconHelpCircle size={20} />
      </ActionIcon>
    </Tooltip>
  );
}
