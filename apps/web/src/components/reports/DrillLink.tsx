import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * A figure on a report that can be clicked: it opens the records that add up to it. The dotted underline says so. A figure with
 * nothing behind it is shown plainly by passing no `href`.
 */
export function DrillLink({ href, children, label }: { href?: string; children: ReactNode; label?: string }) {
  if (!href) return <>{children}</>;
  return (
    <Link
      href={href}
      aria-label={label ? `${label}. Opens the list.` : undefined}
      className="underline decoration-dotted underline-offset-4 hover:decoration-solid"
      title="See what makes up this figure"
    >
      {children}
    </Link>
  );
}
