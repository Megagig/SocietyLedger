import { useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';

import { DateField } from '@/components/forms/DateField';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';

type Values = { from: string; to: string };

/** The calendar day of an ISO instant as YYYY-MM-DD (what the API's date filters take), in the phone's own time. */
export const isoDay = (iso: string): string => {
  const d = new Date(iso);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
};

/**
 * From / To dates with an Apply button. Nothing is fetched until Apply, so picking a date never fires a request. A start after the end is
 * refused in words. `from` may be empty (from the beginning).
 */
export function RangeFilter({ from, to, onApply }: { from: string; to: string; onApply: (range: { from: string; to: string }) => void }) {
  const { control, handleSubmit } = useForm<Values>({ defaultValues: { from, to } });
  const [start, end] = useWatch({ control, name: ['from', 'to'] });
  const invalid = !!start && !!end && isoDay(start) > isoDay(end);

  return (
    <View className="gap-3">
      <View className="flex-row gap-3">
        <View className="flex-1">
          <DateField control={control} name="from" label="From" placeholder="Start date" maximumDate={end ? new Date(end) : undefined} />
        </View>
        <View className="flex-1">
          <DateField control={control} name="to" label="To" placeholder="End date" minimumDate={start ? new Date(start) : undefined} />
        </View>
      </View>
      {invalid ? (
        <Text variant="caption" tone="danger">
          The start date must be on or before the end date.
        </Text>
      ) : null}
      <View className="flex-row">
        <Button variant="primary" size="sm" disabled={invalid} onPress={() => void handleSubmit((v) => onApply({ from: v.from ? isoDay(v.from) : '', to: v.to ? isoDay(v.to) : '' }))()} testID="range-apply">
          Apply
        </Button>
      </View>
    </View>
  );
}
