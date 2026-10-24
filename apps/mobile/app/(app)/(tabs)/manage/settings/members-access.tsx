import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { Switch } from '@/components/forms/Switch';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { Text } from '@/components/ui/Text';
import { SaveFooter } from '@/features/settings/components/SaveFooter';
import { SettingsScreen } from '@/features/settings/components/SettingsScreen';
import { DEFAULT_ROLE_OPTIONS, inviteLifetimeLabel, SETTINGS_EDIT_ACCESS } from '@/features/settings/labels';
import { useSaveMembersAccess } from '@/features/settings/mutations';
import { useMembersAccessSettings } from '@/features/settings/queries';
import { membersAccessFormSchema, membersAccessToFormValues, toMembersAccessPayload, type MembersAccessFormValues } from '@/features/settings/schemas';
import { useCan } from '@/hooks/useCan';
import type { MembersAccessSettingsDTO } from '@/types/api/settings';

/** project-overview.md §6.9 ST6 — who can sign themselves up, the role they start with, how long invites last, and how member IDs are made. */
export default function MembersAccessScreen() {
  const query = useMembersAccessSettings();
  const allowed = useCan(SETTINGS_EDIT_ACCESS);
  return (
    <SettingsScreen title="Members and access" docsKey="ST6" allowed={allowed} query={query}>
      {(settings) => <MembersAccessForm settings={settings} />}
    </SettingsScreen>
  );
}

function MembersAccessForm({ settings }: { settings: MembersAccessSettingsDTO }) {
  const router = useRouter();
  const save = useSaveMembersAccess();
  const { control, handleSubmit, formState } = useForm<MembersAccessFormValues>({
    resolver: zodResolver(membersAccessFormSchema),
    defaultValues: membersAccessToFormValues(settings),
    mode: 'onTouched',
  });
  const selfSignup = useWatch({ control, name: 'selfSignupEnabled' });
  const autoId = useWatch({ control, name: 'memberIdAutoGenerate' });
  const hours = useWatch({ control, name: 'inviteExpiryHours' });

  const submit = (values: MembersAccessFormValues) =>
    save.mutate(toMembersAccessPayload(values), {
      onSuccess: () => {
        toast.success('Members and access saved');
        router.back();
      },
      onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not save. Try again.'),
    });

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title="Members and access" onBack={() => router.back()} docsKey="ST6" />

      <View className="gap-6 pb-6">
        <Section title="Signing up">
          <View className="gap-4">
            <Switch control={control} name="selfSignupEnabled" label="Let people sign themselves up" helper="Anyone with your association's address can ask to join" testID="access-signup" />
            {selfSignup ? <SelectSheet control={control} name="defaultRole" label="Role they start with" options={DEFAULT_ROLE_OPTIONS} /> : null}
            <Text variant="caption" tone="secondary">
              Every new sign-up waits for an officer to approve it under Members, Pending approvals. This cannot be switched off.
            </Text>
          </View>
        </Section>

        <Section title="Invites">
          <TextField
            control={control}
            name="inviteExpiryHours"
            label="An invite lasts, in hours"
            helper={/^\d+$/.test(hours ?? '') && Number(hours) > 0 ? `That is ${inviteLifetimeLabel(Number(hours))}` : 'For example 72 is 3 days'}
            keyboardType="number-pad"
            testID="access-invite-hours"
          />
        </Section>

        <Section title="Member IDs">
          <View className="gap-4">
            <Switch control={control} name="memberIdAutoGenerate" label="Make member IDs automatically" helper={autoId ? 'New members get the next number' : 'Officers type the ID when they add a member'} testID="access-auto-id" />
            {autoId ? <TextField control={control} name="memberIdPrefix" label="Start every ID with" placeholder="MEM" helper="1 to 8 letters or numbers. Blank uses MEM, like MEM0001." autoCapitalize="characters" testID="access-prefix" /> : null}
          </View>
        </Section>

        <Section title="Roles">
          <Switch control={control} name="allowMultipleRoles" label="Let a person hold several roles" helper="When off, giving someone a new role takes away the one they had" testID="access-multi-role" />
        </Section>
      </View>

      <SaveFooter
        loading={save.isPending}
        disabled={!formState.isDirty}
        onPress={() => {
          void handleSubmit(submit)();
        }}
        testID="access-save"
      />
    </Screen>
  );
}
