import { useRef } from 'react';
import { ScrollView, View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { CalendarRange, X } from 'lucide-react-native';
import { useForm } from 'react-hook-form';

import { DateField } from '@/components/forms/DateField';
import { SearchField } from '@/components/forms/SearchField';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { FilterChip } from '@/components/ui/FilterChip';
import { formatDate } from '@/lib/dates';
import { useThemeTokens } from '@/providers/ThemeProvider';
import {
  hasActiveFilters,
  TYPE_FILTER_OPTIONS,
  DEFAULT_FILTERS,
  type NotificationFilters,
  type NotificationStatusFilter,
} from './filters';

type DateRangeForm = { startDate: string; endDate: string };

export type NotificationFilterBarProps = {
  filters: NotificationFilters;
  onChange: (next: NotificationFilters) => void;
};

/** Mirrors the web filter row: search, type, status, date range, and a Clear action. */
export function NotificationFilterBar({ filters, onChange }: NotificationFilterBarProps) {
  const { color } = useThemeTokens();
  const sheetRef = useRef<BottomSheetModal>(null);
  const { control, getValues, reset } = useForm<DateRangeForm>({
    defaultValues: { startDate: filters.startDate, endDate: filters.endDate },
  });

  const hasDates = filters.startDate !== '' || filters.endDate !== '';
  const dateLabel = hasDates
    ? `${filters.startDate ? formatDate(filters.startDate, 'short') : '…'} – ${filters.endDate ? formatDate(filters.endDate, 'short') : '…'}`
    : 'Dates';

  const openDates = () => {
    reset({ startDate: filters.startDate, endDate: filters.endDate });
    sheetRef.current?.present();
  };

  const applyDates = () => {
    const { startDate, endDate } = getValues();
    onChange({ ...filters, startDate: startDate ?? '', endDate: endDate ?? '' });
    sheetRef.current?.dismiss();
  };

  const clearDates = () => {
    reset({ startDate: '', endDate: '' });
    onChange({ ...filters, startDate: '', endDate: '' });
    sheetRef.current?.dismiss();
  };

  return (
    <View className="gap-3 px-4 pb-2">
      <SearchField
        value={filters.search}
        onChangeText={(search) => onChange({ ...filters, search })}
        placeholder="Search notifications…"
      />

      <SegmentedControl<NotificationStatusFilter>
        options={[
          { label: 'All', value: 'all' },
          { label: 'Unread', value: 'unread' },
          { label: 'Read', value: 'read' },
        ]}
        value={filters.status}
        onChange={(status) => onChange({ ...filters, status })}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {TYPE_FILTER_OPTIONS.map((option) => (
          <FilterChip key={option.value} label={option.label} active={filters.type === option.value} onPress={() => onChange({ ...filters, type: option.value })} />
        ))}
        <FilterChip label={dateLabel} active={hasDates} onPress={openDates}>
          <CalendarRange size={16} color={hasDates ? color.primary : color.textSecondary} strokeWidth={1.75} />
        </FilterChip>
        {hasActiveFilters(filters) ? (
          <FilterChip label="Clear" active={false} onPress={() => onChange(DEFAULT_FILTERS)}>
            <X size={16} color={color.textSecondary} strokeWidth={1.75} />
          </FilterChip>
        ) : null}
      </ScrollView>

      <BottomSheet ref={sheetRef} title="Date range" snapPoints={['55%']}>
        <View className="gap-4 pb-6">
          <DateField control={control} name="startDate" label="From" placeholder="Any date" maximumDate={new Date()} />
          <DateField control={control} name="endDate" label="To" placeholder="Any date" maximumDate={new Date()} />
          <View className="flex-row gap-3">
            <Button variant="secondary" fullWidth onPress={clearDates}>
              Clear dates
            </Button>
            <Button variant="primary" fullWidth onPress={applyDates}>
              Apply
            </Button>
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}
