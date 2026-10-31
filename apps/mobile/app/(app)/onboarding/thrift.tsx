import { THRIFT_ONBOARDING_STEPS } from '@societyledger/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner-native';

import { ajoApi } from '@/api/endpoints/ajo';
import { ApiError } from '@/api/errors';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Text } from '@/components/ui/Text';
import { AjoLoading } from '@/features/ajo/components/AjoStates';
import { StepCircle } from '@/features/ajo/components/onboarding/StepCircle';
import { StepContributors } from '@/features/ajo/components/onboarding/StepContributors';
import { StepProfile } from '@/features/ajo/components/onboarding/StepProfile';
import { StepReview } from '@/features/ajo/components/onboarding/StepReview';
import { StepTeam } from '@/features/ajo/components/onboarding/StepTeam';
import { formatDay } from '@/features/ajo/format';
import { ajoKeys, useAjoStatus, useCollectors, useGroupDetail, useGroups, useRoster, useRuleVersions } from '@/features/ajo/queries';
import { useTenantKey } from '@/hooks/useTenantKey';
import { useSessionStore } from '@/stores/session';

const TOTAL = THRIFT_ONBOARDING_STEPS.length;

/** Once setup is finished or skipped, the "needs onboarding" flag kept from sign-in is cleared so nothing sends the admin back. */
function markDone() {
  const { user, setUser } = useSessionStore.getState();
  if (user?.requiresOnboarding) setUser({ ...user, requiresOnboarding: false });
}

/**
 * The standalone thrift group's setup wizard (thrift-ajo-spec §15): profile, first circle, contributors, team and collectors, review and
 * open. Resumable and skippable, like the web's. `?rerun=true` starts again from step 1; `?resume=true` picks up after "Skip for now".
 */
