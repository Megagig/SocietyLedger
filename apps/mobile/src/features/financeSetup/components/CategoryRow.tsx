import { memo } from 'react';
import { View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Money } from '@/components/ui/Money';
import { Text } from '@/components/ui/Text';
import type { CategoryDTO } from '@/types/api/financeSetup';
import { CATEGORY_KIND_SINGULAR, categoryUsageLabel, frequencyLabel } from '../labels';
import { GroupedRow, type RowPosition } from './GroupedRow';

export type CategoryRowProps = {
  category: CategoryDTO;
  position: RowPosition;
  onPress?: (category: CategoryDTO) => void;
};

/** One category: its name and kind, the default amount and how often, and how many charges use it. A switched-off one is dimmed and says so. */
function CategoryRowBase({ category, position, onPress }: CategoryRowProps) {
  const frequency = frequencyLabel(category.frequency);
  return (
    <GroupedRow
      position={position}
      onPress={onPress ? () => onPress(category) : undefined}
      accessibilityLabel={`${category.name}, ${CATEGORY_KIND_SINGULAR[category.type]}${category.isActive ? '' : ', inactive'}`}
      testID={`category-row-${category.id}`}
    >
      <View className={category.isActive ? undefined : 'opacity-60'}>
        <View className="flex-row items-center gap-2">
          <Text variant="body-lg" numberOfLines={1} className="flex-shrink">
            {category.name}
          </Text>
          <Badge tone="primary">{CATEGORY_KIND_SINGULAR[category.type]}</Badge>
          {category.isActive ? null : <Badge tone="neutral">Inactive</Badge>}
        </View>
        <View className="mt-0.5 flex-row items-center gap-1">
          {category.amount !== null ? <Money value={category.amount} size="caption" tone="secondary" /> : <Text variant="caption" tone="secondary">No default amount</Text>}
          {frequency ? (
            <Text variant="caption" tone="secondary">
              {` · ${frequency}`}
            </Text>
          ) : null}
        </View>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {categoryUsageLabel(category.usageCount)}
        </Text>
      </View>
    </GroupedRow>
  );
}

export const CategoryRow = memo(CategoryRowBase);
