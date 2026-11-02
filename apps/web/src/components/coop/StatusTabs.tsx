'use client';

import { useRef, type KeyboardEvent } from 'react';

export interface StatusTab<T extends string> {
  value: T;
  label: string;
}

/**
 * The row of tabs the cooperative pages use to switch between statuses or views. One place for the pattern: a grid on phones (so labels
 * never wrap out of the screen) that becomes an inline strip from `sm`, the arrow keys, Home and End to move between tabs, and `panelId`
 * so the tab names the region it controls. Each page keeps its own state and renders the panel.
 */
export function StatusTabs<T extends string>({
  label,
  tabs,
  value,
  onChange,
  panelId,
  columns = 'grid-cols-2 sm:inline-flex',
}: {
  label: string;
  tabs: Array<StatusTab<T>>;
  value: T;
  onChange: (next: T) => void;
  /** The id of the region the tabs control; each tab then points at it. */
  panelId?: string;
  /** Tailwind grid classes for the strip; the default suits two to four tabs. */
  columns?: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = tabs.length - 1;
    let next = index;
    if (event.key === 'ArrowRight') next = index === last ? 0 : index + 1;
    else if (event.key === 'ArrowLeft') next = index === 0 ? last : index - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    else return;
    event.preventDefault();
    onChange(tabs[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className={`grid gap-1 rounded-lg bg-surface-sunken p-1 ${columns}`}>
      {tabs.map((tab, i) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${tab.value}`}
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={`h-11 rounded-md border border-transparent px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-success-focus ${selected ? 'bg-success-solid text-on-solid' : 'bg-transparent text-ink-muted hover:text-ink'}`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
