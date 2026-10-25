import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { NoPermission } from '@/components/feedback/NoPermission';
import { AmountField } from '@/components/forms/AmountField';
import { DateField } from '@/components/forms/DateField';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { PAYMENT_METHOD_OPTIONS } from '@/features/finance/labels';
import { MembersMultiPickerSheet, type PickedMemberRef } from '@/features/finance/components/MembersMultiPickerSheet';
import { MemberPickerField } from '@/features/members/components/MemberPickerField';
import { useRecordBulk, useRecordContribution } from '@/features/welfareManage/mutations';
import { useActiveFunds, WELFARE_MANAGE_ACCESS, WELFARE_MODULE } from '@/features/welfareManage/queries';
import { buildContributionSchema, emptyContributionValues, toBulkPayload, toContributionPayload, type ContributionValues } from '@/features/welfareManage/schemas';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { formatMoney } from '@/lib/money';
import { parseAmount } from '@/features/finance/schemas';

type Mode = 'one' | 'many';

/**
 * project-overview.md §6.9 WF3 — record what a member paid into a fund, or what many members paid the same amount. A recorded contribution
 * is waiting until another officer confirms it, and only then does it count in the fund.
 */
export default function RecordContributionScreen() {
  const router = useRouter();
  const allowed = useModuleAccess(WELFARE_MANAGE_ACCESS, WELFARE_MODULE);
  const funds = useActiveFunds();
  const recordOne = useRecordContribution();
  const recordMany = useRecordBulk();
  const [mode, setMode] = useState<Mode>('one');
  const [chosen, setChosen] = useState<PickedMemberRef[]>([]);
  const pickerRef = useRef<BottomSheetModal>(null);
  const [fundId, setFundId] = useState('');
  const minimum = useMemo(() => {
    const fund = (funds.data ?? []).find((f) => String(f.id) === fundId);
    return fund?.minContribution ? Number(fund.minContribution) : null;
  }, [funds.data, fundId]);
  const schema = useMemo(() => buildContributionSchema(minimum), [minimum]);
  const { control, handleSubmit, setError } = useForm<ContributionValues>({ resolver: zodResolver(schema), defaultValues: emptyContributionValues(), mode: 'onTouched' });
  const watchedFund = useWatch({ control, name: 'fundId' });
  const amountText = useWatch({ control, name: 'amount' });
  if (watchedFund !== fundId) setFundId(watchedFund);
  const back = () => router.back();
  const fundOptions = useMemo(() => (funds.data ?? []).map((f) => ({ value: String(f.id), label: f.name })), [funds.data]);
  const amount = parseAmount(amountText);

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Record contributions" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const fail = (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Could not record it. Try again.');

  const submit = (values: ContributionValues) => {
    if (mode === 'one') {
      const chosenMember = values.member;
      if (!chosenMember) {
        setError('member', { message: 'Choose the member' });
        return;
      }
      recordOne.mutate(toContributionPayload(values, chosenMember.id), {
        onSuccess: () => {
          toast.success('Recorded — it counts once another officer confirms it');
          router.back();
        },
        onError: fail,
      });
      return;
    }
    if (chosen.length === 0) {
      toast.error('Choose at least one member.');
      return;
    }
    recordMany.mutate(toBulkPayload(values, chosen.map((m) => m.id)), {
      onSuccess: (result) => {
        toast.success(`Recorded ${result.count} ${result.count === 1 ? 'contribution' : 'contributions'} — they count once another officer confirms them`);
        router.back();
      },
      onError: fail,
    });
  };

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title="Record contributions" onBack={back} docsKey="WF3" />

      <View className="gap-6 pb-6">
        <SegmentedControl<Mode>
          options={[
            { label: 'One member', value: 'one' },
            { label: 'Many members', value: 'many' },
          ]}
          value={mode}
          onChange={setMode}
          testID="contribution-mode"
        />

        <Section title="Who and where">
          <View className="gap-4">
            <SelectSheet control={control} name="fundId" label="Fund" options={fundOptions} placeholder={funds.isPending ? 'Loading funds…' : fundOptions.length === 0 ? 'No active fund yet' : 'Choose the fund'} testID="contribution-fund" />
            {mode === 'one' ? (
              <MemberPickerField control={control} name="member" label="Member" testID="contribution-member" />
            ) : (
              <View className="gap-2">
                <Button variant="secondary" onPress={() => pickerRef.current?.present()} testID="contribution-choose-members">
                  {chosen.length === 0 ? 'Choose members' : `${chosen.length} chosen — change`}
                </Button>
                <Text variant="caption" tone="secondary">
                  Everyone chosen pays the same amount. Only active members can be chosen.
                </Text>
              </View>
            )}
          </View>
        </Section>

        <Section title="The money">
          <View className="gap-4">
            <AmountField control={control} name="amount" label="Amount" helper={minimum ? `The smallest contribution to this fund is ${formatMoney(minimum)}.` : undefined} presets={[1000, 5000, 10000]} />
            <DateField control={control} name="contributionDate" label="Date paid" maximumDate={new Date()} />
            <SelectSheet control={control} name="paymentMethod" label="How it was paid" options={PAYMENT_METHOD_OPTIONS} placeholder="Choose how" />
            {mode === 'one' ? <TextField control={control} name="reference" label="Reference (optional)" /> : null}
            <TextField control={control} name="notes" label="Note (optional)" multiline />
          </View>
        </Section>

        {mode === 'many' && amount !== null && chosen.length > 0 ? (
          <View className="gap-1 rounded-lg bg-surface-sunken p-4" testID="contribution-summary">
            <Text variant="label">Summary</Text>
            <Text variant="body">{`${chosen.length} ${chosen.length === 1 ? 'member' : 'members'} × ${formatMoney(amount)} = ${formatMoney(amount * chosen.length)}`}</Text>
          </View>
        ) : null}

        <Text variant="caption" tone="secondary">
          Only record money that was really paid. It waits as pending until a different officer confirms it, and only then is added to the fund.
        </Text>
      </View>

      <StickyFooter>
        <View className="flex-1">
          <Button variant="primary" fullWidth loading={recordOne.isPending || recordMany.isPending} onPress={() => { void handleSubmit(submit)(); }} testID="contribution-save">
            {mode === 'one' ? 'Record contribution' : `Record for ${chosen.length || ''} members`.replace('  ', ' ')}
          </Button>
        </View>
      </StickyFooter>

      <MembersMultiPickerSheet ref={pickerRef} selected={chosen} onChange={setChosen} />
    </Screen>
  );
}
