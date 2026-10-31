import { zodResolver } from '@hookform/resolvers/zod';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { toast } from 'sonner-native';

import { ajoApi } from '@/api/endpoints/ajo';
import { ApiError } from '@/api/errors';
import { Checkbox } from '@/components/forms/Checkbox';
import { PasswordField } from '@/components/forms/PasswordField';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import type { PayoutDTO } from '@/types/api/ajo';
import { koboPositive } from '../format';
import { useAjoAction } from '../mutations';
import { approvePayoutSchema, MIN_SELF_NOTE, type ApprovePayoutValues } from '../schemas';
import { AjoMoney } from './AjoMoney';

export type ApprovePayoutSheetHandle = { open: (payout: PayoutDTO) => void };

/**
 * The highest-risk step. The person sees exactly who is paid, how much and to which account, and types their password again — the
 * server checks it, so a script that skips this sheet is stopped too. Approving sends no money.
 */
export const ApprovePayoutSheet = forwardRef<ApprovePayoutSheetHandle>(function ApprovePayoutSheet(_props, ref) {
  const sheet = useRef<BottomSheetModal>(null);
  const [payout, setPayout] = useState<PayoutDTO | null>(null);
  const [needsSelf, setNeedsSelf] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const { control, handleSubmit, reset, setValue } = useForm<ApprovePayoutValues>({ resolver: zodResolver(approvePayoutSchema), defaultValues: { password: '', self: false, note: '' } });
  const self = useWatch({ control, name: 'self' });
  const note = useWatch({ control, name: 'note' }) ?? '';
  const approve = useAjoAction((input: { id: number; body: Parameters<typeof ajoApi.approvePayout>[1] }) => ajoApi.approvePayout(input.id, input.body));

  useImperativeHandle(
    ref,
    () => ({
      open: (next) => {
        setPayout(next);
        sheet.current?.present();
      },
    }),
    [],
  );

  const submit = handleSubmit(async (values) => {
    if (!payout) return;
    setProblem(null);
    try {
      await approve.mutateAsync({ id: payout.id, body: { password: values.password, confirmSelfApproval: values.self || undefined, note: (values.note ?? '').trim() || undefined } });
      toast.success('Approved. An officer can now pay it and record the bank reference.');
      sheet.current?.dismiss();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'SELF_APPROVAL_NEEDS_CONFIRMATION') setNeedsSelf(error.message);
      else setProblem(error instanceof ApiError ? error.message : 'Could not approve the payout.');
      // A wrong password is retyped, never kept on screen.
      setValue('password', '');
    }
  });

  return (
    <BottomSheet
      ref={sheet}
      title="Approve this payout"
      snapPoints={['92%']}
      onDismiss={() => {
        reset();
        setNeedsSelf(null);
        setProblem(null);
      }}
    >
      {payout ? (
        <View className="gap-4 pb-6">
          <View className="gap-2 rounded-lg bg-surface-sunken p-3" testID="ajo-approve-facts">
            <View className="flex-row justify-between gap-3">
              <Text variant="caption" tone="tertiary">
                Pay
              </Text>
              <Text variant="body-strong" className="flex-1" align="right">
                {payout.recipient}
                {payout.round ? ` · round ${payout.round}` : ''}
              </Text>
            </View>
            <View className="flex-row items-center justify-between gap-3">
              <Text variant="caption" tone="tertiary">
                Amount
              </Text>
              <AjoMoney kobo={payout.netKobo} size="h3" />
            </View>
            <View className="flex-row justify-between gap-3">
              <Text variant="caption" tone="tertiary">
                To account
              </Text>
              <Text variant="body-strong" className="flex-1" align="right">
                {payout.account.bankName} · {payout.account.accountName} · {payout.account.masked}
              </Text>
            </View>
            {koboPositive(payout.shortfallKobo) ? (
              <View className="flex-row items-center justify-between gap-3">
                <Text variant="caption" tone="danger">
                  Short by
                </Text>
                <AjoMoney kobo={payout.shortfallKobo} tone="danger" />
              </View>
            ) : null}
          </View>
          <Text variant="caption" tone="tertiary">
            Approving does not send any money. After approval an officer pays it from the circle&apos;s own bank account and records the bank reference.
          </Text>
          {needsSelf ? (
            <View className="gap-2 rounded-md bg-warning-soft p-3">
              <Text variant="caption" tone="warning">
                {needsSelf}
              </Text>
              <Checkbox control={control} name="self" label="I am the only admin, and I checked this myself." testID="ajo-approve-self" />
              <TextField control={control} name="note" label="Note" multiline testID="ajo-approve-note" />
            </View>
          ) : null}
          <PasswordField control={control} name="password" label="Your password" helper="Typed again to be sure it is you." testID="ajo-approve-password" />
          {problem ? (
            <Text variant="body" tone="danger" testID="ajo-approve-problem">
              {problem}
            </Text>
          ) : null}
          <View className="flex-row gap-3">
            <Button variant="secondary" fullWidth disabled={approve.isPending} onPress={() => sheet.current?.dismiss()}>
              Cancel
            </Button>
            <Button fullWidth loading={approve.isPending} disabled={needsSelf !== null && (!self || note.trim().length < MIN_SELF_NOTE)} onPress={() => void submit()} testID="ajo-approve-submit">
              Approve payout
            </Button>
          </View>
        </View>
      ) : null}
    </BottomSheet>
  );
});
