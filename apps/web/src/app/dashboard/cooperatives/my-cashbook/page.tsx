'use client';

import { CashbookScreen } from '@/components/coop/CashbookScreen';

/** My Cashbook: your own statement in cooperative bookkeeping form (the screen is shared with the officer's view of a member). */
export default function MyCashbookPage() {
  return <CashbookScreen title="Cashbook" subtitle="View your cashbook entries and export reports for the selected period." filename="my-cashbook" />;
}
