'use client';

import { Badge, Progress } from '@mantine/core';
import {
  IconAlertTriangle,
  IconCalendarEvent,
  IconCheck,
  IconCircleDashed,
  IconClockHour4,
  IconMinus,
  IconSearch,
  IconX,
  type Icon,
} from '@tabler/icons-react';
import type { ReactNode } from 'react';
import type { PaymentStatus, PayoutPositionStatus } from '@/lib/ajo/boardTypes';

/**
 * The one place that turns a board status into words, an icon and a colour (spec §16.3). A status is always text plus an icon, never
 * colour alone, so it stays readable for colour-blind people and in print. Colours are the theme's, not hex values.
 */
const STATUS: Record<PaymentStatus, { color: string; icon: Icon; variant: 'light' | 'outline' }> = {
  PAID_ON_TIME: { color: 'green', icon: IconCheck, variant: 'light' },
  PAID_LATE: { color: 'lime', icon: IconCheck, variant: 'light' },
  REPORTED: { color: 'blue', icon: IconClockHour4, variant: 'light' },
  DUE: { color: 'gray', icon: IconCircleDashed, variant: 'light' },
  OVERDUE: { color: 'yellow', icon: IconAlertTriangle, variant: 'light' },
  MISSED: { color: 'red', icon: IconX, variant: 'light' },
  UNDER_REVIEW: { color: 'grape', icon: IconSearch, variant: 'light' },
  WAIVED: { color: 'gray', icon: IconMinus, variant: 'outline' },
  UPCOMING: { color: 'gray', icon: IconCalendarEvent, variant: 'light' },
};

/** "grace until 04/03", from the day the API sends. */
const shortDay = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

export function StatusChip({ status, label, graceEndsOn }: { status: PaymentStatus; label: string; graceEndsOn?: string | null }) {
  const tone = STATUS[status];
  const Glyph = tone.icon;
  return (
    <Badge color={tone.color} variant={tone.variant} radius="sm" leftSection={<Glyph size={12} aria-hidden />} data-status={status}>
      {label}
      {status === 'OVERDUE' && graceEndsOn ? ` · grace until ${shortDay(graceEndsOn)}` : ''}
    </Badge>
  );
}

/** The short version for a matrix cell: the icon, with the status as its accessible name and its tooltip. */
export function StatusGlyph({ status, label, title }: { status: PaymentStatus; label: string; title?: string }) {
  const tone = STATUS[status];
  const Glyph = tone.icon;
  return (
    <span
      role="img"
      aria-label={label}
      title={title ?? label}
      className="inline-flex h-7 w-7 items-center justify-center rounded"
      style={{ background: `var(--mantine-color-${tone.color}-light)`, color: `var(--mantine-color-${tone.color}-light-color)` }}
    >
      <Glyph size={14} aria-hidden />
    </span>
  );
}

const PAYOUT: Record<PayoutPositionStatus, { color: string; label: string }> = {
  UPCOMING: { color: 'gray', label: 'Upcoming' },
  PREPARED: { color: 'blue', label: 'Prepared' },
  APPROVED: { color: 'teal', label: 'Approved' },
  PAID: { color: 'green', label: 'Paid' },
  HELD: { color: 'yellow', label: 'Held' },
};

export function PayoutChip({ status }: { status: PayoutPositionStatus }) {
  const tone = PAYOUT[status];
  return (
    <Badge color={tone.color} variant="light" radius="sm">
      {tone.label}
    </Badge>
  );
}

/** Basis points as a percentage: 9500 is "95%". */
export const percent = (bps: number | null | undefined): string => (bps === null || bps === undefined ? 'None yet' : `${Math.round(bps / 100)}%`);

/** A moment in the group's own clock (spec §16.2: one clock), not the reader's. */
export function formatMomentIn(value: string | null | undefined, timeZone: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: false, timeZone });
}

export function Stat({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border border-line p-4">
      <p className="text-xs text-ink-faint">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink tabular-nums">{children}</p>
      {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}

export function Card({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`space-y-3 rounded-lg border border-line p-5 ${className}`}>
      {title ? <h3 className="text-base font-semibold text-ink">{title}</h3> : null}
      {children}
    </section>
  );
}

export function ProgressBar({ collected, expected, label }: { collected: bigint; expected: bigint; label: string }) {
  const value = expected > BigInt(0) ? Number((collected * BigInt(100)) / expected) : 0;
  return <Progress value={value} color="green" size="lg" radius="xl" aria-label={label} />;
}
