import { View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { useModulesStore } from '@/stores/modules';
import { ModuleLocked } from './ModuleLocked';

export type ModuleLockedScreenProps = {
  /** Screen title in the header, e.g. "Meetings". */
  title: string;
  /** Module name used in the message, e.g. "Meetings". */
  moduleName: string;
  onBack: () => void;
};

/**
 * Whole-screen `ModuleLocked` with a back button — rendered when the API has answered `MODULE_DISABLED`
 * for the screen's module. "Check again" forgets the session's disabled-module answers so the queries re-run
 * (e.g. right after an admin upgraded the plan); it is not a purchase action (ui-rules.md rule #16).
 */
export function ModuleLockedScreen({ title, moduleName, onBack }: ModuleLockedScreenProps) {
  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader title={title} onBack={onBack} />
      <ModuleLocked moduleName={moduleName} />
      <View className="items-center">
        <Button variant="secondary" onPress={() => useModulesStore.getState().reset()}>
          Check again
        </Button>
      </View>
    </Screen>
  );
}
