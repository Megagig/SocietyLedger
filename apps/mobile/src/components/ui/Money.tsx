import type { Decimal } from 'decimal.js-light';

import { formatMoney } from '@/lib/money';
import { Text, type TextTone, type TextVariant } from '@/components/ui/Text';

const TABULAR_STYLE = { fontVariant: ['tabular-nums'] as const };

export type MoneyProps = {
  value: string | number | Decimal;
  size?: TextVariant;
  tone?: TextTone;
  creditLabel?: string;
  testID?: string;
};

/** ui-rules.md §5.16 — the only way to display a monetary amount. Formatting lives in `@/lib/money` (F1.6) — see that module for `formatMoney`/`toDecimal`/`sumMoney`. */
export function Money({ value, size = 'body-strong', tone = 'default', creditLabel, testID }: MoneyProps) {
  return (
    <Text variant={size} tone={tone} testID={testID} style={TABULAR_STYLE}>
      {formatMoney(value, { creditLabel })}
    </Text>
  );
}
