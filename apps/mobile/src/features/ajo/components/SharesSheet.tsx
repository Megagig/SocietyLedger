import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { toast } from 'sonner-native';

import { ajoApi } from '@/api/endpoints/ajo';
import { ApiError } from '@/api/errors';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import type { RosterPersonDTO } from '@/types/api/ajo';
import { useAjoAction } from '../mutations';

export type SharesSheetHandle = { open: (person: RosterPersonDTO) => void };

/** Change how many shares a person holds in a rotating pot, before the circle has started. */
export const SharesSheet = forwardRef<SharesSheetHandle, { maxShares: number }>(function SharesSheet({ maxShares }, ref) {
  const sheet = useRef<BottomSheetModal>(null);
  const [person, setPerson] = useState<RosterPersonDTO | null>(null);
  const [shares, setShares] = useState(1);
  const [problem, setProblem] = useState<string | null>(null);
  const save = useAjoAction((input: { membershipId: number; shares: number }) => ajoApi.setShares(input.membershipId, input.shares));
  useImperativeHandle(
    ref,
    () => ({
      open: (next) => {
        setPerson(next);
        setShares(next.shares);
        setProblem(null);
        sheet.current?.present();
      },
    }),
    [],
  );

  const submit = async () => {
    if (!person) return;
    try {
      await save.mutateAsync({ membershipId: person.membershipId, shares });
      toast.success('Shares updated.');
      sheet.current?.dismiss();
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'Could not change the shares.');
    }
  };

  return (
    <BottomSheet ref={sheet} title={`Shares for ${person?.name ?? ''}`} snapPoints={['45%']}>
      <View className="gap-4 pb-6">
        <View className="flex-row items-center justify-between gap-3">
          <Text variant="h2" testID="ajo-shares-value">
            {shares}
          </Text>
          <View className="flex-row gap-3">
            <Button variant="secondary" disabled={shares <= 1} onPress={() => setShares((s) => Math.max(1, s - 1))} accessibilityLabel="Fewer shares">
              −
            </Button>
            <Button variant="secondary" disabled={shares >= maxShares} onPress={() => setShares((s) => Math.min(maxShares, s + 1))} accessibilityLabel="More shares">
              +
            </Button>
          </View>
        </View>
        <Text variant="caption" tone="tertiary">
          A person may hold up to {maxShares} {maxShares === 1 ? 'share' : 'shares'}.
        </Text>
        {problem ? (
          <Text variant="body" tone="danger">
            {problem}
          </Text>
        ) : null}
        <View className="flex-row gap-3">
          <Button variant="secondary" fullWidth onPress={() => sheet.current?.dismiss()}>
            Cancel
          </Button>
          <Button fullWidth loading={save.isPending} onPress={() => void submit()} testID="ajo-shares-save">
            Save
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
});
