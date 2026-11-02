import { CashbookView } from '@/features/coopEnhanced/components/CashbookView';
import { OwnPage } from '@/features/coopEnhanced/components/OwnPage';
import { COOPERATIVE_OWN_PAGES_ACCESS } from '@/lib/permissions';

/** My Cashbook: your own statement in cooperative bookkeeping form (the view is shared with an officer opening one member's). */
export default function MyCashbookScreen() {
  return (
    <OwnPage title="Cashbook" subject="cashbook" access={COOPERATIVE_OWN_PAGES_ACCESS}>
      <CashbookView filename="my-cashbook" />
    </OwnPage>
  );
}
