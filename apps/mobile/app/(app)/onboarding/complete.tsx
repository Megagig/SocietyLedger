import { View } from 'react-native';
import { router } from 'expo-router';
import { CheckCircle2, Circle, PartyPopper, SkipForward } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { ONBOARDING_STEPS } from '@societyledger/shared';

import { ApiError } from '@/api/errors';
import { ErrorState } from '@/components/feedback/ErrorState';
import { ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { SectionCard } from '@/components/layout/SectionCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { IconCircle } from '@/components/ui/IconCircle';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useLeaveSetup } from '@/features/onboarding/mutations';
import { useOnboardingStatus } from '@/features/onboarding/queries';
import { stepStateOf } from '@/features/onboarding/steps';

/** O5 — the end of setup: what got done and what was skipped (a skipped step can still be finished from here), then on to Home. */
export default function SetupCompleteScreen() {
  const query = useOnboardingStatus();
  const leave = useLeaveSetup();

  function goHome() {
    leave.mutate(
      { skipAll: false },
      {
        onSuccess: () => router.replace('/(app)/(tabs)/home'),
        onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not finish setup. Try again.'),
      },
    );
  }

  if (query.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="All done" docsKey="O5" />
        <Skeleton width="100%" height={72} radius="md" />
      </Screen>
    );
  }
  if (query.isError) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="All done" docsKey="O5" />
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </Screen>
    );
  }

  const progress = { completedSteps: query.data.onboarding.completedSteps, skippedSteps: query.data.onboarding.skippedSteps ?? [] };
  const setupSteps = ONBOARDING_STEPS.filter((s) => s.key !== 'complete');
  const anySkipped = setupSteps.some((s) => stepStateOf(progress, s.id) !== 'done');

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader title="All done" docsKey="O5" />
      <View className="gap-6 pb-6">
        <View className="items-center gap-3 py-4">
          <IconCircle icon={PartyPopper} tone="success" />
          <Text variant="h2" align="center">You&apos;re all set</Text>
          <Text variant="body" tone="secondary" align="center">
            {anySkipped ? 'Here is what you set up. You can finish the rest any time from Manage.' : 'Your association is ready. Start managing your members and finances.'}
          </Text>
        </View>

        <SectionCard title="Your setup">
          {setupSteps.map((step) => {
            const state = stepStateOf(progress, step.id);
            return (
              <ListItem
                key={step.key}
                title={step.name}
                showChevron={state !== 'done'}
                onPress={state === 'done' ? undefined : () => router.push(`/(app)/onboarding/${step.key}`)}
                leading={<IconCircle icon={state === 'done' ? CheckCircle2 : state === 'skipped' ? SkipForward : Circle} tone={state === 'done' ? 'success' : state === 'skipped' ? 'warning' : 'neutral'} />}
                trailing={state === 'done' ? <Badge tone="success">Done</Badge> : <Badge tone="warning">{state === 'skipped' ? 'Skipped · Finish now' : 'Not started'}</Badge>}
                testID={`setup-summary-${step.key}`}
              />
            );
          })}
        </SectionCard>

        <Button variant="gradient" size="lg" fullWidth loading={leave.isPending} onPress={goHome} testID="setup-go-home">
          Go to Home
        </Button>
      </View>
    </Screen>
  );
}
