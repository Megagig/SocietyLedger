import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { ScrollView, View } from 'react-native';

import { DateField } from '@/components/forms/DateField';
import { Button } from '@/components/ui/Button';
import { FilterChip } from '@/components/ui/FilterChip';
import { Text } from '@/components/ui/Text';
import { formatDate } from '@/lib/dates';
import { customRange, PERIOD_OPTIONS, type PeriodState } from '../labels';

type RangeForm = { start: string; end: string };

/**
 * Which time a report is about: a named period, or a range of two dates. A range is only used once both dates are picked and
 * "Show" is tapped, so a half-chosen range never asks the server a question.
 */
export function PeriodPicker({ value, onChange, options = PERIOD_OPTIONS }: { value: PeriodState; onChange: (next: PeriodState) => void; options?: typeof PERIOD_OPTIONS }) {
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

  return (
    <View className="gap-3">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {options.map((o) => (
          <FilterChip
            key={o.value}
            label={o.value === 'custom' && value.period === 'custom' && value.startDate && value.endDate ? `${formatDate(value.startDate, 'long')} to ${formatDate(value.endDate, 'long')}` : o.label}
            active={value.period === o.value}
            onPress={() => {
              if (o.value === 'custom') {
                setChoosing(true);
                if (value.period !== 'custom') onChange({ period: 'custom' });
              } else {
                setChoosing(false);
                onChange({ period: o.value });
              }
            }}
          />
        ))}
      </ScrollView>

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
