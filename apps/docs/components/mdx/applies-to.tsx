'use client';
import { useDocsPageData } from '@/lib/docs-page-context';
import { permissionLabel } from '@/lib/permission-labels';
import { moduleLabel } from '@/lib/module-labels';
import { PlatformBadge, type Platform } from './platform-badge';

const audienceLabels: Record<string, string> = {
  all: 'Everyone',
  member: 'Members',
  officer: 'Officers',
  admin: 'Association admins',
  founder: 'Founders',
};

/**
 * Audience chips · platform badges · plan/module note · permission in
 * plain words (`ui-rules.md §11.4`/§11.5). Auto-generated from frontmatter
 * — omitted on overview/FAQ pages by the page route, not by this
 * component (so a direct `<AppliesTo />` in MDX always renders).
 */
export function AppliesTo() {
  const data = useDocsPageData();

  return (
    <div
      className="my-4 flex flex-wrap items-center gap-2 rounded-(--radius-md) p-3 docs-text-small"
      style={{ backgroundColor: 'var(--docs-applies-bg)' }}
    >
      {data.audience.map((a) => (
        <span key={a} className="font-medium text-fd-foreground">
          {audienceLabels[a] ?? a}
        </span>
      ))}
      <span aria-hidden className="text-fd-muted-foreground">
        ·
      </span>
      {data.platforms.map((p) => (
        <PlatformBadge key={p} platform={p as Platform} />
      ))}
      {data.module && (
        <>
          <span aria-hidden className="text-fd-muted-foreground">
            ·
          </span>
          <span className="text-fd-muted-foreground">Needs the {moduleLabel(data.module)} module</span>
        </>
      )}
      {data.permission && (
        <>
          <span aria-hidden className="text-fd-muted-foreground">
            ·
          </span>
          <span className="text-fd-muted-foreground">
            You need permission to {permissionLabel(data.permission)}
          </span>
        </>
      )}
    </div>
  );
}
