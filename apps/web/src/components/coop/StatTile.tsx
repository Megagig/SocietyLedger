import type { ReactNode } from 'react';
import { Naira } from './Naira';

export type TileTone = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

const TONE: Record<TileTone, { box: string; label: string; value: string; icon: string }> = {
  success: { box: 'border-success-line bg-success-soft', label: 'text-success-text', value: 'text-success-strong', icon: 'text-success' },
  info: { box: 'border-info-line bg-info-soft', label: 'text-info-text', value: 'text-info-strong', icon: 'text-info-text' },
  warning: { box: 'border-warning-line bg-warning-soft', label: 'text-warning-text', value: 'text-warning-strong', icon: 'text-warning-text' },
  danger: { box: 'border-danger-line bg-danger-soft', label: 'text-danger-text', value: 'text-danger-strong', icon: 'text-danger' },
  neutral: { box: 'border-line bg-surface-muted', label: 'text-ink-muted', value: 'text-ink', icon: 'text-ink-faint' },
};

/** A figure with a label: the summary tiles across the cooperative pages. Tone is meaning (good, information, caution, owed), never decoration. */
export function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
  icon,
  masked = false,
}: {
  label: string;
  value: string | number | null | undefined;
  hint?: ReactNode;
  tone?: TileTone;
  icon?: ReactNode;
  masked?: boolean;
}) {
  const t = TONE[tone];
  return (
    <div className={`rounded-lg border p-4 ${t.box}`}>
      <div className="flex items-start justify-between gap-2">
        <p className={`text-xs font-semibold uppercase tracking-wide ${t.label}`}>{label}</p>
        {icon && (
          <span className={t.icon} aria-hidden="true">
            {icon}
          </span>
        )}
      </div>
      <p className={`mt-2 text-2xl font-bold ${t.value}`}>
        <Naira value={value} masked={masked} />
      </p>
      {hint && <p className={`mt-1 text-xs ${t.label}`}>{hint}</p>}
    </div>
  );
}
