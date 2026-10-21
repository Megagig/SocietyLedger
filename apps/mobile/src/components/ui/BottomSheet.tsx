import { forwardRef, useCallback, useImperativeHandle, useRef, type ReactNode } from 'react';
import { View } from 'react-native';
import { BottomSheetBackdrop, BottomSheetModal, type BottomSheetBackdropProps, type BottomSheetModalProps } from '@gorhom/bottom-sheet';
import { X } from 'lucide-react-native';

import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';

export type BottomSheetProps = {
  title?: string;
  snapPoints?: BottomSheetModalProps['snapPoints'];
  onDismiss?: () => void;
  children: ReactNode;
};

/**
 * ui-rules.md §5.10 — top radius xl, grabber 36×4 border-strong, backdrop overlay/45, title h2
 * left-aligned + close IconButton. Requires `BottomSheetModalProvider` mounted once at the app
 * root (`app/_layout.tsx`). Default snap points `['50%','90%']` + dynamic sizing for short
 * content (library-docs.md's `@gorhom/bottom-sheet` note). Never stack more than one sheet.
 */
export const BottomSheet = forwardRef<BottomSheetModal, BottomSheetProps>(function BottomSheet(
  { title, snapPoints = ['50%', '90%'], onDismiss, children },
  ref,
) {
  const { color } = useThemeTokens();
  // Review finding (F1.8 Phase 1 retro): the close button must call `.dismiss()` on the sheet
  // itself, not just fire the caller's `onDismiss` — that prop is gorhom's own "sheet was
  // dismissed" notification (fires automatically after swipe/backdrop/`.dismiss()`), not a
  // request to close. A local ref gives the X button something real to call, and callers keep
  // using the ref they already pass in — `useImperativeHandle` points it at the same instance.
  const localRef = useRef<BottomSheetModal>(null);
  useImperativeHandle(ref, () => localRef.current as BottomSheetModal, []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => <BottomSheetBackdrop {...props} opacity={0.45} appearsOnIndex={0} disappearsOnIndex={-1} />,
    [],
  );

  return (
    <BottomSheetModal
      ref={localRef}
      snapPoints={snapPoints}
      enableDynamicSizing
      onDismiss={onDismiss}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backgroundStyle={{ backgroundColor: color.surface }}
      handleIndicatorStyle={{ backgroundColor: color.borderStrong, width: 36, height: 4 }}
      backdropComponent={renderBackdrop}
      style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' }}
    >
      {title ? (
        <View className="flex-row items-center justify-between px-4 pb-2">
          <Text variant="h2">{title}</Text>
          <IconButton icon={X} accessibilityLabel="Close" onPress={() => localRef.current?.dismiss()} />
        </View>
      ) : null}
      <View className="flex-1 px-4">{children}</View>
    </BottomSheetModal>
  );
});
