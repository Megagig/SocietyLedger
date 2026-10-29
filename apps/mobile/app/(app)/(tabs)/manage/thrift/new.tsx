import { useRouter } from 'expo-router';
import { ShieldAlert } from 'lucide-react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { useAjoWrite } from '@/features/ajo/components/AjoGate';
import { GroupWizard } from '@/features/ajo/components/GroupWizard';
import { AjoScreen } from '@/features/ajo/components/AjoScreen';
import { useAjoCan } from '@/features/ajo/useAjoCan';

/** THO2: create a circle. The wizard itself is shared with thrift onboarding. */
export default function NewCircleScreen() {
  const router = useRouter();
  const { canWrite } = useAjoWrite();
  const { manage } = useAjoCan();

  return (
    <AjoScreen title="New circle" access={['AJO_MANAGE']} keyboard>
      {!manage || !canWrite ? (
        <EmptyState
          icon={ShieldAlert}
          title="You cannot create circles."
          description={!canWrite ? 'The Ajo add-on has expired, so nothing can be added until it is renewed.' : 'Ask an admin to give you permission to manage Ajo.'}
          actionLabel="Back to circles"
          onAction={() => router.replace('/(app)/(tabs)/manage/thrift' as never)}
        />
      ) : (
        <GroupWizard onCreated={(group) => router.replace(`/(app)/(tabs)/manage/thrift/${group.id}` as never)} />
      )}
    </AjoScreen>
  );
}
