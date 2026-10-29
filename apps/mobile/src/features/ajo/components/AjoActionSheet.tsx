import { zodResolver } from '@hookform/resolvers/zod';
import { forwardRef, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner-native';
import { z } from 'zod';

import { ApiError } from '@/api/errors';
import { PasswordField } from '@/components/forms/PasswordField';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useTenantKey } from '@/hooks/useTenantKey';
import { ajoKeys } from '../queries';

export type AjoActionValues = { reason: string; password: string };

export type AjoActionSheetProps = {
  title: string;
  /** What is about to happen, in plain words, with the names and amounts the person is deciding about. */
  summary?: string;
  confirmLabel: string;
  /** Anything that cannot be quietly undone is a danger button. */
  destructive?: boolean;
  /** Ask for a written reason of at least this many characters. */
  reasonMin?: number;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  /** Ask the person to type their password again (payout approval and reversal, closing a case): the server checks it. */
  needPassword?: boolean;
  /** Extra fields (a choice, a checkbox) shown between the summary and the reason. */
  children?: ReactNode;
  /** A check that runs before sending; return the problem in plain words, or null. */
  validate?: () => string | null;
  onConfirm: (values: AjoActionValues) => Promise<unknown>;
  successMessage: string;
  onDone?: () => void;
  onDismiss?: () => void;
  snapPoints?: (string | number)[];
  testID?: string;
};

/**
 * One confirmation for every sensitive Ajo action. It shows what is about to happen, collects a reason and/or the person's
 * password, says exactly why the server refused if it did, and never closes on failure — a wrong password stays on the sheet so it
 * can be retyped. Same job as the web's ActionDialog.
 */
export const AjoActionSheet = forwardRef<BottomSheetModal, AjoActionSheetProps>(function AjoActionSheet(
  { title, summary, confirmLabel, destructive = false, reasonMin, reasonLabel = 'Reason', reasonPlaceholder, needPassword, children, validate, onConfirm, successMessage, onDone, onDismiss, snapPoints, testID = 'ajo-action' },
  ref,
) {
  const localRef = useRef<BottomSheetModal>(null);
  useImperativeHandle(ref, () => localRef.current as BottomSheetModal, []);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const tenant = useTenantKey();

  const schema = useMemo(
    () =>
      z.object({
        reason: reasonMin ? z.string().trim().min(reasonMin, `Write at least ${reasonMin} characters. It stays on the record.`).max(500, 'Keep it under 500 characters') : z.string().optional().default(''),
        password: needPassword ? z.string().min(1, 'Enter your password to confirm this.') : z.string().optional().default(''),
      }),
    [reasonMin, needPassword],
  );
  type Values = z.input<typeof schema>;
  const { control, handleSubmit, reset, setValue } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { reason: '', password: '' }, mode: 'onTouched' });

  const submit = handleSubmit(async (values) => {
    const own = validate?.();
    if (own) {
      setProblem(own);
      return;
    }
    setProblem(null);
    setBusy(true);
    try {
      await onConfirm({ reason: (values.reason ?? '').trim(), password: values.password ?? '' });
      // Whatever just changed, every Ajo screen fetches again so no figure is stale.
      await queryClient.invalidateQueries({ queryKey: ajoKeys.all(tenant) });
      toast.success(successMessage);
      localRef.current?.dismiss();
      onDone?.();
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
      // A wrong password is retyped, never kept on screen.
      if (needPassword) setValue('password', '');
    } finally {
      setBusy(false);
    }
  });

  return (
    <BottomSheet
      ref={localRef}
      title={title}
      snapPoints={snapPoints ?? ['85%']}
      onDismiss={() => {
        reset();
        setProblem(null);
        onDismiss?.();
      }}
    >
      <View className="gap-4 pb-6">
        {summary ? (
          <Text variant="body" tone="secondary">
            {summary}
          </Text>
        ) : null}
        {children}
        {reasonMin ? <TextField control={control} name="reason" label={reasonLabel} placeholder={reasonPlaceholder} multiline testID={`${testID}-reason`} /> : null}
        {needPassword ? <PasswordField control={control} name="password" label="Your password" helper="Typed again to be sure it is you." testID={`${testID}-password`} /> : null}
        {problem ? (
          <Text variant="body" tone="danger" accessibilityLabel={problem} testID={`${testID}-problem`}>
            {problem}
          </Text>
        ) : null}
        <View className="flex-row gap-3">
          <Button variant="secondary" fullWidth disabled={busy} onPress={() => localRef.current?.dismiss()}>
            Cancel
          </Button>
          <Button variant={destructive ? 'danger' : 'primary'} fullWidth loading={busy} onPress={() => void submit()} testID={`${testID}-confirm`}>
            {confirmLabel}
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
});
