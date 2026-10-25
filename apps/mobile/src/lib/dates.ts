import { format, formatDistanceToNowStrict, parseISO } from 'date-fns';

export type DateFormatVariant = 'short' | 'long' | 'relative' | 'time' | 'monthYear';

// ui-rules.md §7 — "Tue 14 Oct" (short), "14 Oct 2026" (long, different year); code-standards.md
// §11 names the full variant set. "Today, 3:30 PM" isn't a variant of its own — callers compose
// it from `isToday()` + `formatDate(iso, 'time')` themselves, since no variant name covers that
// one specific composition.
const FORMAT_PATTERNS: Record<Exclude<DateFormatVariant, 'relative'>, string> = {
  short: 'EEE d MMM',
  long: 'd MMM yyyy',
  time: 'h:mm a',
  monthYear: 'MMMM yyyy',
};

/**
 * ISO strings in, device-locale-formatted strings out (code-standards.md §11). No `date-fns-tz`
 * — architecture.md §3 lists it as "if needed"; real users' devices are already set to
 * `Africa/Lagos` (Nigeria has no DST), so plain local-time formatting already matches. Revisit
 * if a real cross-timezone case surfaces.
 */
export function formatDate(iso: string, variant: DateFormatVariant = 'short'): string {
  const date = parseISO(iso);

  if (variant === 'relative') {
    // ui-rules.md §7's own example ("5 min ago") is informal prose, not a literal contract —
    // date-fns' standard "5 minutes ago" is used rather than a custom abbreviated locale.
    return formatDistanceToNowStrict(date, { addSuffix: true });
  }

  return format(date, FORMAT_PATTERNS[variant]);
}

/** Used by callers composing the "Today, 3:30 PM" pattern (ui-rules.md §7) themselves. */
export function isToday(iso: string): boolean {
  const date = parseISO(iso);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}
