import { Pressable, TextInput, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/cn';
import { useThemeTokens } from '@/providers/ThemeProvider';

export type PayableAmountRowProps = {
  label: string;
  hint: string;
  value: string;
  onChange: (text: string) => void;
  /** An amount worth offering as a one-tap fill, e.g. the full balance. */
  suggested?: number | null;
  /** The reason this row's amount is not acceptable, if it isn't. */
  error?: string;
  testID?: string;
};

/** Keeps digits and at most one decimal point with two places — what an officer can type for naira and kobo. */
function sanitize(text: string): string {
  const cleaned = text.replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  return `${cleaned.slice(0, firstDot + 1)}${cleaned.slice(firstDot + 1).replace(/\./g, '').slice(0, 2)}`;
}

function withCommas(raw: string): string {
  if (!raw) return '';
  const [int = '', decimals] = raw.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decimals !== undefined ? `${grouped}.${decimals}` : grouped;
}

/** One thing a member could pay: what it is, what is owed or held, an amount box, and a quick "Fill" for the suggested amount. */
export function PayableAmountRow({ label, hint, value, onChange, suggested, error, testID }: PayableAmountRowProps) {
  const { color } = useThemeTokens();
  const showFill = suggested !== null && suggested !== undefined && suggested > 0 && value === '';

  return (
    <View className="gap-2 px-4 py-3" testID={testID}>
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 gap-0.5">
          <Text variant="body-strong" numberOfLines={2}>
            {label}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {hint}
          </Text>
        </View>
        <View className={cn('h-[44px] w-[132px] flex-row items-center justify-end rounded-md border bg-surface-sunken px-3', error ? 'border-danger' : 'border-border-strong')}>
          <Text variant="body-strong" tone="secondary">
            ₦
          </Text>
          <TextInput
            value={withCommas(value)}
            onChangeText={(text) => onChange(sanitize(text.replace(/,/g, '')))}
            placeholder="0"
            placeholderTextColor={color.textTertiary}
            keyboardType="decimal-pad"
            accessibilityLabel={`Amount for ${label}`}
            className="font-semibold text-body-lg text-text text-right"
            style={{ minWidth: 64 }}
            testID={testID ? `${testID}-input` : undefined}
          />
        </View>
      </View>
      {showFill ? (
        <Pressable
          onPress={() => onChange(String(suggested))}
          accessibilityRole="button"
          accessibilityLabel={`Fill ${suggested}`}
          className="self-start rounded-full bg-primary-soft px-3 py-1.5"
          testID={testID ? `${testID}-fill` : undefined}
        >
          <Text variant="caption" tone="primary">
            {`Fill ₦${(suggested as number).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`}
          </Text>
        </Pressable>
      ) : null}
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
