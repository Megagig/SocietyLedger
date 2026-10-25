import { zodResolver } from '@hookform/resolvers/zod';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import { CalendarRange, Plus } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ConfirmSheet } from '@/components/feedback/ConfirmSheet';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { DateField } from '@/components/forms/DateField';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { PeriodRow } from '@/features/accounting/components/Rows';
import { ACCOUNTING_APPROVE_ACCESS, PERIOD_STATUS_LABELS } from '@/features/accounting/labels';
import { useChangePeriod, useCreatePeriod } from '@/features/accounting/mutations';
import { useAccountingAccess, usePeriods } from '@/features/accounting/queries';
import { PERIOD_TYPE_OPTIONS, periodFormSchema, toPeriodPayload, type PeriodFormValues } from '@/features/accounting/schemas';
import { positionOf } from '@/features/financeSetup/components/GroupedRow';
import { useCan } from '@/hooks/useCan';
import type { AccountingPeriodDTO } from '@/types/api/accounting';

type Action = 'close' | 'reopen' | 'lock';

const ACTION_COPY: Record<Action, { title: (p: string) => string; description: string; confirm: string; done: string; destructive: boolean }> = {
  close: {
    title: (p) => `Close ${p}?`,
    description: 'Nothing more can be posted to dates in this period. You can open it again if you need to.',
    confirm: 'Close period',
    done: 'Period closed',
    destructive: false,
  },
  reopen: {
    title: (p) => `Open ${p} again?`,
    description: 'Entries can be posted to this period again. The change is recorded in the audit log.',
    confirm: 'Open period',
    done: 'Period open again',
    destructive: false,
  },
  lock: {
    title: (p) => `Lock ${p} for good?`,
    description: 'A locked period can never be opened again, not even by an Administrator. Do this only when the books for it are final.',
    confirm: 'Lock period',
    done: 'Period locked',
    destructive: true,
  },
};

/** The accounting periods: close a month or year once it is settled, so nothing can be posted into it afterwards. */
export default function PeriodsScreen() {
  const router = useRouter();
  const allowed = useAccountingAccess();
  const canManage = useCan(ACCOUNTING_APPROVE_ACCESS);
  const query = usePeriods();
  const create = useCreatePeriod();
  const change = useChangePeriod();
  const [selected, setSelected] = useState<AccountingPeriodDTO | null>(null);
  const [pending, setPending] = useState<{ period: AccountingPeriodDTO; action: Action } | null>(null);
  const addRef = useRef<BottomSheetModal>(null);
  const actionsRef = useRef<BottomSheetModal>(null);
  const confirmRef = useRef<BottomSheetModal>(null);
  const { control, handleSubmit, reset } = useForm<PeriodFormValues>({
    resolver: zodResolver(periodFormSchema),
    defaultValues: { name: '', periodType: 'month', startDate: new Date().toISOString(), endDate: new Date().toISOString() },
    mode: 'onTouched',
  });
  const back = () => router.back();
  const periods = query.data ?? [];

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Accounting periods" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const fail = (fallback: string) => (error: unknown) => toast.error(error instanceof ApiError ? error.message : fallback);
  const choose = (period: AccountingPeriodDTO, action: Action) => {
    actionsRef.current?.dismiss();
    setPending({ period, action });
    setTimeout(() => confirmRef.current?.present(), 250);
  };
  const run = () => {
    if (!pending) return;
    const { period, action } = pending;
    confirmRef.current?.dismiss();
    change.mutate({ id: period.id, action }, { onSuccess: () => toast.success(ACTION_COPY[action].done), onError: fail('Could not change the period. Try again.') });
  };
  const add = (values: PeriodFormValues) =>
    create.mutate(toPeriodPayload(values), {
      onSuccess: () => {
        addRef.current?.dismiss();
        reset();
        toast.success('Period added');
      },
      onError: fail('Could not add the period. Try again.'),
    });

  const options: { label: string; action: Action }[] = selected
    ? selected.status === 'OPEN'
      ? [{ label: 'Close this period', action: 'close' }]
      : selected.status === 'CLOSED'
        ? [
            { label: 'Open it again', action: 'reopen' },
            { label: 'Lock it for good', action: 'lock' },
          ]
        : []
    : [];

  return (
    <Screen edges={['top']} refreshing={query.isRefetching} onRefresh={() => query.refetch()}>
      <ScreenHeader
        title="Accounting periods"
        onBack={back}
        docsKey="AC1"
        rightActions={canManage ? <IconButton icon={Plus} accessibilityLabel="Add a period" onPress={() => addRef.current?.present()} testID="periods-new" /> : undefined}
      />

      {query.isPending ? (
        <View className="gap-3">
          <Skeleton width="100%" height={68} radius="md" />
          <Skeleton width="100%" height={68} radius="md" />
        </View>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : periods.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="No periods yet"
          description="Until you add a period, entries can be posted to any date. Add one for each month or year, then close it once it is settled."
          actionLabel={canManage ? 'Add a period' : undefined}
          onAction={canManage ? () => addRef.current?.present() : undefined}
        />
      ) : (
        <View className="gap-4 pb-8">
          <Text variant="caption" tone="secondary">
            A closed period takes no new entries. A locked one never will again.
          </Text>
          <View>
            {periods.map((p, i) => (
              <PeriodRow
                key={p.id}
                item={p}
                position={positionOf(i, periods.length)}
                onPress={
                  canManage && p.status !== 'LOCKED'
                    ? (item) => {
                        setSelected(item);
                        actionsRef.current?.present();
                      }
                    : undefined
                }
              />
            ))}
          </View>
        </View>
      )}

      <BottomSheet ref={actionsRef} title={selected ? selected.name : 'Period'} snapPoints={['35%']} onDismiss={() => undefined}>
        <View className="gap-3 pb-6">
          {selected ? (
            <Text variant="caption" tone="secondary">
              {PERIOD_STATUS_LABELS[selected.status]}
            </Text>
          ) : null}
          {options.map((o) => (
            <Button key={o.action} variant={o.action === 'lock' ? 'danger-ghost' : 'secondary'} fullWidth onPress={() => selected && choose(selected, o.action)} testID={`period-${o.action}`}>
              {o.label}
            </Button>
          ))}
        </View>
      </BottomSheet>

      <ConfirmSheet
        ref={confirmRef}
        title={pending ? ACTION_COPY[pending.action].title(pending.period.name) : 'Change this period?'}
        description={pending ? ACTION_COPY[pending.action].description : ''}
        confirmLabel={pending ? ACTION_COPY[pending.action].confirm : 'Confirm'}
        destructive={pending ? ACTION_COPY[pending.action].destructive : false}
        onConfirm={run}
        onDismiss={() => setPending(null)}
      />

      <BottomSheet ref={addRef} title="Add a period" snapPoints={['85%']} onDismiss={() => reset()}>
        <View className="gap-4 pb-8">
          <TextField control={control} name="name" label="Name" placeholder="October 2026" autoCapitalize="words" testID="period-name" />
          <SelectSheet control={control} name="periodType" label="Covers" options={PERIOD_TYPE_OPTIONS} />
          <DateField control={control} name="startDate" label="First day" mode="date" />
          <DateField control={control} name="endDate" label="Last day" mode="date" />
          <Button variant="primary" fullWidth loading={create.isPending} onPress={() => { void handleSubmit(add)(); }} testID="period-add">
            Add period
          </Button>
        </View>
      </BottomSheet>
    </Screen>
  );
}
