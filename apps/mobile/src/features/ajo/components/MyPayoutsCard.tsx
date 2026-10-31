import { View } from 'react-native';

import { SectionCard } from '@/components/layout/SectionCard';
import { Text } from '@/components/ui/Text';
import { useMyPayouts } from '../queries';
import { formatDay } from '../format';
import { AjoMoney } from './AjoMoney';
import { AjoStatusBadge } from './AjoStatusBadge';

const STATUS_WORDS: Record<string, string> = { PREPARED: 'Being prepared', APPROVED: 'Approved, waiting to be paid', PAID: 'Paid', VOID: 'Cancelled', REVERSED: 'Reversed' };

/** What this person has been, or is about to be, paid: the amount after any collector fee, where it goes (masked), and when. Shown only when there is one. */
export function MyPayoutsCard() {
  const payouts = useMyPayouts();
  if (!payouts.data || payouts.data.length === 0) return null;
  return (
    <SectionCard title="My payouts">
      {payouts.data.map((p) => (
        <View key={p.id} className="gap-1 px-4 py-3" testID={`ajo-my-payout-${p.id}`}>
          <View className="flex-row items-center justify-between gap-2">
            <Text variant="body-strong">
              <AjoMoney kobo={p.netKobo} />
              {p.round ? ` · round ${p.round}` : ''}
            </Text>
            <AjoStatusBadge status={p.status} label={STATUS_WORDS[p.status] ?? p.status} />
          </View>
          <Text variant="caption" tone="tertiary">
            To {p.account.bankName ?? 'your account'} {p.account.masked}
            {p.paidAt ? ` · paid ${formatDay(p.paidAt)}` : ''}
            {p.paidReference ? ` · reference ${p.paidReference}` : ''}
          </Text>
        </View>
      ))}
    </SectionCard>
  );
}
