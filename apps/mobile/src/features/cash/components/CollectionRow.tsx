import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { Divider } from '@/components/ui/Divider';
import { Money } from '@/components/ui/Money';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/dates';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { CashCollectionDTO } from '@/types/api/cash';
import { COLLECTION_STATUS_LABELS } from '../labels';

export type CollectionRowProps = {
  collection: CashCollectionDTO;
  /** Where the row sits in the list, so separately rendered rows read as one grouped surface (ui-rules.md §5.3). */
  position: 'first' | 'middle' | 'last' | 'only';
  /** Show who collected it — officers who can see everyone's cash need it; a collector looking at their own does not. */
  showCollector?: boolean;
  onPress: (collection: CashCollectionDTO) => void;
};

/** One collection: its name, who took the cash and when, the amount over its status. */
function CollectionRowBase({ collection, position, showCollector = false, onPress }: CollectionRowProps) {
  const { color } = useThemeTokens();
  const isFirst = position === 'first' || position === 'only';
  const isLast = position === 'last' || position === 'only';
  const statusLabel = COLLECTION_STATUS_LABELS[collection.status];
  const receipts = collection.receiptCount === 1 ? '1 receipt' : `${collection.receiptCount} receipts`;

  return (
    <View className={cn('overflow-hidden border-x border-border bg-surface dark:border-transparent', isFirst && 'rounded-t-md border-t', isLast && 'rounded-b-md border-b')}>
      {isFirst ? null : <Divider />}
      <Pressable
        onPress={() => onPress(collection)}
        accessibilityRole="button"
        accessibilityLabel={`${collection.title}, ${receipts}, ${statusLabel}`}
        android_ripple={{ color: `${color.primary}1F` }}
        className="min-h-[72px] flex-row items-center px-4 py-3"
        testID={`collection-row-${collection.id}`}
      >
        <View className="flex-1 gap-0.5">
          <Text variant="body-lg" numberOfLines={1}>
            {collection.title}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {`${formatDate(collection.openedAt, 'long')} · ${receipts}`}
          </Text>
          {showCollector ? (
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {`Collected by ${collection.collectedBy.name}`}
            </Text>
          ) : null}
        </View>
        <View className="ml-3 items-end gap-1.5">
          <Money value={collection.collected} size="body-strong" />
          <StatusChip status={collection.status.toLowerCase()} label={statusLabel} />
        </View>
        <ChevronRight size={20} color={color.textTertiary} strokeWidth={1.75} style={{ marginLeft: 8 }} />
      </Pressable>
    </View>
  );
}

export const CollectionRow = memo(CollectionRowBase);
