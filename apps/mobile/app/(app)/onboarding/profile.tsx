import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ErrorState } from '@/components/feedback/ErrorState';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { Skeleton } from '@/components/ui/Skeleton';
import { SETUP_HREF } from '@/features/session/landing';
import { ColourSwatches } from '@/features/onboarding/components/ColourSwatches';
import { StepFrame } from '@/features/onboarding/components/StepFrame';
import { useCompleteStep } from '@/features/onboarding/mutations';
import { LogoEditor } from '@/features/settings/components/LogoEditor';
import { useSaveProfile } from '@/features/settings/mutations';
import { useAssociationProfile } from '@/features/settings/queries';
import { profileFormSchema, profileToFormValues, toProfilePayload, type ProfileFormValues } from '@/features/settings/schemas';
import type { AssociationProfileDTO } from '@/types/api/settings';

/** O1 — the association's logo, name, brand colour and contact details. Saved through the same settings routes as Manage > Settings. */
export default function SetupProfileScreen() {
  const query = useAssociationProfile();

  if (query.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Association profile" onBack={() => router.replace(SETUP_HREF)} docsKey="O1" />
        <View className="gap-4">
          <Skeleton width="100%" height={52} radius="md" />
          <Skeleton width="100%" height={52} radius="md" />
          <Skeleton width="100%" height={52} radius="md" />
        </View>
      </Screen>
    );
  }
  if (query.isError) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Association profile" onBack={() => router.replace(SETUP_HREF)} docsKey="O1" />
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </Screen>
    );
  }
  return <ProfileStep profile={query.data} />;
}

function ProfileStep({ profile }: { profile: AssociationProfileDTO }) {
  const save = useSaveProfile();
  const complete = useCompleteStep();
  const { control, handleSubmit, setValue } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: profileToFormValues(profile),
    mode: 'onTouched',
  });
  const colour = useWatch({ control, name: 'primaryColor' }) ?? '';

  const goNext = () => router.replace('/(app)/onboarding/team');
  const fail = (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Something went wrong. Try again.');

  const submit = (values: ProfileFormValues) =>
    save.mutate(toProfilePayload(values), {
      onSuccess: () => complete.mutate({ step: 1, stepName: 'profile' }, { onSuccess: goNext, onError: fail }),
      onError: fail,
    });

  return (
    <StepFrame
      stepKey="profile"
      title="Association profile"
      description="Add your logo and contact details so members recognise you."
      primaryLabel="Save and continue"
      primaryLoading={save.isPending || complete.isPending}
      onPrimary={() => void handleSubmit(submit)()}
      skipLoading={complete.isPending && complete.variables?.skipped === true}
      onSkip={() => complete.mutate({ step: 1, stepName: 'profile', skipped: true }, { onSuccess: goNext, onError: fail })}
    >
      <Section title="Logo">
        <LogoEditor name={profile.name} logo={profile.logo} tintColor={profile.primaryColor} />
      </Section>

      <Section title="About the association">
        <View className="gap-4">
          <TextField control={control} name="name" label="Name" autoCapitalize="words" testID="setup-profile-name" />
          <ColourSwatches value={colour} onChange={(hex) => setValue('primaryColor', hex, { shouldDirty: true, shouldValidate: true })} />
        </View>
      </Section>

      <Section title="Contact details">
        <View className="gap-4">
          <TextField control={control} name="phone" label="Phone" keyboardType="phone-pad" testID="setup-profile-phone" />
          <TextField control={control} name="email" label="Email" keyboardType="email-address" testID="setup-profile-email" />
          <TextField control={control} name="address" label="Address" autoCapitalize="sentences" testID="setup-profile-address" />
        </View>
      </Section>
    </StepFrame>
  );
}
