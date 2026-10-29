import { useRef } from 'react';
import { View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';

import { ajoApi } from '@/api/endpoints/ajo';
import { Button } from '@/components/ui/Button';
import { useAjoAction } from '../mutations';
import { AjoActionSheet } from './AjoActionSheet';

/** Leaving a circle. What was paid stays on the record; this only stops the person taking part. */
export function LeaveCircle({ membershipId, groupName, onLeft }: { membershipId: number; groupName: string; onLeft: () => void }) {
  const sheet = useRef<BottomSheetModal>(null);
  const leave = useAjoAction((reason: string) => ajoApi.leave(membershipId, reason));
  return (
    <View className="pt-2">
      <Button variant="ghost" onPress={() => sheet.current?.present()} testID="ajo-leave">
        Leave this circle
      </Button>
      <AjoActionSheet
        ref={sheet}
        title={`Leave ${groupName}?`}
        summary="You stop taking part. Everything you have already paid stays on the record, and anything the circle owes you or you owe it is settled by the officers, not lost."
        confirmLabel="Leave the circle"
        destructive
        reasonMin={5}
        reasonLabel="Why are you leaving? (the officers see this)"
        onConfirm={({ reason }) => leave.mutateAsync(reason)}
        successMessage="You have left the circle."
        onDone={onLeft}
        testID="ajo-leave-sheet"
      />
    </View>
  );
}
