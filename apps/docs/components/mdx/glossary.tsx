'use client';
import { useId, useState, type ReactNode } from 'react';

/**
 * Inline glossary-term tooltip: `<Glossary definition="…">quorum</Glossary>`.
 * The definition is supplied at the point of use rather than looked up from
 * a central glossary data store — the glossary page (`core-concepts/glossary`,
 * D2.2) is prose, not structured data, and nothing yet needs a shared
 * term→definition registry. Revisit if that changes.
 */
export function Glossary({ definition, children }: { definition: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span className="relative inline-block">
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
        className="cursor-help underline decoration-dotted decoration-fd-muted-foreground underline-offset-2"
      >
        {children}
      </button>
      {open && (
        <span
          role="tooltip"
          id={id}
          className="docs-text-small absolute start-0 top-full z-10 mt-1 w-64 rounded-(--radius-md) border border-fd-border bg-fd-popover p-2 text-fd-popover-foreground shadow-md"
        >
          {definition}
        </span>
      )}
    </span>
  );
}
