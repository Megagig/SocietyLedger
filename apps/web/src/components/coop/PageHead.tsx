import type { ReactNode } from 'react';
import { HelpLink } from '@/components/docs/HelpLink';

/** The title block every cooperative page opens with: a heading, one line saying what the page is for, and the page's actions. */
export function PageHead({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold text-ink">{title}</h1>
          <HelpLink />
        </div>
        {subtitle && <p className="mt-1 text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
