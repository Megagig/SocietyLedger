import { forwardRef, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';

export type ConfirmSheetProps = {
  /** States the action, e.g. "Delete this transaction?" */
  title: string;
  /** States the consequence in one sentence. */
  description: string;
  /** Repeats the verb, e.g. "Delete transaction". */
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onDismiss?: () => void;
};

/**
 * ui-rules.md §5.10 — secondary "Keep it" + danger button with the same verb as the title.
 * Biometric re-auth (architecture.md §7.5) runs after confirm, at the call site — not here.
 */
export const ConfirmSheet = forwardRef<BottomSheetModal, ConfirmSheetProps>(function ConfirmSheet(
  { title, description, confirmLabel, cancelLabel = 'Keep it', destructive = true, onConfirm, onDismiss },
  ref,
) {
  const localRef = useRef<BottomSheetModal>(null);
  useImperativeHandle(ref, () => localRef.current as BottomSheetModal, []);

  return (
    <BottomSheet ref={localRef} title={title} onDismiss={onDismiss} snapPoints={['40%']}>
      <View className="gap-4 pb-6">
        <Text variant="body" tone="secondary">
          {description}
        </Text>
        <View className="flex-row gap-3">
          <Button variant="secondary" fullWidth onPress={() => localRef.current?.dismiss()}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? 'danger' : 'primary'} fullWidth onPress={onConfirm}>
            {confirmLabel}
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
});
