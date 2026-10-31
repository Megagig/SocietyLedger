import { Money, type MoneyProps } from '@/components/ui/Money';
import { Text } from '@/components/ui/Text';
import { formatKobo, koboNegative, koboToNaira } from '../format';

export type AjoMoneyProps = {
  /** Kobo as the API sends it (a string, so nothing is lost). */
  kobo: string | null | undefined;
  size?: MoneyProps['size'];
  tone?: MoneyProps['tone'];
  testID?: string;
};

/** An Ajo amount, always in full (₦10,000.00). A negative amount (a cash difference that is short) keeps its minus sign instead of the shared "Credit" wording. */
export function AjoMoney({ kobo, size = 'body-strong', tone = 'default', testID }: AjoMoneyProps) {
  if (koboNegative(kobo)) {
    return (
      <Text variant={size} tone={tone === 'default' ? 'danger' : tone} testID={testID} style={{ fontVariant: ['tabular-nums'] }}>
        {formatKobo(kobo)}
      </Text>
    );
  }
  return <Money value={koboToNaira(kobo)} size={size} tone={tone} testID={testID} />;
}
