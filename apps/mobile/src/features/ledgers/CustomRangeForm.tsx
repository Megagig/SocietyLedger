import { useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';

import { DateField } from '@/components/forms/DateField';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { customRangeProblem, toDay } from './labels';

type Values = { from: string; to: string };

/** Pick any two dates and share the statement for exactly that period. */
export function CustomRangeForm({ loading, onShare }: { loading: boolean; onShare: (startDate: string, endDate: string) => void }) {
  const { control } = useForm<Values>({ defaultValues: { from: '', to: new Date().toISOString() } });
  const from = useWatch({ control, name: 'from' });
  const to = useWatch({ control, name: 'to' });
  // Stay quiet until both dates are chosen; after that say what is wrong.
  const problem = from && to ? customRangeProblem(from, to) : null;

  return (
    <View className="gap-3">
      <Text variant="label" tone="secondary">
        Or choose your own dates
      </Text>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <DateField control={control} name="from" label="From" maximumDate={new Date()} placeholder="Start date" testID="statement-from" />
        </View>
        <View className="flex-1">
          <DateField control={control} name="to" label="To" maximumDate={new Date()} placeholder="End date" testID="statement-to" />
        </View>
      </View>
      {problem ? (
        <Text variant="caption" tone="danger">
          {problem}
        </Text>
      ) : null}
      <Button
        variant="primary"
        loading={loading}
        disabled={!from || !to || problem !== null}
        onPress={() => onShare(toDay(from), toDay(to))}
        testID="statement-share-custom"
      >
        Share this period
      </Button>
    </View>
  );
}
