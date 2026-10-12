'use client';
import { useDocsPageData } from '@/lib/docs-page-context';
import { permissionLabel } from '@/lib/permission-labels';

/**
 * "You need the **<plain language>** permission." — renders automatically
 * from the page's frontmatter `permission` field (`code-standards.md §17.3`);
 * renders nothing if the page isn't permission-gated.
 */
export function PermissionNote() {
  const data = useDocsPageData();
  if (!data.permission) return null;

  return (
    <p>
      You need the <strong>{permissionLabel(data.permission)}</strong> permission.
    </p>
  );
}
