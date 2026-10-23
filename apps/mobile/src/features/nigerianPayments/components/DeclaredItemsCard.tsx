import { View } from 'react-native';

import { ListGroup } from '@/components/layout/ListItem';
import { Divider } from '@/components/ui/Divider';
import { Money } from '@/components/ui/Money';
import { Text } from '@/components/ui/Text';
import { formatDate } from '@/lib/dates';
import { toDecimal } from '@/lib/money';
import type { DeclaredItemDTO } from '@/types/api/paymentProofsManage';

/** Why a declared charge will record nothing, or null when it will record its balance. */
export function itemNote(item: DeclaredItemDTO): string | null {
  if (item.isVoided) return 'Voided';
  if (item.status === 'waived') return 'Waived';
  if (toDecimal(item.balance).lte(0)) return 'Already settled';
  return null;
}

function ItemRow({ item }: { item: DeclaredItemDTO }) {
  const note = itemNote(item);
  const dueText = item.dueDate ? `Due ${formatDate(item.dueDate, 'long')}` : null;
  const meta = [item.referenceNumber, dueText].filter(Boolean).join(' · ');
  const partlyPaid = toDecimal(item.paid).gt(0) && !note;

  return (
    <View className="min-h-[56px] flex-row items-center justify-between gap-3 px-4 py-3" testID={`declared-item-${item.id}`}>
      <View className="flex-1">
        <Text variant="body-lg" numberOfLines={1}>
          {item.category.name}
        </Text>
        {meta ? (
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
        {partlyPaid ? (
          <Text variant="caption" tone="secondary">
            {`Charged ${toDecimal(item.amount).toFixed(2)}, paid ${toDecimal(item.paid).toFixed(2)} so far`}
          </Text>
        ) : null}
      </View>
      <View className="items-end">
        {note ? (
          <Text variant="label" tone="secondary">
            {note}
          </Text>
        ) : (
          <Money value={item.balance} size="body-strong" />
        )}
      </View>
    </View>
  );
}

export type DeclaredItemsCardProps = {
  items: DeclaredItemDTO[];
  /** What approving records in total. */
  total: string | number;
};

/**
 * "Charges to match" — what the member says this proof pays, each at the balance verifying would record, and the total to compare
 * with the bank statement. Charges that are voided, waived or already settled show why they count for nothing.
 */
export function DeclaredItemsCard({ items, total }: DeclaredItemsCardProps) {
  return (
    <ListGroup>
      {items.map((item) => (
        <ItemRow key={item.id} item={item} />
      ))}
      <View>
        <Divider />
        <View className="flex-row items-center justify-between px-4 py-3">
          <Text variant="body-strong">Verifying records</Text>
          <Money value={total} size="body-strong" />
        </View>
      </View>
    </ListGroup>
  );
}
