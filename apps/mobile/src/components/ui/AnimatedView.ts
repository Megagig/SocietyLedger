import type { ComponentType } from 'react';
import type { ViewProps } from 'react-native';
import Animated from 'react-native-reanimated';

/**
 * Reanimated's `Animated.View` with the `className` prop NativeWind adds at runtime. The installed Reanimated typings do not know about it,
 * so using `Animated.View` directly with `className` fails type-checking even though it works; this is the same component, typed correctly.
 */
export const AnimatedView = Animated.View as unknown as ComponentType<Omit<ViewProps, 'style'> & { className?: string; style?: unknown }>;