export default function ThriftOnboardingScreen() {
  const client = useQueryClient();
  const tenant = useTenantKey();
  const params = useLocalSearchParams<{ rerun?: string; resume?: string }>();
  const rerun = params.rerun === 'true';
  const resume = params.resume === 'true';
  const user = useSessionStore((s) => s.user);
  const ajo = useAjoStatus();
  const status = useQuery({ queryKey: [...ajoKeys.all(tenant), 'onboarding'], queryFn: () => ajoApi.onboardingStatus(), retry: false });
  const circles = useGroups();
  const [chosenStage, setStage] = useState<'welcome' | number | null>(null);
  const [circleId, setCircleId] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const usable = (circles.data ?? []).filter((g) => g.status !== 'CANCELLED' && g.status !== 'COMPLETED');
  const activeId = circleId ?? usable[0]?.id ?? null;
  const group = useGroupDetail(activeId ?? 0).data;
  const roster = useRoster(activeId ?? 0).data?.people ?? [];
  const versions = useRuleVersions(activeId ?? 0).data?.versions;
  const collectors = useCollectors(activeId ?? 0).data ?? [];
  const latestRules = versions && versions.length ? [...versions].sort((a, b) => b.version - a.version)[0] : undefined;

  // Where to start: the welcome screen the first time, the step they reached when they come back, nothing if it is already finished.
  const onboarding = status.data?.onboarding;
  const finished = !!onboarding?.onboardingComplete && !rerun && !resume;
  useEffect(() => {
    if (!finished) return;
    markDone();
    router.replace('/(app)/(tabs)/manage/thrift' as never);
  }, [finished]);
  const untouched = !!onboarding && onboarding.completedSteps.length === 0 && (onboarding.skippedSteps ?? []).length === 0;
  const initialStage: 'welcome' | number | null = !onboarding || finished ? null : rerun ? 1 : untouched ? 'welcome' : Math.min(Math.max(onboarding.currentStep, 1), TOTAL);
  const stage = chosenStage ?? initialStage;

  const progress = { completed: status.data?.onboarding.completedSteps ?? [], skipped: status.data?.onboarding.skippedSteps ?? [] };
  const readOnly = ajo.data?.kind === 'ok' && ajo.data.status.readOnly;
  const current = typeof stage === 'number' ? stage : 0;

  const record = async (step: number, skipped: boolean) => {
    const key = THRIFT_ONBOARDING_STEPS[step - 1]!.key;
    await ajoApi.completeOnboardingStep(step, key, skipped);
    await client.invalidateQueries({ queryKey: ajoKeys.all(tenant) });
  };
  /** Finish or skip a step, then move to the next one. A failure stays on the step with its message. */
  const advance = async (step: number, skipped = false) => {
    setProblem(null);
    try {
      await record(step, skipped);
      setStage(Math.min(step + 1, TOTAL));
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'We could not save your progress. Please try again.');
    }
  };

  const skipAll = async () => {
    setLeaving(true);
    try {
      await ajoApi.skipOnboarding();
      markDone();
      router.replace('/(app)/(tabs)/manage/thrift' as never);
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'We could not skip setup. Please try again.');
      setLeaving(false);
    }
  };

  const finish = async (groupId: number | null, opened: boolean) => {
    await record(5, false);
    markDone();
    toast.success(opened ? 'Your group is set up and the circle is open.' : 'Your group is set up.');
    router.replace((groupId ? `/(app)/(tabs)/manage/thrift/${groupId}` : '/(app)/(tabs)/manage/thrift') as never);
  };

  if (status.isPending || (stage === null && !status.isError)) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Set up your group" />
        <AjoLoading rows={3} />
      </Screen>
    );
  }
  if (status.isError) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Set up your group" />
        <ErrorState error={status.error} onRetry={() => status.refetch()} />
      </Screen>
    );
  }

  const groupName = status.data?.association?.name ?? 'your group';
  const trialEnds = user?.subscriptionAccess?.trialEndsAt;
  const stepInfo = current >= 1 ? THRIFT_ONBOARDING_STEPS[current - 1] : null;

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title={stage === 'welcome' ? `Let's set up ${groupName}` : (stepInfo?.name ?? 'Set up your group')} onBack={typeof stage === 'number' && stage > 1 ? () => setStage(stage - 1) : undefined} />
      <View className="gap-5 pb-8">
        {stepInfo ? (
          <View className="gap-2">
            <Text variant="caption" tone="secondary">
              Step {current} of {TOTAL} · {stepInfo.description}
            </Text>
            <ProgressBar percent={(current / TOTAL) * 100} label={`Step ${current} of ${TOTAL}`} />
          </View>
        ) : null}

        {readOnly ? (
          <View className="rounded-lg bg-warning-soft p-3" accessibilityRole="alert">
            <Text variant="caption" tone="warning">
              Read-only. The Ajo add-on has expired, so nothing can be added. Renew it on the website to continue setting up.
            </Text>
          </View>
        ) : null}
        {problem ? (
          <View className="rounded-md bg-danger-soft p-3" accessibilityRole="alert">
            <Text variant="body" tone="danger">
              {problem}
            </Text>
          </View>
        ) : null}

        {stage === 'welcome' ? (
          <Card testID="ajo-onboarding-welcome">
            <View className="gap-3">
              <Text variant="body">• Set up your first circle.</Text>
              <Text variant="body">• Add the people who contribute.</Text>
              <Text variant="body">• Invite anyone who helps you collect or approve payouts.</Text>
              <Text variant="caption" tone="secondary">
                It takes about 10 minutes. Your group&apos;s money stays in your own bank account; SocietyLedger keeps the records.
              </Text>
              {trialEnds ? (
                <Text variant="caption" tone="secondary">
                  Your free trial ends on {formatDay(trialEnds)}.
                </Text>
              ) : null}
              <View className="flex-row gap-3">
                <Button variant="secondary" fullWidth loading={leaving} onPress={() => void skipAll()} testID="ajo-onboarding-skip-all">
                  Skip for now
                </Button>
                <Button fullWidth onPress={() => setStage(1)} testID="ajo-onboarding-start">
                  Start setup
                </Button>
              </View>
            </View>
          </Card>
        ) : null}

        {stage !== 'welcome' && readOnly && current !== 5 ? <Button onPress={() => setStage(5)}>Go to the review</Button> : null}

        {!readOnly && stage === 1 ? <StepProfile groupName={groupName} onDone={() => advance(1)} onSkip={() => advance(1, true)} /> : null}
        {!readOnly && stage === 2 ? (
          <StepCircle
            existing={circles.data ?? []}
            chosenId={activeId}
            onChoose={setCircleId}
            onCreated={async (id) => {
              setCircleId(id);
              await advance(2);
            }}
            onSkip={() => advance(2, true)}
          />
        ) : null}
        {!readOnly && stage === 3 ? (
          <StepContributors circles={usable} circleId={activeId} onChooseCircle={setCircleId} group={group} guarantorRequired={latestRules?.rules.guarantorPolicy === 'REQUIRED'} onDone={() => advance(3)} onSkip={() => advance(3, true)} />
        ) : null}
        {!readOnly && stage === 4 ? <StepTeam collectorCircle={group?.model === 'COLLECTOR_THRIFT'} hasCollector={collectors.some((c) => !c.endsOn)} onDone={() => advance(4)} onSkip={() => advance(4, true)} /> : null}
        {stage === 5 ? <StepReview group={group} roster={roster} rules={latestRules} progress={progress} groupName={groupName} onFix={(step) => setStage(step)} onFinish={finish} /> : null}

        {typeof stage === 'number' ? (
          <Button variant="ghost" loading={leaving} onPress={() => void skipAll()} testID="ajo-onboarding-skip-all-bottom">
            Skip setup for now
          </Button>
        ) : null}
      </View>
    </Screen>
  );
}
