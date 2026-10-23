import { useState } from 'react';
import { Modal, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { X } from 'lucide-react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/IconButton';
import { Spinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import { clampScale, clampTranslate, containedSize, nextDoubleTapScale, shouldDismiss } from '@/lib/imageZoom';

export type ImageViewerModalProps = {
  visible: boolean;
  /** A reachable image URL (for a private file, a short-lived signed link). */
  uri: string | null;
  /** Shown top-left, one line — usually the file name. */
  title?: string;
  onClose: () => void;
};

/**
 * ui-rules.md §5.15 — full-screen image viewer: pinch to zoom (1x–5x), double-tap to zoom in and out, drag to pan a zoomed image
 * (it can't be dragged off screen), swipe down to close when not zoomed. The zoom maths is in `lib/imageZoom.ts`.
 */
export function ImageViewerModal({ visible, uri, title, onClose }: ImageViewerModalProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const duration = reducedMotion ? 0 : 180;
  const fitted = containedSize(natural.width, natural.height, width, height);

  const reset = () => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedX.value = 0;
    savedY.value = 0;
  };

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = clampScale(savedScale.value * event.scale);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      // Zooming back out to 1x recentres; otherwise keep the image inside its new bounds.
      translateX.value = withTiming(clampTranslate(translateX.value, scale.value, fitted.width, width), { duration });
      translateY.value = withTiming(clampTranslate(translateY.value, scale.value, fitted.height, height), { duration });
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    });

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      if (scale.value > 1.01) {
        translateX.value = clampTranslate(savedX.value + event.translationX, scale.value, fitted.width, width);
        translateY.value = clampTranslate(savedY.value + event.translationY, scale.value, fitted.height, height);
      } else {
        // Not zoomed: a downward drag moves the image with the finger, ready to be dismissed.
        translateX.value = 0;
        translateY.value = Math.max(0, event.translationY);
      }
    })
    .onEnd((event) => {
      if (shouldDismiss(translateY.value, event.velocityY, scale.value)) {
        runOnJS(onClose)();
        return;
      }
      if (scale.value > 1.01) {
        savedX.value = translateX.value;
        savedY.value = translateY.value;
      } else {
        translateY.value = withTiming(0, { duration });
        savedY.value = 0;
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const next = nextDoubleTapScale(scale.value);
      scale.value = withTiming(next, { duration });
      savedScale.value = next;
      if (next === 1) {
        translateX.value = withTiming(0, { duration });
        translateY.value = withTiming(0, { duration });
        savedX.value = 0;
        savedY.value = 0;
      }
    });

  const gesture = Gesture.Simultaneous(pinch, pan, doubleTap);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: scale.value }],
  }));
  // The backdrop fades as the image is dragged down to close.
  const backdropStyle = useAnimatedStyle(() => ({ opacity: scale.value > 1.01 ? 1 : Math.max(0.35, 1 - translateY.value / 500) }));

  const handleShow = () => {
    reset();
    setState('loading');
    setNatural({ width: 0, height: 0 });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onShow={handleShow} onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View className="absolute inset-0 bg-overlay" style={backdropStyle} />

        {uri ? (
          <GestureDetector gesture={gesture}>
            <Animated.View className="flex-1 items-center justify-center" style={imageStyle} accessibilityLabel={title ? `${title}, image. Pinch to zoom.` : 'Image. Pinch to zoom.'}>
              <Image
                source={{ uri }}
                contentFit="contain"
                style={{ width, height }}
                onLoad={(event) => {
                  setNatural({ width: event.source.width, height: event.source.height });
                  setState('ready');
                }}
                onError={() => setState('error')}
              />
            </Animated.View>
          </GestureDetector>
        ) : null}

        {state === 'loading' && uri ? (
          <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
            <Spinner tone="inverse" size="lg" />
          </View>
        ) : null}
        {state === 'error' ? (
          <View pointerEvents="none" className="absolute inset-0 items-center justify-center px-8">
            <Text variant="body" tone="inverse" align="center">
              We couldn&apos;t load this image. Close it and try again.
            </Text>
          </View>
        ) : null}

        <View className="absolute left-0 right-0 flex-row items-center justify-between px-4" style={{ top: insets.top + 8 }} pointerEvents="box-none">
          <Text variant="body-strong" tone="inverse" numberOfLines={1} className="mr-3 flex-1">
            {title ?? ''}
          </Text>
          <IconButton icon={X} tone="inverse" variant="soft" accessibilityLabel="Close" onPress={onClose} testID="image-viewer-close" />
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
