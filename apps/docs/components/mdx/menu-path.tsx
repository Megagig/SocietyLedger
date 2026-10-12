import { ChevronRight } from 'lucide-react';
import { Fragment } from 'react';

/**
 * Bold segments joined by a chevron icon, not a typed "→" glyph; wraps on
 * phones (`ui-rules.md §11.5`). `<MenuPath items={["Finance", "Levies"]} />`.
 */
export function MenuPath({ items }: { items: string[] }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1 align-baseline font-semibold text-fd-foreground">
      {items.map((item, index) => (
        <Fragment key={item}>
          {index > 0 && <ChevronRight aria-hidden className="size-3.5 text-fd-muted-foreground" />}
          <span>{item}</span>
        </Fragment>
      ))}
    </span>
  );
}
