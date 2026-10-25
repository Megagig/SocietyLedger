import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner-native';
import { MAX_TEAM_INVITES, ONBOARDING_TEAM_ROLES, onboardingTeamInviteSchema } from '@societyledger/shared';

import { ApiError } from '@/api/errors';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { TextField } from '@/components/forms/TextField';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { StepFrame } from '@/features/onboarding/components/StepFrame';
import { useCompleteStep, useInviteTeam } from '@/features/onboarding/mutations';
import type { TeamInviteResultDTO, TeamInviteStatus } from '@/types/api/onboarding';

type Row = { firstName: string; lastName: string; email: string; role: string };
type FormValues = { rows: Row[] };

const emptyRow = (): Row => ({ firstName: '', lastName: '', email: '', role: 'treasurer' });
const ROLE_OPTIONS = ONBOARDING_TEAM_ROLES.map((r) => ({ label: `${r.label} — ${r.description}`, value: r.value as string }));

const STATUS_TEXT: Record<TeamInviteStatus, string> = {
  invited: 'Invitation sent',
  invited_email_failed: 'Added, but the email could not be sent. Resend it from Members.',
  already_member: 'Already a member',
  failed: 'Could not be invited',
};

/** O4 — invite the officers who will help run the association. Each becomes a member, gets an emailed invite, and receives the chosen role
 * when they accept. */
export default function SetupTeamScreen() {
  const invite = useInviteTeam();
  const complete = useCompleteStep();
  const [results, setResults] = useState<TeamInviteResultDTO['results'] | null>(null);
  const { control, getValues } = useForm<FormValues>({ defaultValues: { rows: [emptyRow()] } });
  const { fields, append, remove } = useFieldArray({ control, name: 'rows' });

  const goNext = () => router.replace('/(app)/onboarding/members');
  const fail = (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Something went wrong. Try again.');
  const anyInvited = (results ?? []).some((r) => r.status === 'invited' || r.status === 'invited_email_failed');

  function send() {
    // Rows left completely empty are ignored.
    const filled = getValues('rows').filter((r) => r.firstName.trim() || r.lastName.trim() || r.email.trim());
    if (filled.length === 0) {
      toast.error('Add at least one person, or skip this step.');
      return;
    }
    const checked = onboardingTeamInviteSchema.safeParse({ invites: filled });
    if (!checked.success) {
      toast.error(checked.error.issues[0]?.message ?? 'Please check the details');
      return;
    }
    invite.mutate(checked.data, {
      onSuccess: ({ results: outcome }) => {
        setResults(outcome);
        // Finished only when someone was really invited; otherwise they stay here to fix what went wrong.
        if (outcome.some((r) => r.status === 'invited' || r.status === 'invited_email_failed')) {
          complete.mutate({ step: 2, stepName: 'team' }, { onError: fail });
        } else {
          toast.error('Nobody could be invited. Check the messages below.');
        }
      },
      onError: fail,
    });
  }

  return (
    <StepFrame
      stepKey="team"
      title="Invite your team"
      description="Add the officers who will help manage the association. They get an email to set their password."
      primaryLabel={anyInvited ? 'Continue' : 'Send invites'}
      primaryLoading={invite.isPending}
      onPrimary={anyInvited ? goNext : send}
      skipLoading={complete.isPending && complete.variables?.skipped === true}
      onSkip={anyInvited ? undefined : () => complete.mutate({ step: 2, stepName: 'team', skipped: true }, { onSuccess: goNext, onError: fail })}
    >
      {results ? (
        <Card>
          <View className="gap-3">
            {results.map((r) => (
              <View key={r.email} className="gap-1">
                <Text variant="body-strong">{r.email}</Text>
                <Text variant="caption" tone={r.status === 'invited' ? 'success' : 'warning'}>{r.message ?? STATUS_TEXT[r.status]}</Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {!anyInvited ? (
        <View className="gap-6">
          {fields.map((field, index) => (
            <View key={field.id} className="gap-3">
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <TextField control={control} name={`rows.${index}.firstName`} label="First name" autoCapitalize="words" returnKeyType="next" testID={`team-first-name-${index}`} />
                </View>
                <View className="flex-1">
                  <TextField control={control} name={`rows.${index}.lastName`} label="Last name" autoCapitalize="words" returnKeyType="next" testID={`team-last-name-${index}`} />
                </View>
              </View>
              <TextField control={control} name={`rows.${index}.email`} label="Email" keyboardType="email-address" returnKeyType="next" testID={`team-email-${index}`} />
              <SelectSheet control={control} name={`rows.${index}.role`} label="Role" options={ROLE_OPTIONS} testID={`team-role-${index}`} />
              {fields.length > 1 ? (
                <Button variant="danger-ghost" size="sm" onPress={() => remove(index)} testID={`team-remove-${index}`}>
                  Remove this person
                </Button>
              ) : null}
            </View>
          ))}
          {fields.length < MAX_TEAM_INVITES ? (
            <Button variant="soft" onPress={() => append(emptyRow())} testID="team-add-another">
              Add another person
            </Button>
          ) : null}
        </View>
      ) : null}
    </StepFrame>
  );
}
