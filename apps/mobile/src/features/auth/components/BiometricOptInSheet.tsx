import { forwardRef, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Fingerprint } from 'lucide-react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { t } from '@/lib/i18n';
import { useThemeTokens } from '@/providers/ThemeProvider';

export type BiometricOptInSheetProps = {
  onEnable: () => void;
  onSkip: () => void;
};

/** architecture.md §7.5 — "Optional, prompted once after first login." The caller (`login.tsx`)
 * decides whether to present this at all (device support + `prefs.hasSeenBiometricPrompt`
 * check) — this component is just the prompt's content. */
export const BiometricOptInSheet = forwardRef<BottomSheetModal, BiometricOptInSheetProps>(function BiometricOptInSheet(
  { onEnable, onSkip },
  ref,
) {
  const localRef = useRef<BottomSheetModal>(null);
  useImperativeHandle(ref, () => localRef.current as BottomSheetModal, []);
  const { color } = useThemeTokens();

  return (
    <BottomSheet ref={localRef} title={t('auth.biometricPrompt.title')} onDismiss={onSkip} snapPoints={['45%']}>
      <View className="gap-4 pb-6">
        <View className="h-16 w-16 items-center justify-center self-center rounded-full bg-primary-soft">
          <Fingerprint size={32} color={color.primary} strokeWidth={1.5} />
        </View>
        <Text variant="body" tone="secondary" align="center">
          {t('auth.biometricPrompt.description')}
        </Text>
        <View className="gap-3">
          <Button fullWidth onPress={onEnable} testID="biometric-prompt-enable">
            {t('auth.biometricPrompt.enable')}
          </Button>
          <Button variant="ghost" fullWidth onPress={() => localRef.current?.dismiss()} testID="biometric-prompt-skip">
            {t('auth.biometricPrompt.skip')}
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
});
