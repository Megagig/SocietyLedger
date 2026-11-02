import { formatNairaFull } from '@/utils/format';

/**
 * An amount in full (₦10,000.00), never shortened, with figures that line up. A missing amount shows a dash. `masked` hides the figure
 * (the dashboard's Hide button), keeping the screen reader told the figure is hidden instead of reading dots.
 */
export function Naira({ value, className = '', masked = false }: { value: string | number | null | undefined; className?: string; masked?: boolean }) {
  if (masked) {
    return (
      <span className={className}>
        <span aria-hidden="true">₦ ••••••</span>
        <span className="sr-only">Amount hidden</span>
      </span>
    );
  }
  return <span className={`tabular-nums ${className}`}>{value === null || value === undefined ? '—' : formatNairaFull(value)}</span>;
}
