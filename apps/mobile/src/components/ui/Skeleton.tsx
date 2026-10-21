import { useEffect } from 'react';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';

import { cn } from '@/lib/cn';

export type SkeletonRadius = 'xs' | 'sm' | 'md' | 'lg' | 'full';

export type SkeletonProps = {
  /** Numeric dp — skeleton shapes mirror arbitrary real content, so a fixed token scale doesn't fit (code-standards.md §5's dynamic-numeric-value exception). */
  width: number | `${number}%`;
  height: number;
  radius?: SkeletonRadius;
  className?: string;
};

const RADIUS_CLASSES: Record<SkeletonRadius, string> = {
  xs: 'rounded-xs',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
};

// ui-rules.md §5.11 — shimmer via opacity pulse; off entirely when reduce-motion is on
// (ui-rules.md §6), rendered as a static mid-opacity block instead of animating.
export function Skeleton({ width, height, radius = 'sm', className }: SkeletonProps) {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(reducedMotion ? 0.7 : 0.4);

  useEffect(() => {
    if (reducedMotion) return;
    opacity.value = withRepeat(withTiming(1, { duration: 320, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [reducedMotion, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[{ width, height }, animatedStyle]}
      className={cn('bg-surface-sunken', RADIUS_CLASSES[radius], className)}
    />
  );
}
