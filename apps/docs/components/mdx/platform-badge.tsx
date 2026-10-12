export type Platform = 'web' | 'mobile';

const labels: Record<Platform, string> = { web: 'Web', mobile: 'Mobile' };

/**
 * *Web* / *Mobile* badge (`ui-tokens.md §14.2`: `--docs-badge-web-*` /
 * `--docs-badge-mobile-*`).
 */
export function PlatformBadge({ platform }: { platform: Platform }) {
  const bg = platform === 'web' ? 'var(--docs-badge-web-bg)' : 'var(--docs-badge-mobile-bg)';
  const fg = platform === 'web' ? 'var(--docs-badge-web-fg)' : 'var(--docs-badge-mobile-fg)';

  return (
    <span
      className="docs-text-micro inline-flex items-center rounded-full px-2 py-0.5 uppercase tracking-wide"
      style={{ backgroundColor: bg, color: fg }}
    >
      {labels[platform]}
    </span>
  );
}
