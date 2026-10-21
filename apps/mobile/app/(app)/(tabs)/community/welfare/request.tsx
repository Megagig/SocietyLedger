import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';
import { z } from 'zod';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { TextField } from '@/components/forms/TextField';
import { PAYOUT_TYPE_OPTIONS } from '@/features/welfare/labels';
import { useCreatePayoutRequest, useWelfareFunds } from '@/features/welfare/queries';
import { t } from '@/lib/i18n';
import { ModuleLockedScreen } from '@/components/feedback/ModuleLockedScreen';
import { NoMemberProfile } from '@/components/feedback/NoMemberProfile';
import { useCan } from '@/hooks/useCan';
import { WELFARE_REQUEST_ACCESS } from '@/lib/permissions';
import { useMemberId } from '@/hooks/useMemberId';
import { useModuleDisabled } from '@/hooks/useModuleAccess';
import type { WelfarePayoutType } from '@/types/api/welfare';


const schema = z.object({
  fundId: z.string().min(1, 'Select a welfare fund'),
  payoutType: z.string().min(1, 'Select a payout type'),
  amountStr: z
    .string()
    .min(1, 'Enter an amount')
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, 'Amount must be a positive number'),
  reason: z.string().min(10, 'Please provide more detail (at least 10 characters)'),
});

type FormValues = z.infer<typeof schema>;

/** project-overview.md §6.5 C12 — Welfare payout request form. */
export default function WelfareRequestScreen() {
  const router = useRouter();
  const canRequest = useCan(WELFARE_REQUEST_ACCESS);

  const fundsQuery = useWelfareFunds();
  const createMutation = useCreatePayoutRequest();
  const locked = useModuleDisabled('welfare');
  const memberId = useMemberId();

  const funds = fundsQuery.data?.funds ?? [];
  const fundOptions = funds.map((f) => ({ label: f.name, value: String(f.id) }));

  const {
    control,
    handleSubmit,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = (values: FormValues) => {
    createMutation.mutate(
      {
        fundId: Number(values.fundId),
        payoutType: values.payoutType as WelfarePayoutType,
        amount: Number(values.amountStr),
        reason: values.reason,
      },
      {
        onSuccess: () => {
          toast.success(t('welfare.submitSuccess'));
          router.back();
        },
        onError: () => {
          toast.error(t('errors.generic'));
        },
      }
    );
  };

  if (locked) return <ModuleLockedScreen title="Request support" moduleName="Welfare" onBack={() => router.back()} />;

  if (!memberId) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Request support" onBack={() => router.back()} />
        <NoMemberProfile subject="welfare requests" />
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']} scroll>
      <ScreenHeader title={t('welfare.requestTitle')} onBack={() => router.back()} />

      <View className="gap-5">
        <SelectSheet
          control={control}
          name="fundId"
          label={t('welfare.fundLabel')}
          options={fundOptions}
          placeholder="Select a fund…"
        />

        <SelectSheet
          control={control}
          name="payoutType"
          label={t('welfare.payoutTypeLabel')}
          options={PAYOUT_TYPE_OPTIONS}
          placeholder="Select payout type…"
        />

        <TextField
          control={control}
          name="amountStr"
          label={t('welfare.amountLabel')}
          keyboardType="numeric"
          placeholder="0"
        />

        <TextField
          control={control}
          name="reason"
          label={t('welfare.reasonLabel')}
          placeholder={t('welfare.reasonPlaceholder')}
          multiline
        />
      </View>

      <StickyFooter>
        <Button
          variant="primary"
          loading={createMutation.isPending}
          disabled={!canRequest}
          onPress={() => { handleSubmit(onSubmit)(); }}
        >
          {t('welfare.submit')}
        </Button>
      </StickyFooter>
    </Screen>
  );
}
