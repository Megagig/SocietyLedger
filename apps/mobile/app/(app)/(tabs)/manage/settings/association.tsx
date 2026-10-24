import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { LogoEditor } from '@/features/settings/components/LogoEditor';
import { SaveFooter } from '@/features/settings/components/SaveFooter';
import { SettingsScreen } from '@/features/settings/components/SettingsScreen';
import { ASSOCIATION_TYPE_OPTIONS, SETTINGS_EDIT_ACCESS } from '@/features/settings/labels';
import { useSaveProfile } from '@/features/settings/mutations';
import { useAssociationProfile } from '@/features/settings/queries';
import { profileFormSchema, profileToFormValues, toProfilePayload, type ProfileFormValues } from '@/features/settings/schemas';
import { useCan } from '@/hooks/useCan';
import type { AssociationProfileDTO } from '@/types/api/settings';

/** project-overview.md §6.9 ST2 — the association's name, logo, colour and contact details. */
export default function AssociationProfileScreen() {
  const query = useAssociationProfile();
  const allowed = useCan(SETTINGS_EDIT_ACCESS);
  return (
    <SettingsScreen title="Association profile" docsKey="ST2" allowed={allowed} query={query}>
      {(profile) => <ProfileForm profile={profile} />}
    </SettingsScreen>
  );
}

function ProfileForm({ profile }: { profile: AssociationProfileDTO }) {
  const router = useRouter();
  const save = useSaveProfile();
  const { control, handleSubmit, formState } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: profileToFormValues(profile),
    mode: 'onTouched',
  });

  const submit = (values: ProfileFormValues) =>
    save.mutate(toProfilePayload(values), {
      onSuccess: () => {
        toast.success('Profile saved');
        router.back();
      },
      onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not save the profile. Try again.'),
    });

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title="Association profile" onBack={() => router.back()} docsKey="ST2" />

      <View className="gap-6 pb-6">
        <Section title="Logo">
          <LogoEditor name={profile.name} logo={profile.logo} tintColor={profile.primaryColor} />
        </Section>

        <Section title="About the association">
          <View className="gap-4">
            <TextField control={control} name="name" label="Name" autoCapitalize="words" testID="profile-name" />
            <SelectSheet control={control} name="associationType" label="Type" options={ASSOCIATION_TYPE_OPTIONS} />
            <TextField control={control} name="primaryColor" label="Brand colour" placeholder="#1a7f5a" helper="Used behind your initials when there is no logo. Leave blank for the default." testID="profile-colour" />
          </View>
        </Section>

        <Section title="Contact details">
          <View className="gap-4">
            <TextField control={control} name="phone" label="Phone" keyboardType="phone-pad" testID="profile-phone" />
            <TextField control={control} name="email" label="Email" keyboardType="email-address" testID="profile-email" />
            <TextField control={control} name="website" label="Website" placeholder="https://" keyboardType="url" testID="profile-website" />
          </View>
        </Section>

        <Section title="Address">
          <View className="gap-4">
            <TextField control={control} name="address" label="Street address" autoCapitalize="sentences" />
            <TextField control={control} name="city" label="City" autoCapitalize="words" />
            <TextField control={control} name="state" label="State" autoCapitalize="words" />
            <TextField control={control} name="country" label="Country" autoCapitalize="words" />
          </View>
        </Section>
      </View>

      <SaveFooter
        loading={save.isPending}
        disabled={!formState.isDirty}
        onPress={() => {
          void handleSubmit(submit)();
        }}
        testID="profile-save"
      />
    </Screen>
  );
}
