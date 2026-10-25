import { Pressable, View } from 'react-native';
import { useController, type FieldValues } from 'react-hook-form';

import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';
import { FieldShell, type RHFControlProps } from './FieldShell';
import { FieldInput } from './FieldInput';

export type AmountFieldProps<TFieldValues extends FieldValues = FieldValues> = RHFControlProps<TFieldValues> & {
  label?: string;
  helper?: string;
  /** Rendered as separate chips, not a dotted string (ui-rules.md §5.6). */
  presets?: number[];
  testID?: string;
};

function formatDigits(raw: string): string {
  if (!raw) return '';
  const [intPart, decimalPart] = raw.split('.');
  const withCommas = (intPart ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decimalPart !== undefined ? `${withCommas}.${decimalPart}` : withCommas;
}

/** Keeps digits and at most one decimal point — what a decimal-pad keyboard can actually produce. */
function sanitize(text: string): string {
  const cleaned = text.replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
}

/** ui-rules.md §5.6 — large (h2) right-aligned ₦ value with live thousands separators + preset chips. Form state holds a plain string (code-standards.md §8/§11) — convert with `toDecimal` at submit, never here. */
export function AmountField<TFieldValues extends FieldValues = FieldValues>({
  control,
  name,
  label,
  helper,
  presets,
  testID,
}: AmountFieldProps<TFieldValues>) {
  const { field, fieldState } = useController({ control, name });
  const { color } = useThemeTokens();
  const raw = (field.value as string | undefined) ?? '';
  const hasError = !!fieldState.error;

  return (
    <FieldShell label={label} helper={helper} error={fieldState.error?.message}>
      <View
        className={[
          'h-[52px] flex-row items-center justify-end rounded-md border bg-surface-sunken px-4',
          hasError ? 'border-danger' : 'border-border-strong',
        ].join(' ')}
      >
        <Text variant="h2">₦</Text>
        <FieldInput
          testID={testID}
          value={formatDigits(raw)}
          onChangeText={(text) => field.onChange(sanitize(text.replace(/,/g, '')))}
          onBlur={field.onBlur}
          placeholder="0"
          placeholderTextColor={color.textTertiary}
          keyboardType="decimal-pad"
          className="font-bold text-h2 text-text text-right"
          style={{ minWidth: 40 }}
        />
      </View>
      {presets && presets.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {presets.map((preset) => (
            <Pressable key={preset} onPress={() => field.onChange(String(preset))} className="rounded-sm bg-surface-sunken px-3 py-1.5">
              <Text variant="label">₦{preset.toLocaleString('en-NG')}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </FieldShell>
  );
}
