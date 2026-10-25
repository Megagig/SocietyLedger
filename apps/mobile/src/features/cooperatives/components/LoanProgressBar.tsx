import { View } from 'react-native';

import { toDecimal } from '@/lib/money';

/** Repaid share of a loan's total repayment, 0–100. */
export function repaidPercent(totalPaid: string | number, totalRepayment: string | number): number {
  const total = toDecimal(totalRepayment);
  if (total.lessThanOrEqualTo(0)) return 0;
  return Math.max(0, Math.min(100, toDecimal(totalPaid).div(total).times(100).toNumber()));
}

/** Thin progress track — the fill width is the one genuinely dynamic value, so it is the only inline style. */
export function LoanProgressBar({ percent }: { percent: number }) {
  return (
    <View
      className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken"
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(percent) }}
    >
      <View className="h-2 rounded-full bg-primary" style={{ width: `${percent}%` }} />
    </View>
  );
}
