import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner-native';

import { ajoApi } from '@/api/endpoints/ajo';
import { ApiError } from '@/api/errors';
import { TextField } from '@/components/forms/TextField';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useTenantKey } from '@/hooks/useTenantKey';
import { ajoKeys } from '../queries';
import { phoneCodeSchema } from '../schemas';

/** Confirm a phone number with the code sent by text, for a circle that asks for it. */
export function PhoneConfirmCard({ membershipId }: { membershipId: number }) {
  const client = useQueryClient();
  const tenant = useTenantKey();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<'send' | 'confirm' | null>(null);
  const { control, handleSubmit } = useForm<{ code: string }>({ resolver: zodResolver(phoneCodeSchema), defaultValues: { code: '' } });

  const send = async () => {
    setBusy('send');
    setProblem(null);
    try {
      setSentTo((await ajoApi.sendPhoneCode(membershipId)).sentTo);
      toast.success('A code was sent by text.');
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'We could not send the code.');
    } finally {
      setBusy(null);
    }
  };
  const confirm = handleSubmit(async ({ code }) => {
    setBusy('confirm');
    setProblem(null);
    try {
      const done = await ajoApi.confirmPhoneCode(membershipId, code.trim());
      await client.invalidateQueries({ queryKey: ajoKeys.all(tenant) });
      toast.success(done.activation.activated ? 'Phone confirmed. You are in.' : 'Phone confirmed.');
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'That code did not work.');
    } finally {
      setBusy(null);
    }
  });

  return (
    <Card testID="ajo-phone-confirm">
      <View className="gap-3">
        <Text variant="h3">Confirm your phone number</Text>
        <Text variant="body" tone="secondary">
          This circle asks everyone to confirm their phone. We text a code to the number on file.
        </Text>
        {sentTo ? <Text variant="body">Code sent to {sentTo}. It stays valid for a short time.</Text> : null}
        {sentTo ? <TextField control={control} name="code" label="Code" keyboardType="number-pad" testID="ajo-phone-code" /> : null}
        {problem ? (
          <Text variant="body" tone="danger">
            {problem}
          </Text>
        ) : null}
        <View className="flex-row gap-3">
          <Button variant={sentTo ? 'secondary' : 'primary'} fullWidth loading={busy === 'send'} onPress={() => void send()} testID="ajo-phone-send">
            {sentTo ? 'Send a new code' : 'Send me a code'}
          </Button>
          {sentTo ? (
            <Button fullWidth loading={busy === 'confirm'} onPress={() => void confirm()} testID="ajo-phone-confirm-btn">
              Confirm
            </Button>
          ) : null}
        </View>
      </View>
    </Card>
  );
}
