import { View } from 'react-native';

import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';

/** The one primary action of a settings form, in the sticky footer. It stays off until something has changed. */
export function SaveFooter({ loading, disabled, onPress, testID }: { loading: boolean; disabled: boolean; onPress: () => void; testID?: string }) {
  return (
    <StickyFooter>
      <View className="flex-1">
        <Button variant="primary" fullWidth loading={loading} disabled={disabled} onPress={onPress} testID={testID ?? 'settings-save'}>
          Save changes
        </Button>
      </View>
    </StickyFooter>
  );
}
