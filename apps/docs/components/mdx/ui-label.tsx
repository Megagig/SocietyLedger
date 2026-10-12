import type { ReactNode } from 'react';

/**
 * Bold text, no box/border — labels should look like the words on the
 * button, not like keyboard keys (`ui-rules.md §11.5`).
 */
export function UiLabel({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-fd-foreground">{children}</strong>;
}
