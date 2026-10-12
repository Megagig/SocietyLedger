import { Info, Lightbulb, OctagonAlert, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

export type CalloutType = 'note' | 'tip' | 'warning' | 'danger';

const icons: Record<CalloutType, typeof Info> = {
  note: Info,
  tip: Lightbulb,
  warning: TriangleAlert,
  danger: OctagonAlert,
};

/**
 * Left 4-px rule + icon in the type colour on its soft background; title
 * optional (`ui-rules.md §11.5`). Max 2 per page, never at the very top —
 * an authoring convention, not enforced here. Built from scratch rather
 * than wrapping Fumadocs' own `Callout` (`library-docs.md`'s Fumadocs
 * notes): Fumadocs' type enum (info/warn/error/success/idea) doesn't match
 * our four, and it reads `--color-fd-*` vars, not the dedicated
 * `--docs-callout-*` bg/border pairs `ui-tokens.md §14.2` defines for this.
 */
export function Callout({
  type = 'note',
  title,
  children,
}: {
  type?: CalloutType;
  title?: ReactNode;
  children: ReactNode;
}) {
  const Icon = icons[type];

  return (
    <div
      role="note"
      className="my-4 flex gap-3 rounded-(--radius-md) border-s-4 p-3 text-sm"
      style={{
        backgroundColor: `var(--docs-callout-${type}-bg)`,
        borderColor: `var(--docs-callout-${type}-border)`,
        color: 'var(--color-fd-foreground)',
      }}
    >
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0" style={{ color: `var(--docs-callout-${type}-border)` }} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title && <p className="m-0 font-semibold">{title}</p>}
        <div className="prose-no-margin">{children}</div>
      </div>
    </div>
  );
}
