import { Cards, Card } from 'fumadocs-ui/components/card';
import type { ReactNode } from 'react';

/**
 * 2 columns desktop, 1 on phones; hover: border → primary, no lift/shadow
 * (`ui-rules.md §11.5`). Thin rename of Fumadocs' `Cards`/`Card` — their
 * default styling already matches (icon + title + description, border on
 * hover, no shadow); re-exported under our name so MDX authors write
 * `<CardGrid>`/`<Card>` per `code-standards.md §17.4`'s allow-list.
 */
export function CardGrid({ children }: { children: ReactNode }) {
  return <Cards className="sm:grid-cols-2">{children}</Cards>;
}

export { Card };
