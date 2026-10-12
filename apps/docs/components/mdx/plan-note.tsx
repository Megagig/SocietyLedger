'use client';
import { useDocsPageData } from '@/lib/docs-page-context';
import { moduleLabel } from '@/lib/module-labels';

/**
 * "Available on plans that include <Module>." — from frontmatter `module`;
 * renders nothing if the page isn't module-gated. No prices
 * (`architecture.md §14.12`) — link to `/pricing` on the main site only
 * from plan-billing pages, written by hand there.
 */
export function PlanNote() {
  const data = useDocsPageData();
  if (!data.module) return null;

  return (
    <p>
      Available on plans that include <strong>{moduleLabel(data.module)}</strong>.
    </p>
  );
}
