import { statusTone, type Tone } from '@/lib/status-tone';

const toneVar: Record<Tone, string> = {
  success: 'var(--color-fd-success)',
  warning: 'var(--color-fd-warning)',
  danger: 'var(--color-fd-error)',
  info: 'var(--color-fd-info)',
  neutral: 'var(--color-fd-muted-foreground)',
};

/**
 * Same status → colour mapping as the mobile app (`ui-tokens.md §1.4`),
 * with text (`ui-rules.md §11.5`).
 */
export function StatusChip({ status, label }: { status: string; label?: string }) {
  const color = toneVar[statusTone(status)];

  return (
    <span
      className="docs-text-small inline-flex items-center rounded-full px-2.5 py-0.5"
      style={{ backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)`, color }}
    >
      {label ?? status}
    </span>
  );
}
