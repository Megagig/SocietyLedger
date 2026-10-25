import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { ringDash } from '@/lib/ring';
import { useThemeTokens } from '@/providers/ThemeProvider';
import { Text } from './Text';

export type ProgressRingProps = {
  /** 0–100; values outside are clamped. */
  percent: number;
  /** Outer diameter in dp. */
  size?: number;
  strokeWidth?: number;
  /** Small caption under the percentage, e.g. "attended". */
  caption?: string;
  testID?: string;
};

/** ui-registry.md — circular progress ring with the percentage centred (My Attendance rate). Track = border token, arc = primary token. */
export function ProgressRing({ percent, size = 132, strokeWidth = 12, caption, testID }: ProgressRingProps) {
  const { color } = useThemeTokens();
  const radius = (size - strokeWidth) / 2;
  const { circumference, offset, percent: shown } = ringDash(percent, radius);
  const center = size / 2;

  return (
    <View
      testID={testID}
      style={{ width: size, height: size }}
      className="items-center justify-center"
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(shown) }}
    >
      <Svg width={size} height={size}>
        <Circle cx={center} cy={center} r={radius} stroke={color.border} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={color.primary}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <View className="absolute items-center">
        <Text variant="h1">{`${Math.round(shown)}%`}</Text>
        {caption ? (
          <Text variant="caption" tone="secondary">
            {caption}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
