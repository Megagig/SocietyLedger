import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';
import { z } from 'zod';

import { ajoApi } from '@/api/endpoints/ajo';
import { ApiError } from '@/api/errors';
import { ErrorState } from '@/components/feedback/ErrorState';
import { AmountField } from '@/components/forms/AmountField';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FilterChip } from '@/components/ui/FilterChip';
import { Text } from '@/components/ui/Text';
import { formatDay, formatKobo, koboPositive, nairaToKobo, nairaToKoboString } from '../format';
import { useAjoAction } from '../mutations';
import { useCycle } from '../queries';
import { useAjoWrite } from './AjoGate';
import { AjoLoading } from './AjoStates';

const amountSchema = z.object({
  amount: z
    .string()
    .trim()
    .refine((v) => {
      const kobo = nairaToKobo(v);
      return kobo !== null && kobo > BigInt(0);
    }, 'Enter the amount in naira, for example 500 or 1,500.'),
});
type AmountValues = z.input<typeof amountSchema>;

/**
 * A collector-thrift saver's own cycle (spec §16.5): the amount they chose and keep for the whole cycle, what they brought forward, and,
 * once the cycle is about to end, the choice to withdraw or continue. No answer means withdraw, and the card says so.
 */
export function CycleCard({ membershipId }: { membershipId: number }) {
  const { canWrite } = useAjoWrite();
  const q = useCycle(membershipId);
  const [editing, setEditing] = useState(false);
  const [choice, setChoice] = useState<'WITHDRAW' | 'CONTINUE' | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const amountForm = useForm<AmountValues>({ resolver: zodResolver(amountSchema), defaultValues: { amount: '' }, mode: 'onTouched' });
  const nextForm = useForm<{ amount: string }>({ defaultValues: { amount: '' } });
  const setAmount = useAjoAction((amountKobo: string) => ajoApi.setAmount(membershipId, amountKobo));
  const decide = useAjoAction((input: { choice: 'WITHDRAW' | 'CONTINUE'; nextAmountKobo?: string }) => ajoApi.decideCycle(membershipId, input));

  if (q.isPending) return <AjoLoading rows={1} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const c = q.data;
  const picked = choice ?? (c.choice === 'PENDING' ? null : c.choice);

  const saveAmount = amountForm.handleSubmit(async (values) => {
    const amountKobo = nairaToKoboString(values.amount);
    if (!amountKobo) return;
    setProblem(null);
    try {
      await setAmount.mutateAsync(amountKobo);
      toast.success('Your amount was saved.');
      setEditing(false);
      amountForm.reset();
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'Could not save your amount.');
    }
  });

  const saveChoice = async () => {
    if (!picked) {
      setProblem('Choose to withdraw or to continue.');
      return;
    }
    let nextAmountKobo: string | undefined;
    if (picked === 'CONTINUE') {
      const typed = nextForm.getValues('amount').trim();
      const kobo = typed ? nairaToKoboString(typed) : (c.nextAmountKobo ?? c.amountKobo);
      if (!kobo) {
        setProblem('Enter the amount you will save next cycle, in naira.');
        return;
      }
      nextAmountKobo = kobo;
    }
    setProblem(null);
    try {
      await decide.mutateAsync({ choice: picked, nextAmountKobo });
      toast.success(picked === 'CONTINUE' ? 'You will continue into the next cycle.' : 'You will withdraw your savings when this cycle ends.');
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'Could not save your choice.');
    }
  };

  return (
    <Card testID="ajo-cycle-card">
      <View className="gap-3">
        <View className="gap-1">
          <Text variant="h3">Your savings cycle</Text>
          <Text variant="caption" tone="secondary">
            Cycle {c.cycleNo}: {formatDay(c.startsOn)}
            {c.endsOn ? ` to ${formatDay(c.endsOn)}` : ''}
          </Text>
        </View>

        <View className="gap-1">
          <Text variant="caption" tone="tertiary">
            You save each time
          </Text>
          <Text variant="h2">{formatKobo(c.amountKobo)}</Text>
          <Text variant="caption" tone="secondary">
            {c.canChangeAmount ? `You choose this. The smallest is ${formatKobo(c.minAmountKobo)}.` : 'It stays the same for the whole cycle.'}
          </Text>
        </View>

        {koboPositive(c.carriedKobo) ? (
          <View className="gap-1">
            <Text variant="caption" tone="tertiary">
              Brought forward from your last cycle
            </Text>
            <Text variant="body-strong">{formatKobo(c.carriedKobo)}</Text>
            <Text variant="caption" tone="secondary">
              Your savings after the collector&apos;s fee. It is paid to you with this cycle&apos;s savings.
            </Text>
          </View>
        ) : null}

        {canWrite && c.canChangeAmount && !editing ? (
          <Button variant="secondary" onPress={() => setEditing(true)} testID="ajo-cycle-change-amount">
            Change my amount
          </Button>
        ) : null}
        {editing ? (
          <View className="gap-3">
            <AmountField control={amountForm.control} name="amount" label="New amount each time" testID="ajo-cycle-amount" />
            <View className="flex-row gap-3">
              <Button variant="secondary" fullWidth onPress={() => { setEditing(false); setProblem(null); }}>
                Cancel
              </Button>
              <Button fullWidth loading={setAmount.isPending} onPress={() => void saveAmount()} testID="ajo-cycle-save-amount">
                Save
              </Button>
            </View>
          </View>
        ) : null}

        <View className="gap-3 border-t border-border pt-3">
          <Text variant="h3">When this cycle ends</Text>
          {c.payoutStarted ? (
            <Text variant="body">Your payout has started, so your choice can no longer change.</Text>
          ) : c.canDecide ? (
            <>
              <Text variant="body" tone="secondary">
                What would you like to do with your savings?
              </Text>
              <View className="flex-row gap-2">
                <FilterChip label="Withdraw them" active={picked === 'WITHDRAW'} onPress={() => setChoice('WITHDRAW')} />
                <FilterChip label="Continue" active={picked === 'CONTINUE'} onPress={() => setChoice('CONTINUE')} />
              </View>
              <Text variant="caption" tone="secondary">
                {picked === 'CONTINUE' ? 'Your savings stay in the group for the next cycle.' : 'Withdraw: your savings are paid to your payout account.'}
              </Text>
              {picked === 'CONTINUE' ? (
                <AmountField control={nextForm.control} name="amount" label="What will you save each time next cycle?" helper={`Leave empty to keep ${formatKobo(c.nextAmountKobo ?? c.amountKobo)}.`} testID="ajo-cycle-next-amount" />
              ) : null}
              <Text variant="caption" tone="secondary">
                {c.ifNoAnswer}
              </Text>
              {canWrite ? (
                <Button loading={decide.isPending} onPress={() => void saveChoice()} testID="ajo-cycle-save-choice">
                  Save my choice
                </Button>
              ) : null}
            </>
          ) : (
            <Text variant="body" tone="secondary">
              {c.promptOpensOn ? `From ${formatDay(c.promptOpensOn)} you can choose whether to withdraw or continue. ` : ''}
              {c.ifNoAnswer}
            </Text>
          )}
          {c.choice !== 'PENDING' && !c.payoutStarted ? (
            <Text variant="body">
              You have chosen to {c.choice === 'CONTINUE' ? `continue, saving ${formatKobo(c.nextAmountKobo ?? c.amountKobo)} each time` : 'withdraw'}
              {c.decidedVia === 'officer' ? ' (recorded for you by an officer)' : ''}.
            </Text>
          ) : null}
          {problem ? (
            <Text variant="body" tone="danger" testID="ajo-cycle-problem">
              {problem}
            </Text>
          ) : null}
        </View>
      </View>
    </Card>
  );
}
