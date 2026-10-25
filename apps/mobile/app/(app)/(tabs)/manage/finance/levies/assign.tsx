import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { AmountField } from '@/components/forms/AmountField';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { MembersMultiPickerSheet, type PickedMemberRef } from '@/features/finance/components/MembersMultiPickerSheet';
import { assignOutcomeSummary, campaignCanAssign } from '@/features/financeSetup/labels';
import { useAssignMembers } from '@/features/financeSetup/mutations';
import { ASSIGN_ACCESS, useCampaign } from '@/features/financeSetup/queries';
import { assignAmount, assignFormSchema, type AssignFormValues } from '@/features/financeSetup/schemas';
import { useCan } from '@/hooks/useCan';
import { formatMoney } from '@/lib/money';

type Who = 'all' | 'chosen';

/** project-overview.md §6.9 FN9 — put members on a levy campaign. Each gets a charge on their ledger; members already in it are skipped. */
export default function AssignMembersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const canAssign = useCan(ASSIGN_ACCESS);
  const query = useCampaign(id);
  const assign = useAssignMembers(id);
  const [who, setWho] = useState<Who>('all');
  const [chosen, setChosen] = useState<PickedMemberRef[]>([]);
  const pickerRef = useRef<BottomSheetModal>(null);
  const { control, handleSubmit } = useForm<AssignFormValues>({ resolver: zodResolver(assignFormSchema), defaultValues: { amount: '' }, mode: 'onTouched' });
  const typed = useWatch({ control, name: 'amount' });
  const back = () => router.back();

  if (!canAssign) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Assign members" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  if (query.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Assign members" onBack={back} />
        <View className="gap-4">
          <Skeleton width="100%" height={52} radius="md" />
          <Skeleton width="100%" height={52} radius="md" />
        </View>
      </Screen>
    );
  }

  const campaign = query.data;
  if (query.isError || !campaign) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Assign members" onBack={back} />
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </Screen>
    );
  }

  if (!campaignCanAssign(campaign.status)) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Assign members" onBack={back} />
        <ErrorState title="This campaign is closed to new members." description="Everyone already on it keeps owing their charge until they pay, or you waive or void it." />
      </Screen>
    );
  }

  const alreadyIn = campaign.assignments.map((a) => a.memberId);
  const each = assignAmount(typed, campaign.amountPerMember);

  const submit = (values: AssignFormValues) => {
    const amount = assignAmount(values.amount, campaign.amountPerMember);
    if (amount === null) {
      toast.error('Enter an amount per member — this campaign has no default.');
      return;
    }
    if (who === 'chosen' && chosen.length === 0) {
      toast.error('Choose at least one member.');
      return;
    }
    assign.mutate(
      { ...(who === 'all' ? { allActive: true } : { memberIds: chosen.map((m) => m.id) }), amount },
      {
        onSuccess: (result) => {
          toast.success(assignOutcomeSummary(result));
          router.back();
        },
        onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not assign the members. Try again.'),
      },
    );
  };

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title="Assign members" onBack={back} docsKey="FN9" />

      <View className="gap-6 pb-6">
        <Text variant="body" tone="secondary">
          {campaign.name}
        </Text>

        <Section title="Amount per member">
          <AmountField
            control={control}
            name="amount"
            label="Amount (optional)"
            helper={campaign.amountPerMember !== null ? `Leave blank to charge the campaign's ${formatMoney(campaign.amountPerMember)}.` : 'This campaign has no default amount, so enter one.'}
            presets={[1000, 5000, 10000, 20000]}
          />
        </Section>

        <Section title="Who">
          <View className="gap-3">
            <SegmentedControl<Who>
              options={[
                { label: 'All active members', value: 'all' },
                { label: 'Choose members', value: 'chosen' },
              ]}
              value={who}
              onChange={setWho}
              testID="assign-who"
            />
            {who === 'chosen' ? (
              <Button variant="secondary" onPress={() => pickerRef.current?.present()} testID="assign-choose">
                {chosen.length === 0 ? 'Choose members' : `${chosen.length} chosen — change`}
              </Button>
            ) : (
              <Text variant="caption" tone="secondary">
                Every active member who isn&apos;t already in this campaign gets a charge.
              </Text>
            )}
          </View>
        </Section>

        {each !== null && who === 'chosen' && chosen.length > 0 ? (
          <View className="gap-1 rounded-lg bg-surface-sunken p-4" testID="assign-summary">
            <Text variant="label">Summary</Text>
            <Text variant="body">{`${chosen.length} ${chosen.length === 1 ? 'member' : 'members'} × ${formatMoney(each)} = ${formatMoney(each * chosen.length)}`}</Text>
          </View>
        ) : null}

        <Text variant="caption" tone="secondary">
          Each member&apos;s charge goes on their ledger as money they owe, and they are reminded like any other charge.
        </Text>
      </View>

      <StickyFooter>
        <View className="flex-1">
          <Button variant="primary" fullWidth loading={assign.isPending} onPress={() => { void handleSubmit(submit)(); }} testID="assign-save">
            {who === 'all' ? 'Assign all active members' : `Assign ${chosen.length || ''} members`.replace('  ', ' ')}
          </Button>
        </View>
      </StickyFooter>

      <MembersMultiPickerSheet ref={pickerRef} selected={chosen} onChange={setChosen} excludeIds={alreadyIn} />
    </Screen>
  );
}
