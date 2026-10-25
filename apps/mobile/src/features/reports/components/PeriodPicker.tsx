import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Check, ChevronDown } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Pressable, View } from 'react-native';

import { DateField } from '@/components/forms/DateField';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { formatDate } from '@/lib/dates';
import { useThemeTokens } from '@/providers/ThemeProvider';
import { customRange, PERIOD_OPTIONS, type PeriodState } from '../labels';

type RangeForm = { start: string; end: string };

/**
 * Which time a report is about, chosen from a dropdown that opens a sheet with every option (this month … last year, or two dates).
 * A range is only used once both dates are picked and "Show" is tapped, so a half-chosen range never asks the server a question.
 */
export function PeriodPicker({ value, onChange, options = PERIOD_OPTIONS }: { value: PeriodState; onChange: (next: PeriodState) => void; options?: typeof PERIOD_OPTIONS }) {
  const { color } = useThemeTokens();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [choosing, setChoosing] = useState(value.period === 'custom' && !value.startDate);
  const { control, handleSubmit, setError } = useForm<RangeForm>({
    defaultValues: { start: value.startDate ?? '', end: value.endDate ?? '' },
  });
  const form = useWatch({ control });
  const picked = !!form.start && !!form.end;

  const apply = (v: RangeForm) => {
    const start = new Date(v.start);
    const end = new Date(v.end);
    if (end.getTime() < start.getTime()) {
      setError('end', { message: 'The end date can’t be before the start date' });
      return;
    }
    onChange({ period: 'custom', ...customRange(start, end) });
    setChoosing(false);
  };

  const current = options.find((o) => o.value === value.period);
  const shown =
    value.period === 'custom' && value.startDate && value.endDate
      ? `${formatDate(value.startDate, 'long')} to ${formatDate(value.endDate, 'long')}`
      : (current?.label ?? 'Choose a period');

  return (
    <View className="gap-3">
      <View className="gap-1.5">
        <Text variant="label">Period</Text>
        <Pressable
          onPress={() => sheetRef.current?.present()}
          accessibilityRole="button"
          accessibilityLabel={`Period: ${shown}`}
          className="h-[52px] flex-row items-center justify-between rounded-md border border-border-strong bg-surface-sunken px-4"
          testID="period-field"
        >
          <Text variant="body" numberOfLines={1} className="flex-1">
            {shown}
          </Text>
          <ChevronDown size={20} color={color.textSecondary} strokeWidth={1.75} />
        </Pressable>
      </View>

      <BottomSheet ref={sheetRef} title="Choose a period" snapPoints={['60%']}>
        <View className="pb-6">
          {options.map((o) => {
            const active = value.period === o.value;
            return (
              <Pressable
                key={o.value}
                onPress={() => {
                  sheetRef.current?.dismiss();
                  if (o.value === 'custom') {
                    setChoosing(true);
                    if (value.period !== 'custom') onChange({ period: 'custom' });
                  } else {
                    setChoosing(false);
                    onChange({ period: o.value });
                  }
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                className="h-12 flex-row items-center justify-between px-1"
                testID={`period-${o.value}`}
              >
                <Text variant="body-lg" tone={active ? 'primary' : 'default'}>
                  {o.label}
                </Text>
                {active ? <Check size={18} color={color.primary} strokeWidth={2.25} /> : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>

      {value.period === 'custom' && choosing ? (
        <View className="gap-3 rounded-lg border border-border bg-surface p-4 dark:border-transparent" testID="period-custom">
          <DateField control={control} name="start" label="From" testID="period-from" />
          <DateField control={control} name="end" label="To" testID="period-to" />
          {picked ? null : (
            <Text variant="caption" tone="secondary">
              Pick both dates to see the report.
            </Text>
          )}
          <Button variant="primary" fullWidth disabled={!picked} onPress={() => void handleSubmit(apply)()} testID="period-apply">
            Show
          </Button>
        </View>
      ) : null}
    </View>
  );
}
