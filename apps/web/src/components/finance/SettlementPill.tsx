import { StatusPill } from '@/components/coop/StatusPill';
import type { Settlement } from '@/lib/finance/collections';

const LOOK: Record<Settlement, { label: string; tone: 'success' | 'warning' | 'neutral' }> = {
  paid: { label: 'Paid', tone: 'success' },
  part: { label: 'Part paid', tone: 'warning' },
  unpaid: { label: 'Not paid', tone: 'neutral' },
};

/** Paid, part paid or not paid, as words in a pill: the same wording as the exports. */
export function SettlementPill({ status }: { status: Settlement }) {
  return <StatusPill label={LOOK[status].label} tone={LOOK[status].tone} />;
}
