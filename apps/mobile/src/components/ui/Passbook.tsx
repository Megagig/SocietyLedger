import { useEffect, useId, useRef } from 'react';
import { Pressable, View } from 'react-native';
import type { Decimal } from 'decimal.js-light';
import { Eye, EyeOff } from 'lucide-react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';
import { Text } from '@/components/ui/Text';
import { t } from '@/lib/i18n';
import { useThemeTokens } from '@/providers/ThemeProvider';
import { usePrefsStore } from '@/stores/prefs';

export type PassbookProps = {
  label: string;
  amount: string | number | Decimal;
  metaLine?: string;
  stampLabel: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
};

// Enough 28dp-spaced lines to cover any realistic card height — `overflow-hidden` on the
// container clips whatever doesn't fit, so there's no need to measure real content height.
const RULED_LINE_COUNT = 10;
const RULED_LINE_SPACING = 28;

// Decorative rising curve across the card's lower half, in the same 100×100 user space as the
// backdrop so both can share one <Svg>. Purely ornamental — never bound to real data, so it must
// not be read as a chart.
const SPARKLINE_STROKE = 'M0 88 C 14 85, 20 73, 32 71 S 52 77, 64 63 S 84 55, 100 49';
const SPARKLINE_FILL = `${SPARKLINE_STROKE} L 100 100 L 0 100 Z`;

/**
 * ui-rules.md §5.1 — "the app's signature": Home (member), Money overview, Savings account
 * detail, Loan detail — nowhere else. `label`/`amount`/`metaLine`/`stampLabel` are deliberately
 * generic (not finance-summary-shaped) so Savings/Loans can reuse this at F4.1/F4.2 without
 * changes; each caller computes its own stamp text ("PAID UP"/"{n} OVERDUE" here, "ACTIVE"/
 * "{n}/{m} REPAID" there).
 */
export function Passbook({ label, amount, metaLine, stampLabel, actionLabel, onAction, testID }: PassbookProps) {
  const { color } = useThemeTokens();
  const balanceHidden = usePrefsStore((state) => state.balanceHidden);
  const toggleBalanceHidden = usePrefsStore((state) => state.toggleBalanceHidden);
  const reducedMotion = useReducedMotion();
  const stampScale = useSharedValue(1);
  const previousStampLabel = useRef(stampLabel);
  // SVG gradient ids are global; two Passbooks on one screen would otherwise share definitions.
  const gradientId = `passbook-${useId()}`;

  useEffect(() => {
    if (previousStampLabel.current === stampLabel) return;
    previousStampLabel.current = stampLabel;
    if (reducedMotion) return;
    stampScale.value = 1.15;
    stampScale.value = withTiming(1, { duration: 320 });
  }, [stampLabel, reducedMotion, stampScale]);

  const stampAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: stampScale.value }, { rotate: '-8deg' }] }));

  return (
    <View testID={testID} className="overflow-hidden rounded-xl bg-passbook p-5">
      {/* Depth gradient + ornamental curve, behind the ruled lines */}
      <View className="absolute inset-0" pointerEvents="none">
        {/* One <Svg> in a stretched 100×100 user space. A nested <Svg> with percentage x/y is
         * not handled by react-native-svg and paints an opaque rect instead. */}
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id={`${gradientId}-bg`} x1="0" y1="0" x2="0.7" y2="1">
              <Stop offset="0" stopColor={color.primary} stopOpacity="0.38" />
              <Stop offset="0.6" stopColor={color.primary} stopOpacity="0" />
            </LinearGradient>
            <LinearGradient id={`${gradientId}-curve`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color.passbookStamp} stopOpacity="0.18" />
              <Stop offset="1" stopColor={color.passbookStamp} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill={`url(#${gradientId}-bg)`} />
          <Path d={SPARKLINE_FILL} fill={`url(#${gradientId}-curve)`} />
          <Path
            d={SPARKLINE_STROKE}
            stroke={color.passbookStamp}
            strokeOpacity="0.4"
            strokeWidth="1"
            fill="none"
            vectorEffect="non-scaling-stroke"
          />
        </Svg>
      </View>

      <View className="absolute inset-x-0 top-0 h-[2px] bg-passbook-stamp" />
      <View className="absolute inset-0" pointerEvents="none">
        {Array.from({ length: RULED_LINE_COUNT }, (_, index) => (
          <View key={index} className="absolute inset-x-0 h-px bg-on-passbook/[0.07]" style={{ top: RULED_LINE_SPACING * (index + 1) }} />
        ))}
      </View>

      <Animated.View
        style={stampAnimatedStyle}
        className="absolute right-5 top-5 rounded-sm border-2 border-passbook-stamp px-2 py-1"
      >
        <Text variant="micro" tone="onPassbook" className="uppercase tracking-wide">
          {stampLabel}
        </Text>
      </Animated.View>

      <View className="gap-1">
        <View className="flex-row items-center gap-2">
          <Text variant="label" tone="onPassbookMuted">
            {label}
          </Text>
          <Pressable
            onPress={toggleBalanceHidden}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={balanceHidden ? t('home.balance.showAmount') : t('home.balance.hideAmount')}
          >
            {balanceHidden ? (
              <EyeOff size={16} color={color.onPassbookMuted} strokeWidth={1.75} />
            ) : (
              <Eye size={16} color={color.onPassbookMuted} strokeWidth={1.75} />
            )}
          </Pressable>
        </View>
        {balanceHidden ? (
          <Text variant="display" tone="onPassbook">
            ₦ •••••
          </Text>
        ) : (
          <Money value={amount} size="display" tone="onPassbook" />
        )}
        {metaLine ? (
          <Text variant="body" tone="onPassbookMuted">
            {metaLine}
          </Text>
        ) : null}
      </View>

      {actionLabel && onAction ? (
        <View className="mt-4">
          <Button variant="onPassbook" onPress={onAction} fullWidth>
            {actionLabel}
          </Button>
        </View>
      ) : null}
    </View>
  );
}
