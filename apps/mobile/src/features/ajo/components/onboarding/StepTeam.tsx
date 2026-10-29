import { THRIFT_ONBOARDING_TEAM_ROLES } from '@societyledger/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';

import { ajoApi } from '@/api/endpoints/ajo';
import { ApiError } from '@/api/errors';
import { TextField } from '@/components/forms/TextField';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import type { TeamInviteResult } from '@/types/api/ajo';
import { teamInviteSchema, type TeamInviteValues } from '../../schemas';
import { TickRow } from '../TickRow';

type Invite = TeamInviteValues & { role: string };

const SAYS: Record<TeamInviteResult['status'], string> = {
  invited: 'Invited. They have an email.',
  invited_email_failed: 'Invited, but the email could not be sent. Resend it from Members.',
  already_member: 'Already on file. Invite them from Members.',
  failed: 'Could not be invited.',
};

/**
 * Step 4 (optional): bring in the people who help. A collector-thrift circle needs a collector with a login, and payouts need a second
 * person to approve. The collector role is only offered when the circle is a collector-thrift one.
 */
export function StepTeam({ collectorCircle, hasCollector, onDone, onSkip }: { collectorCircle: boolean; hasCollector: boolean; onDone: () => Promise<void>; onSkip: () => Promise<void> }) {
  const roles = THRIFT_ONBOARDING_TEAM_ROLES.filter((r) => collectorCircle || r.value !== 'ajo_collector');
  const [role, setRole] = useState<string>(collectorCircle ? 'ajo_collector' : 'ajo_officer');
  const [invites, setInvites] = useState<Invite[]>([]);
  const [results, setResults] = useState<TeamInviteResult[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { control, handleSubmit, reset } = useForm<TeamInviteValues>({ resolver: zodResolver(teamInviteSchema), defaultValues: { firstName: '', lastName: '', email: '' } });

  const add = handleSubmit((values) => {
    setProblem(null);
    setInvites((prev) => (prev.length >= 20 ? prev : [...prev, { ...values, role }]));
    reset();
  });

  const send = async () => {
    if (invites.length === 0) {
      setProblem('Add at least one person, or continue without inviting anyone.');
      return;
    }
    setProblem(null);
    setBusy(true);
    try {
      const out = await ajoApi.inviteTeam(invites.map((i) => ({ firstName: i.firstName.trim(), lastName: i.lastName.trim(), email: i.email.trim(), role: i.role })));
      setResults(out.results);
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'We could not send the invites. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (results) {
    return (
      <View className="gap-4" testID="ajo-step-team-done">
        <Card>
          <View className="gap-2">
            {results.map((r) => (
              <View key={r.email} className="gap-0.5">
                <Text variant="body-strong">{r.email}</Text>
                <Text variant="caption" tone="secondary">
                  {r.message ?? SAYS[r.status]}
                </Text>
              </View>
            ))}
          </View>
        </Card>
        {collectorCircle ? (
          <Text variant="caption" tone="secondary">
            Once a collector accepts the invite, assign contributors to them from the circle&apos;s Collectors screen.
          </Text>
        ) : null}
        <Button
          loading={busy}
          onPress={() => {
            setBusy(true);
            void onDone().finally(() => setBusy(false));
          }}
          testID="ajo-team-continue"
        >
          Continue
        </Button>
      </View>
    );
  }

  return (
    <View className="gap-4" testID="ajo-step-team">
      {collectorCircle && !hasCollector ? (
        <View className="rounded-md bg-warning-soft p-3">
          <Text variant="caption" tone="warning">
            Your circle needs a collector. Invite one now, or add one later from Collectors.
          </Text>
        </View>
      ) : null}
      <Text variant="body" tone="secondary">
        One person prepares a payout and another approves it. With only one admin, every approval needs an extra confirmation, so a co-admin helps.
      </Text>
      {roles.map((r) => (
        <Text key={r.value} variant="caption" tone="secondary">
          {r.label}: {r.description}
        </Text>
      ))}

      <Card>
        <View className="gap-3">
          <Text variant="h3">Invite a person</Text>
          <View className="gap-2">
            <Text variant="label" tone="secondary">
              Role
            </Text>
            {roles.map((r) => (
              <TickRow key={r.value} label={r.label} checked={role === r.value} onToggle={() => setRole(r.value)} testID={`ajo-team-role-${r.value}`} />
            ))}
          </View>
          <TextField control={control} name="firstName" label="First name" autoCapitalize="words" testID="ajo-team-first" />
          <TextField control={control} name="lastName" label="Last name" autoCapitalize="words" testID="ajo-team-last" />
          <TextField control={control} name="email" label="Email" keyboardType="email-address" autoCapitalize="none" testID="ajo-team-email" />
          <Button variant="soft" onPress={() => void add()} testID="ajo-team-add">
            Add to the list
          </Button>
        </View>
      </Card>

      {invites.length > 0 ? (
        <View className="gap-2">
          {invites.map((i, at) => (
            <View key={`${i.email}-${at}`} className="flex-row items-center justify-between gap-3 rounded-lg bg-surface-sunken p-3">
              <View className="flex-1">
                <Text variant="body-strong">
                  {i.firstName} {i.lastName}
                </Text>
                <Text variant="caption" tone="tertiary">
                  {i.email} · {roles.find((r) => r.value === i.role)?.label}
                </Text>
              </View>
              <Button size="sm" variant="ghost" onPress={() => setInvites((prev) => prev.filter((_, idx) => idx !== at))}>
                Remove
              </Button>
            </View>
          ))}
        </View>
      ) : null}

      {problem ? (
        <Text variant="body" tone="danger">
          {problem}
        </Text>
      ) : null}
      <View className="flex-row gap-3">
        <Button
          variant="secondary"
          fullWidth
          disabled={busy}
          onPress={() => {
            setBusy(true);
            void onSkip().finally(() => setBusy(false));
          }}
          testID="ajo-team-skip"
        >
          Skip this step
        </Button>
        <Button fullWidth loading={busy} onPress={() => void send()} testID="ajo-team-send">
          Send invites
        </Button>
      </View>
    </View>
  );
}
