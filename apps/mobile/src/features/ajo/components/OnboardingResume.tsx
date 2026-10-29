import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { ajoApi } from '@/api/endpoints/ajo';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useTenantKey } from '@/hooks/useTenantKey';
import { useSessionStore } from '@/stores/session';
import { ajoKeys } from '../queries';
import { useAjoNav } from '../useAjoNav';

/**
 * For the admin of a standalone thrift group who has not finished setting up: where they got to, and a way back in. It can be put away
 * for this visit only. Everyone else (associations, officers, members) never sees it.
 */
export function OnboardingResume() {
  const router = useRouter();
  const tenant = useTenantKey();
  const nav = useAjoNav();
  const isAdmin = useSessionStore((s) => s.user?.role === 'admin' && !s.user?.platformRole);
  const [hidden, setHidden] = useState(false);
  const status = useQuery({ queryKey: [...ajoKeys.all(tenant), 'onboarding'], queryFn: () => ajoApi.onboardingStatus(), enabled: nav.thriftOnly && isAdmin, retry: false });
  const data = status.data;
  if (!nav.thriftOnly || !isAdmin || hidden || !data || data.flow !== 'THRIFT') return null;
  // "Skip for now" also marks setup as ended, so skipping is told apart from finishing: only a finished setup (completedAt) stops the reminder.
  const unfinished = !data.onboarding.onboardingComplete || (!!data.onboarding.skippedAt && !data.onboarding.completedAt);
  if (!unfinished) return null;
  const done = data.onboarding.completedSteps.length;

  return (
    <View className="gap-3 rounded-lg bg-success-soft p-4" accessibilityLabel="Finish setting up" testID="ajo-onboarding-resume">
      <Text variant="body-strong" tone="success">
        Finish setting up {data.association?.name ?? 'your group'} · {done} of {data.steps.length} done
      </Text>
      <View className="flex-row gap-3">
        <Button fullWidth onPress={() => router.push('/(app)/onboarding/thrift?resume=true' as never)} testID="ajo-onboarding-continue">
          Continue
        </Button>
        <Button variant="secondary" fullWidth onPress={() => setHidden(true)}>
          Not now
        </Button>
      </View>
    </View>
  );
}
