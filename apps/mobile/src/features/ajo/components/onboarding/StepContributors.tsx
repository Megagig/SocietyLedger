import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { ajoApi } from '@/api/endpoints/ajo';
import { ApiError } from '@/api/errors';
import { TextField } from '@/components/forms/TextField';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { BulkResultDTO, GroupDetailDTO, GroupListItemDTO } from '@/types/api/ajo';
import { blankRow, contributorRowProblem, duplicatePhones, normalizeNigerianPhone, type ContributorRow } from '../../contributorRows';
import { ajoKeys, useAjoStatus } from '../../queries';
import { AjoStatusBadge } from '../AjoStatusBadge';
import { TickRow } from '../TickRow';

/**
 * Step 3: create the people, put them in the circle and approve them. A new group has nobody on file yet, so this is where they are
 * made. On the phone they are typed in one at a time (a long list is better added on the web, where it can be uploaded as a file).
 * The server answers for every row on its own and a repeated list adds nobody twice.
 */
export function StepContributors({
  circles,
  circleId,
  onChooseCircle,
  group,
  guarantorRequired,
  onDone,
  onSkip,
}: {
  circles: GroupListItemDTO[];
  circleId: number | null;
  onChooseCircle: (id: number) => void;
  group: GroupDetailDTO | undefined;
  guarantorRequired: boolean;
  onDone: () => Promise<void>;
  onSkip: () => Promise<void>;
}) {
  const router = useRouter();
  const client = useQueryClient();
  const tenant = useTenantKey();
  const status = useAjoStatus();
  const [rows, setRows] = useState<ContributorRow[]>([]);
  const [approve, setApprove] = useState(true);
  const [onBehalf, setOnBehalf] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [rowProblem, setRowProblem] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<(BulkResultDTO & { invited: number }) | null>(null);
  const { control, getValues, reset } = useForm<ContributorRow>({ defaultValues: blankRow() });

  const rotating = group?.model === 'ROTATING_POT';
  const maxShares = rotating ? (group?.maxSharesPerMember ?? 1) : null;
  const dupes = duplicatePhones(rows);
  const goodRows = rows.filter((r, i) => !contributorRowProblem(r, maxShares) && !dupes[i]);
  const limit = status.data?.kind === 'ok' ? status.data.status.contributors : null;
  const room = limit && limit.remaining !== null ? limit.remaining : null;
  const overLimit = approve && room !== null && goodRows.length > room;

  const addRow = () => {
    const next = getValues();
    const why = contributorRowProblem(next, maxShares);
    if (why) {
      setRowProblem(why);
      return;
    }
    const key = normalizeNigerianPhone(next.phone);
    if (rows.some((r) => normalizeNigerianPhone(r.phone) === key)) {
      setRowProblem('That phone number is already in your list.');
      return;
    }
    setRowProblem(null);
    setRows((prev) => [...prev, next]);
    reset(blankRow());
  };

  const submit = async () => {
    if (!circleId) {
      setProblem('Create a circle first (step 2), or skip this step.');
      return;
    }
    if (goodRows.length === 0) {
      setProblem('Add at least one person with a name and phone number.');
      return;
    }
    if (overLimit) {
      setProblem(`Your plan has room for ${room} more contributor${room === 1 ? '' : 's'}. Remove some, or move to a bigger tier first.`);
      return;
    }
    setProblem(null);
    setBusy(true);
    try {
      const items = goodRows.map((r) => ({ firstName: r.firstName, lastName: r.lastName, phone: r.phone, address: r.address, email: r.email, ...(maxShares !== null && r.shares.trim() ? { shares: Number(r.shares) } : {}) }));
      const result = await ajoApi.bulkAdd(circleId, { items, approve, acceptRulesOnBehalf: onBehalf });
      // Login links go only to people who were really added and gave an email address.
      let invited = 0;
      if (sendEmail) {
        for (const r of result.results) {
          const email = goodRows[r.row - 1]?.email.trim();
          if (r.memberId && email && (r.status === 'added' || r.status === 'already_in_group')) {
            try {
              await ajoApi.inviteToLogin(r.memberId, email);
              invited++;
            } catch {
              /* they can be invited later from Members */
            }
          }
        }
      }
      await client.invalidateQueries({ queryKey: ajoKeys.all(tenant) });
      setOutcome({ ...result, invited });
      setRows([]);
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'We could not add these people. Nothing was lost; try again.');
    } finally {
      setBusy(false);
    }
  };

  if (outcome) {
    const bad = outcome.results.filter((r) => r.status === 'invalid' || r.status === 'failed' || (r.message && !r.active));
    const draft = group?.status === 'DRAFT';
    return (
      <View className="gap-4" testID="ajo-step-contributors-done">
        <View className="gap-1 rounded-lg bg-success-soft p-4">
          <Text variant="h3" tone="success">
            {outcome.summary.added} added · {outcome.summary.approved} approved · {outcome.summary.active} active
            {draft && outcome.summary.approved > 0 ? ' (they become active when you open the circle)' : ''}
          </Text>
          {outcome.summary.alreadyIn > 0 ? (
            <Text variant="caption" tone="success">
              {outcome.summary.alreadyIn} {outcome.summary.alreadyIn === 1 ? 'was' : 'were'} already in the circle and nothing was repeated.
            </Text>
          ) : null}
          {outcome.invited > 0 ? (
            <Text variant="caption" tone="success">
              {outcome.invited} login link{outcome.invited === 1 ? '' : 's'} sent by email.
            </Text>
          ) : null}
        </View>
        <Text variant="caption" tone="secondary">
          &quot;0 active&quot; is not an error. A person becomes active once the circle has approved them, they have accepted the rules{guarantorRequired ? ', their guarantor is recorded' : ''}
          {group?.requirePhoneConfirm ? ', they have confirmed their phone' : ''}, and the circle is open. Before anyone can be paid out, SocietyLedger also checks their name, phone, address and payout account.
        </Text>
        {bad.length > 0 ? (
          <View className="gap-1 rounded-lg bg-warning-soft p-3">
            <Text variant="label" tone="warning">
              {bad.length} need attention
            </Text>
            {bad.map((r) => (
              <Text key={r.row} variant="caption" tone="warning">
                • {r.name}: {r.message}
              </Text>
            ))}
          </View>
        ) : null}
        <View className="flex-row gap-3">
          <Button variant="secondary" fullWidth onPress={() => setOutcome(null)}>
            Add more people
          </Button>
          <Button
            fullWidth
            loading={busy}
            onPress={() => {
              setBusy(true);
              void onDone().finally(() => setBusy(false));
            }}
            testID="ajo-contributors-continue"
          >
            Continue
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View className="gap-4" testID="ajo-step-contributors">
      {circles.length > 1 ? (
        <View className="gap-2">
          <Text variant="label" tone="secondary">
            Add them to
          </Text>
          {circles.map((g) => (
            <TickRow key={g.id} label={g.name} checked={g.id === circleId} onToggle={() => onChooseCircle(g.id)} />
          ))}
        </View>
      ) : null}
      {!circleId ? (
        <View className="rounded-md bg-warning-soft p-3">
          <Text variant="caption" tone="warning">
            You have no circle yet. Go back to step 2, or skip this step and add people later.
          </Text>
        </View>
      ) : null}

      <Card>
        <View className="gap-3">
          <Text variant="h3">Add a person</Text>
          <TextField control={control} name="firstName" label="First name" autoCapitalize="words" testID="ajo-contributor-first" />
          <TextField control={control} name="lastName" label="Last name" autoCapitalize="words" testID="ajo-contributor-last" />
          <TextField control={control} name="phone" label="Phone" keyboardType="phone-pad" testID="ajo-contributor-phone" />
          <TextField control={control} name="address" label="Home address" helper="Optional now, but needed before a person can be paid out." testID="ajo-contributor-address" />
          <TextField control={control} name="email" label="Email (optional)" keyboardType="email-address" autoCapitalize="none" testID="ajo-contributor-email" />
          {rotating ? <TextField control={control} name="shares" label="Shares" placeholder="1" keyboardType="number-pad" maxLength={1} testID="ajo-contributor-shares" /> : null}
          {rowProblem ? (
            <Text variant="body" tone="danger" testID="ajo-contributor-problem">
              {rowProblem}
            </Text>
          ) : null}
          <Button variant="soft" onPress={addRow} testID="ajo-contributor-add">
            Add to the list
          </Button>
          <Text variant="caption" tone="tertiary">
            Have a long list? Add it from the website, where it can be uploaded as a file.
          </Text>
        </View>
      </Card>

      {rows.length > 0 ? (
        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text variant="h3">Your list</Text>
            <AjoStatusBadge status="PENDING" label={`${goodRows.length} ready`} />
          </View>
          {rows.map((r, i) => (
            <View key={`${r.phone}-${i}`} className="flex-row items-center justify-between gap-3 rounded-lg bg-surface-sunken p-3" testID={`ajo-list-row-${i}`}>
              <View className="flex-1">
                <Text variant="body-strong">
                  {r.firstName} {r.lastName}
                </Text>
                <Text variant="caption" tone="tertiary">
                  {r.phone}
                  {r.shares.trim() ? ` · ${r.shares} share(s)` : ''}
                </Text>
                {dupes[i] ? (
                  <Text variant="caption" tone="danger">
                    {dupes[i]} already uses this number.
                  </Text>
                ) : null}
              </View>
              <Button size="sm" variant="ghost" onPress={() => setRows((prev) => prev.filter((_, at) => at !== i))} accessibilityLabel={`Remove ${r.firstName}`}>
                Remove
              </Button>
            </View>
          ))}
        </View>
      ) : null}

      <View className="gap-2">
        <TickRow
          label={`I know these people and approve them for ${group?.name ?? 'the circle'}`}
          meta="This is the circle's approval. It also asks SocietyLedger to check them."
          checked={approve}
          onToggle={() => setApprove((v) => !v)}
          testID="ajo-contributors-approve"
        />
        <TickRow
          label="I have explained the circle rules to them and they agreed"
          meta="Recorded on their behalf, with your name. If you leave this off, each person accepts the rules themselves after signing in, or you record it later from Members."
          checked={onBehalf}
          onToggle={() => setOnBehalf((v) => !v)}
          testID="ajo-contributors-behalf"
        />
        <TickRow
          label="Email a login link to everyone who has an email address"
          meta="So they can see their schedule and receipts. Text messages cost SMS credits, so they are not sent from here."
          checked={sendEmail}
          onToggle={() => setSendEmail((v) => !v)}
          testID="ajo-contributors-email"
        />
      </View>

      {guarantorRequired ? (
        <Text variant="caption" tone="secondary">
          Each person needs a guarantor before they become active. Add guarantors from Members.
        </Text>
      ) : null}
      {group?.requirePhoneConfirm ? (
        <Text variant="caption" tone="secondary">
          Each person will confirm their phone with a code when they join.
        </Text>
      ) : null}
      <Text variant="caption" tone="tertiary">
        Want to be a contributor yourself? Add yourself to the list. Another officer has to approve you, because nobody can approve their own membership.
      </Text>
      {limit ? (
        <View className="gap-1">
          <Text variant="caption" tone="secondary">
            {limit.count} of {limit.limit ?? 'unlimited'} contributors on your plan{room !== null ? ` · room for ${room} more` : ''}.
          </Text>
          {overLimit ? (
            <Text variant="caption" tone="danger">
              That is more people than your plan has room for. Remove some, untick approval, or move to a bigger tier on the website.
            </Text>
          ) : null}
        </View>
      ) : null}
      {problem ? (
        <Text variant="body" tone="danger" testID="ajo-contributors-problem">
          {problem}
        </Text>
      ) : null}

      <View className="gap-3">
        <Button fullWidth loading={busy} disabled={!circleId || goodRows.length === 0} onPress={() => void submit()} testID="ajo-contributors-submit">
          {`Add ${goodRows.length || ''} ${goodRows.length === 1 ? 'person' : 'people'}`}
        </Button>
        <Button
          variant="ghost"
          fullWidth
          disabled={busy}
          onPress={() => {
            setBusy(true);
            void onSkip().finally(() => setBusy(false));
          }}
          testID="ajo-contributors-skip"
        >
          Add people later
        </Button>
        {circleId ? (
          <Button variant="ghost" fullWidth onPress={() => router.push(`/(app)/(tabs)/manage/thrift/${circleId}/members` as never)}>
            Open Members for this circle
          </Button>
        ) : null}
      </View>
    </View>
  );
}
