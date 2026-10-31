import { formatKobo } from '@/lib/ajo/format';

/** An amount in full (₦10,000.00), with figures that line up. `kobo` is the string the API sends. */
export function Money({ kobo, className = '' }: { kobo: string | null | undefined; className?: string }) {
  return <span className={`tabular-nums ${className}`}>{formatKobo(kobo)}</span>;
}
