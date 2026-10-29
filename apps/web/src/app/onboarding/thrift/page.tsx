'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Progress } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { THRIFT_ONBOARDING_STEPS } from '@societyledger/shared';
import { AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { StepCircle } from '@/components/ajo/onboarding/StepCircle';
import { StepContributors } from '@/components/ajo/onboarding/StepContributors';
import { StepProfile } from '@/components/ajo/onboarding/StepProfile';
import { StepReview } from '@/components/ajo/onboarding/StepReview';
import { StepTeam } from '@/components/ajo/onboarding/StepTeam';
import { ajoErrorMessage } from '@/lib/ajo/api';
import { formatDay } from '@/lib/ajo/format';
import { useAjoStatus } from '@/lib/ajo/hooks';
import { ajoStaffApi } from '@/lib/ajo/staffApi';
import { useCollectors, useGroupDetail, useGroups, useRoster, useRuleVersions } from '@/lib/ajo/staffHooks';
import { toast } from '@/lib/toast';
import { useAuthStore } from '@/store/authStore';

const TOTAL = THRIFT_ONBOARDING_STEPS.length;

/** Once setup is finished or skipped, the "needs onboarding" flag kept from sign-in is cleared so nothing sends the admin back. */
const markDone = () => useAuthStore.setState((s) => ({ user: s.user ? { ...s.user, requiresOnboarding: false } : s.user }));

function ThriftOnboarding() {
  const router = useRouter();
  const client = useQueryClient();
  const rerun = useSearchParams().get('rerun') === 'true';
  const user = useAuthStore((s) => s.user);
  const ajo = useAjoStatus();
  const status = useQuery({ queryKey: ['ajo', 'onboarding'], queryFn: ajoStaffApi.onboardingStatus, retry: false });
  const circles = useGroups();
  const [stage, setStage] = useState<'welcome' | number | null>(null);
  const [circleId, setCircleId] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const usable = (circles.data ?? []).filter((g) => g.status !== 'CANCELLED' && g.status !== 'COMPLETED');
  const activeId = circleId ?? usable[0]?.id ?? null;
  const group = useGroupDetail(activeId ?? 0).data;
  const roster = useRoster(activeId ?? 0).data?.people ?? [];
  const versions = useRuleVersions(activeId ?? 0).data;
  const collectors = useCollectors(activeId ?? 0).data ?? [];
  const latestRules = versions && versions.length ? [...versions].sort((a, b) => b.version - a.version)[0] : undefined;

  // Where to start: the welcome screen the first time, the step they reached when they come back, nothing if it is already finished.
  useEffect(() => {
    if (!status.data || stage !== null) return;
    const o = status.data.onboarding;
    if (o.onboardingComplete && !rerun) { router.replace('/dashboard/ajo'); return; }
    const untouched = o.completedSteps.length === 0 && (o.skippedSteps ?? []).length === 0;
    setStage(untouched || rerun ? (rerun ? 1 : 'welcome') : Math.min(Math.max(o.currentStep, 1), TOTAL));
  }, [status.data, stage, rerun, router]);

  const progress = { completed: status.data?.onboarding.completedSteps ?? [], skipped: status.data?.onboarding.skippedSteps ?? [] };
  const readOnly = ajo.data?.kind === 'ok' && ajo.data.status.readOnly;
  const current = typeof stage === 'number' ? stage : 0;

  const record = async (step: number, skipped: boolean) => {
    const key = THRIFT_ONBOARDING_STEPS[step - 1].key;
    await ajoStaffApi.completeOnboardingStep(step, key, skipped);
    await client.invalidateQueries({ queryKey: ['ajo'] });
  };
  /** Finish or skip a step, then move to the next one. A failure stays on the step with its message. */
  const advance = async (step: number, skipped = false) => {
    setProblem(null);
    try {
      await record(step, skipped);
      setStage(Math.min(step + 1, TOTAL));
    } catch (error) {
      setProblem(ajoErrorMessage(error, 'We could not save your progress. Please try again.'));
    }
  };

  const skipAll = async () => {
    setLeaving(true);
    try {
      await ajoStaffApi.skipOnboarding();
      markDone();
      router.push('/dashboard/ajo');
    } catch (error) {
      setProblem(ajoErrorMessage(error, 'We could not skip setup. Please try again.'));
      setLeaving(false);
    }
  };

  const finish = async (groupId: number | null, opened: boolean) => {
    await record(5, false);
    markDone();
    toast.success(opened ? 'Your group is set up and the circle is open.' : 'Your group is set up.');
    router.push(groupId ? `/dashboard/ajo/${groupId}` : '/dashboard/ajo');
  };

  if (status.isLoading || stage === null) return <div className="mx-auto max-w-3xl p-6"><AjoLoading rows={3} /></div>;
  if (status.isError) return <div className="mx-auto max-w-3xl p-6"><AjoError error={status.error} onRetry={() => status.refetch()} /></div>;

  const groupName = status.data?.association?.name ?? 'your group';
  const trialEnds = user?.subscriptionAccess?.trialEndsAt;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stage === 'welcome' ? `Let's set up ${groupName}` : THRIFT_ONBOARDING_STEPS[current - 1].name}</h1>
          {typeof stage === 'number' && <p className="text-sm text-gray-600 dark:text-gray-400">Step {current} of {TOTAL} · {THRIFT_ONBOARDING_STEPS[current - 1].description}</p>}
        </div>
        <Button variant="subtle" color="gray" size="xs" onClick={skipAll} loading={leaving}>Skip for now</Button>
      </header>
      {typeof stage === 'number' && <Progress value={(current / TOTAL) * 100} color="green" size="sm" aria-label={`Step ${current} of ${TOTAL}`} />}

      {readOnly && (
        <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <strong>Read-only.</strong> The Ajo add-on has expired, so nothing can be added. <Link href="/dashboard/subscription" className="font-medium underline">Renew it</Link> to continue setting up.
        </div>
      )}
      {problem && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{problem}</p>}

      {stage === 'welcome' && (
        <section className="space-y-4 rounded-lg border border-gray-200 p-6 dark:border-gray-700">
          <ul className="list-disc space-y-1 pl-5 text-gray-800 dark:text-gray-200">
            <li>Set up your first circle.</li>
            <li>Add the people who contribute.</li>
            <li>Invite anyone who helps you collect or approve payouts.</li>
          </ul>
          <p className="text-sm text-gray-600 dark:text-gray-400">It takes about 10 minutes. Your group&apos;s money stays in your own bank account; SocietyLedger keeps the records.</p>
          {trialEnds && <p className="text-sm text-gray-600 dark:text-gray-400">Your free trial ends on {formatDay(trialEnds)}.</p>}
          <div className="flex justify-between"><Button variant="default" onClick={skipAll} loading={leaving}>Skip for now</Button><Button color="green" onClick={() => setStage(1)}>Start setup</Button></div>
        </section>
      )}

      {stage !== 'welcome' && readOnly && current !== 5 && (
        <div className="flex justify-end"><Button onClick={() => setStage(5)}>Go to the review</Button></div>
      )}

      {!readOnly && stage === 1 && <StepProfile groupName={groupName} subdomain={undefined} onDone={() => advance(1)} onSkip={() => advance(1, true)} />}
      {!readOnly && stage === 2 && (
        <StepCircle existing={circles.data ?? []} chosenId={activeId} onChoose={setCircleId} onCreated={async (id) => { setCircleId(id); await advance(2); }} onSkip={() => advance(2, true)} />
      )}
      {!readOnly && stage === 3 && (
        <StepContributors circles={usable} circleId={activeId} onChooseCircle={setCircleId} group={group} guarantorRequired={latestRules?.rules.guarantorPolicy === 'REQUIRED'} onDone={() => advance(3)} onSkip={() => advance(3, true)} />
      )}
      {!readOnly && stage === 4 && (
        <StepTeam collectorCircle={group?.model === 'COLLECTOR_THRIFT'} hasCollector={collectors.some((c) => !c.endsOn)} onDone={() => advance(4)} onSkip={() => advance(4, true)} />
      )}
      {stage === 5 && <StepReview group={group} roster={roster} rules={latestRules} progress={progress} groupName={groupName} onFix={(step) => setStage(step)} onFinish={finish} />}

      {typeof stage === 'number' && stage > 1 && (
        <div className="flex"><Button variant="subtle" size="xs" onClick={() => setStage(stage - 1)}>← Back</Button></div>
      )}
    </div>
  );
}

export default function ThriftOnboardingPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl p-6"><AjoLoading rows={3} /></div>}>
      <ThriftOnboarding />
    </Suspense>
  );
}
