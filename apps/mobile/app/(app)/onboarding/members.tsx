import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { TextField } from '@/components/forms/TextField';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { StepFrame } from '@/features/onboarding/components/StepFrame';
import { useCompleteStep } from '@/features/onboarding/mutations';
import { GENDER_OPTIONS, quickMemberSchema, toMemberPayload, type QuickMemberFormValues } from '@/features/onboarding/schemas';
import { useCreateMember } from '@/features/members/mutations';

/** O3 — add members one at a time. A long list is better imported from the web, so this says so. */
export default function SetupMembersScreen() {
  const createMember = useCreateMember();
  const complete = useCompleteStep();
  const [added, setAdded] = useState<string[]>([]);
  const { control, handleSubmit, reset } = useForm<QuickMemberFormValues>({
    resolver: zodResolver(quickMemberSchema),
    defaultValues: { firstName: '', lastName: '', phone: '', email: '', gender: 'male' },
    mode: 'onTouched',
  });

  const goNext = () => router.replace('/(app)/onboarding/finance');
  const fail = (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Something went wrong. Try again.');

  const addMember = (values: QuickMemberFormValues) =>
    createMember.mutate(toMemberPayload(values), {
      onSuccess: () => {
        setAdded((list) => [...list, `${values.firstName.trim()} ${values.lastName.trim()}`]);
        reset({ firstName: '', lastName: '', phone: '', email: '', gender: values.gender });
        toast.success('Member added');
      },
      onError: fail,
    });

  // Continue with nobody added counts as skipping, so the final checklist stays honest.
  const finish = () =>
    complete.mutate(added.length > 0 ? { step: 3, stepName: 'members' } : { step: 3, stepName: 'members', skipped: true }, { onSuccess: goNext, onError: fail });

  return (
    <StepFrame
      stepKey="members"
      title="Add your members"
      description="Add the people in your association. Have a long list? Skip this and import it from the web later."
      primaryLabel={added.length > 0 ? 'Save and continue' : 'Continue'}
      primaryLoading={complete.isPending && complete.variables?.skipped !== true}
      onPrimary={finish}
      skipLoading={complete.isPending && complete.variables?.skipped === true}
      onSkip={() => complete.mutate({ step: 3, stepName: 'members', skipped: true }, { onSuccess: goNext, onError: fail })}
    >
      {added.length > 0 ? (
        <Card>
          <Text variant="body-strong">{`${added.length} added`}</Text>
          <Text variant="caption" tone="secondary" className="mt-1">{added.join(', ')}</Text>
        </Card>
      ) : null}

      <View className="gap-4">
        <View className="flex-row gap-3">
          <View className="flex-1">
            <TextField control={control} name="firstName" label="First name" autoCapitalize="words" returnKeyType="next" testID="setup-member-first-name" />
          </View>
          <View className="flex-1">
            <TextField control={control} name="lastName" label="Last name" autoCapitalize="words" returnKeyType="next" testID="setup-member-last-name" />
          </View>
        </View>
        <SelectSheet control={control} name="gender" label="Gender" options={GENDER_OPTIONS} testID="setup-member-gender" />
        <TextField control={control} name="phone" label="Phone (optional)" keyboardType="phone-pad" returnKeyType="next" testID="setup-member-phone" />
        <TextField control={control} name="email" label="Email (optional)" keyboardType="email-address" returnKeyType="done" testID="setup-member-email" />
        <Button variant="soft" loading={createMember.isPending} onPress={() => void handleSubmit(addMember)()} testID="setup-add-member">
          Add this member
        </Button>
      </View>
    </StepFrame>
  );
}
