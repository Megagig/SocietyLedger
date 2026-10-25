import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { ApiError } from '@/api/errors';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { describeNextStep, SUBSCRIPTION_ACCESS, SUBSCRIPTION_STATUS_LABEL, SUBSCRIPTION_STATUS_TONE } from '@/features/settings/labels';
import { useMyModules, useSubscription } from '@/features/settings/queries';
import { useCan } from '@/hooks/useCan';
import { formatDate } from '@/lib/dates';

/** project-overview.md §6.9 ST10 — the plan, its status and dates, and what it includes. Read-only: billing is managed on the website. */
export default function SubscriptionScreen() {
  const router = useRouter();
  const allowed = useCan(SUBSCRIPTION_ACCESS);
  const query = useSubscription();
  const modulesQuery = useMyModules();
  const back = () => router.back();

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Subscription" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  if (query.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Subscription" onBack={back} />
        <View className="gap-4">
          <Skeleton width="100%" height={96} radius="md" />
          <Skeleton width="100%" height={160} radius="md" />
        </View>
      </Screen>
    );
  }

  // No active plan is a normal answer (404), not a failure.
  if (query.error instanceof ApiError && query.error.status === 404) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Subscription" onBack={back} />
        <EmptyState title="No active plan" description="Billing is managed on the SocietyLedger website." />
      </Screen>
    );
  }

  if (query.isError || !query.data) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Subscription" onBack={back} />
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </Screen>
    );
  }

  const subscription = query.data;
  const next = describeNextStep(subscription);
  const included = (modulesQuery.data?.modules ?? []).filter((m) => m.isEnabled);

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Subscription" onBack={back} />

      <View className="gap-6">
        <Section title="Your plan">
          <ListGroup>
            <ListItem title={subscription.plan.name} meta={subscription.billingCycle === 'ANNUAL' ? 'Billed yearly' : 'Billed monthly'} trailing={<Badge tone={SUBSCRIPTION_STATUS_TONE[subscription.status]}>{SUBSCRIPTION_STATUS_LABEL[subscription.status]}</Badge>} testID="sub-plan" />
            <ListItem title={next.label} trailing={<Text variant="body-strong">{formatDate(next.date, 'long')}</Text>} testID="sub-next" />
            {subscription.plan.memberLimit ? <ListItem title="Members allowed" trailing={<Text variant="body-strong">{String(subscription.plan.memberLimit)}</Text>} testID="sub-limit" /> : null}
            {subscription.pendingPlan ? <ListItem title="Changing to" meta="Takes effect when the current period ends" trailing={<Text variant="body-strong">{subscription.pendingPlan.name}</Text>} testID="sub-pending" /> : null}
          </ListGroup>
        </Section>

        {included.length > 0 ? (
          <Section title="What your plan includes">
            <ListGroup>
              {included.map((m) => (
                <ListItem key={m.code} title={m.name} compact />
              ))}
            </ListGroup>
          </Section>
        ) : null}

        <Text variant="caption" tone="secondary">
          Billing is managed on the SocietyLedger website.
        </Text>
      </View>
    </Screen>
  );
}
