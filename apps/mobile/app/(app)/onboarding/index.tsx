import { useEffect } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { toast } from 'sonner-native';
import { CheckCircle2, Circle, SkipForward } from 'lucide-react-native';
import { ONBOARDING_STEPS } from '@societyledger/shared';

import { ApiError } from '@/api/errors';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { SectionCard } from '@/components/layout/SectionCard';
import { ListItem } from '@/components/layout/ListItem';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { IconCircle } from '@/components/ui/IconCircle';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useLeaveSetup } from '@/features/onboarding/mutations';
import { useOnboardingStatus } from '@/features/onboarding/queries';
import { finishedCount, firstOpenStep, stepStateOf } from '@/features/onboarding/steps';
import { useSessionStore } from '@/stores/session';

/** O0 — where the setup wizard opens, and where it resumes: the five steps with what is done, what was skipped, and a Continue that goes to
 * the first one still open. Closing the app halfway or starting on the web both land back here. */
export default function SetupOverviewScreen() {
  const query = useOnboardingStatus();
  const leave = useLeaveSetup();

  // Someone finished (or skipped) setup on the web: nothing left to do here.
  const alreadyDone = query.data?.onboarding.onboardingComplete === true;
  useEffect(() => {
    if (!alreadyDone) return;
    const { user, setUser } = useSessionStore.getState();
    if (user?.requiresOnboarding) setUser({ ...user, requiresOnboarding: false });
    router.replace('/(app)/(tabs)/home');
  }, [alreadyDone]);

  function skipAll() {
    leave.mutate(
      { skipAll: true },
      {
        onSuccess: () => {
          toast.success('You can set everything up later from Manage.');
          router.replace('/(app)/(tabs)/home');
        },
        onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not skip setup. Try again.'),
      },
    );
  }

  if (query.isPending || alreadyDone) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Set up your association" docsKey="O1" />
        <View className="gap-4">
          <Skeleton width="100%" height={72} radius="md" />
          <Skeleton width="100%" height={72} radius="md" />
          <Skeleton width="100%" height={72} radius="md" />
        </View>
      </Screen>
    );
  }

  if (query.isError) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Set up your association" docsKey="O1" />
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </Screen>
    );
  }

  const { onboarding, association } = query.data;
  const progress = { completedSteps: onboarding.completedSteps, skippedSteps: onboarding.skippedSteps ?? [] };
  const next = firstOpenStep(progress);
  const finished = finishedCount(progress);
  const total = ONBOARDING_STEPS.length - 1;

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader title="Set up your association" docsKey="O1" />
      <View className="gap-6 pb-6">
        <View className="gap-2">
          <Text variant="body" tone="secondary">
            {association ? `Welcome, ${association.name}. ` : ''}A few quick steps and you are ready to go. You can skip any step and come back to it.
          </Text>
          <ProgressBar percent={(finished / total) * 100} label={`${finished} of ${total} steps finished`} />
          <Text variant="caption" tone="secondary">{`${finished} of ${total} steps finished`}</Text>
        </View>

        <SectionCard title="Your setup">
          {ONBOARDING_STEPS.map((step) => {
            const state = stepStateOf(progress, step.id);
            return (
              <ListItem
                key={step.key}
                title={step.name}
                meta={step.description}
                showChevron
                onPress={() => router.push(`/(app)/onboarding/${step.key}`)}
                leading={
                  <IconCircle icon={state === 'done' ? CheckCircle2 : state === 'skipped' ? SkipForward : Circle} tone={state === 'done' ? 'success' : state === 'skipped' ? 'warning' : 'neutral'} />
                }
                trailing={state === 'done' ? <Badge tone="success">Done</Badge> : state === 'skipped' ? <Badge tone="warning">Skipped</Badge> : undefined}
                testID={`setup-step-${step.key}`}
              />
            );
          })}
        </SectionCard>

        <View className="gap-3">
          <Button variant="gradient" size="lg" fullWidth onPress={() => router.push(`/(app)/onboarding/${next}`)} testID="setup-continue-wizard">
            {finished === 0 && (onboarding.skippedSteps ?? []).length === 0 ? 'Get started' : 'Continue setup'}
          </Button>
          <Button variant="ghost" size="lg" fullWidth loading={leave.isPending} onPress={skipAll} testID="setup-skip-all">
            Skip setup for now
          </Button>
        </View>
      </View>
    </Screen>
  );
}
