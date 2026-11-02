type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const TONE: Record<Tone, string> = {
  success: 'border-success-line bg-success-soft text-success-text',
  warning: 'border-warning-line bg-warning-soft text-warning-text',
  danger: 'border-danger-line bg-danger-soft text-danger-text',
  info: 'border-info-line bg-info-soft text-info-text',
  neutral: 'border-line bg-surface-muted text-ink-muted',
};

const STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: 'Awaiting confirmation', tone: 'warning' },
  APPROVED: { label: 'Confirmed', tone: 'success' },
  REJECTED: { label: 'Not approved', tone: 'danger' },
  PENDING_REVIEW: { label: 'Awaiting review', tone: 'warning' },
  PENDING_APPROVAL: { label: 'Awaiting approval', tone: 'info' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
};

/** A status as words in a coloured pill. The words carry the meaning; the colour only backs them up. */
export function StatusPill({ status, label, tone }: { status?: string; label?: string; tone?: Tone }) {
  const known = status ? STATUS[status] : undefined;
  const text = label ?? known?.label ?? status ?? '';
  return <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONE[tone ?? known?.tone ?? 'neutral']}`}>{text}</span>;
}
