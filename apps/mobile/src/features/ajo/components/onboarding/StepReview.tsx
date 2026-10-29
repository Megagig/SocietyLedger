import { useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';

import { ajoApi } from '@/api/endpoints/ajo';
import { ApiError } from '@/api/errors';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import type { GroupDetailDTO, RosterPersonDTO, RuleVersionDTO } from '@/types/api/ajo';
import { formatDay, formatKobo, frequencyText, MODEL_LABEL } from '../../format';
import { AjoActionSheet } from '../AjoActionSheet';
import { AjoStatusBadge } from '../AjoStatusBadge';

type Progress = { completed: number[]; skipped: number[] };
type RowState = 'done' | 'skipped' | 'attention';

function Row({ label, state, children, onFix }: { label: string; state: RowState; children: ReactNode; onFix: () => void }) {
  return (
    <View className="gap-2 px-4 py-3">
      <View className="flex-row items-center justify-between gap-3">
        <Text variant="body-strong" className="flex-1">
          {label}
        </Text>
        <AjoStatusBadge status={state === 'done' ? 'CONFIRMED' : state === 'skipped' ? 'WAIVED' : 'OVERDUE'} label={state === 'done' ? 'Done' : state === 'skipped' ? 'Skipped' : 'Needs attention'} />
      </View>
      <View className="gap-1">{children}</View>
      <Button size="sm" variant="ghost" onPress={onFix}>
        {state === 'done' ? 'Change' : 'Fix'}
      </Button>
    </View>
  );
}

/** Step 5: what is set up, what is missing, what happens next, and the choice to open the circle now or keep it as a draft. */
export function StepReview({
  group,
  roster,
  rules,
  progress,
  groupName,
  onFix,
  onFinish,
}: {
  group: GroupDetailDTO | undefined;
  roster: RosterPersonDTO[];
  rules: RuleVersionDTO | undefined;
  progress: Progress;
  groupName: string;
  onFix: (step: number) => void;
  onFinish: (groupId: number | null, opened: boolean) => Promise<void>;
}) {
  const confirmSheet = useRef<BottomSheetModal>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const state = (step: number, ok: boolean): RowState => (ok && progress.completed.includes(step) ? 'done' : progress.skipped.includes(step) ? 'skipped' : ok ? 'done' : 'attention');
  const live = roster.filter((p) => p.status !== 'LEFT');
  const approved = live.filter((p) => p.approvedAt).length;
  const active = live.filter((p) => p.status === 'ACTIVE').length;
  const draft = group?.status === 'DRAFT';

  const keepAsDraft = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await onFinish(group?.id ?? null, false);
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'We could not finish. Please try again.');
      setBusy(false);
    }
  };

  return (
    <View className="gap-5" testID="ajo-step-review">
      <Card noPadding>
        <Row label="Group profile" state={state(1, true)} onFix={() => onFix(1)}>
          <Text variant="caption" tone="secondary">
            {groupName}
          </Text>
        </Row>
        <View className="h-px bg-border" />
        <Row label="Circle" state={state(2, !!group)} onFix={() => onFix(2)}>
          {group ? (
            <>
              <Text variant="caption" tone="secondary">
                {group.name}: {MODEL_LABEL[group.model]}, {formatKobo(group.contributionKobo)} {frequencyText(group).toLowerCase()}, starting {formatDay(group.startDate)}.
              </Text>
              <Text variant="caption" tone="secondary">
                {group.model === 'ROTATING_POT' ? `${group.rounds ?? 'Several'} rounds` : `${group.cycleLength ?? '—'} payments`} · collector fee{' '}
                {group.collectorFee.type === 'NONE'
                  ? 'none'
                  : group.collectorFee.type === 'FIXED'
                    ? formatKobo(group.collectorFee.value)
                    : group.collectorFee.type === 'PERCENT'
                      ? `${Number(group.collectorFee.value) / 100}%`
                      : `${group.collectorFee.value} day(s) of contribution`}
              </Text>
              <Text variant="caption" tone="secondary">
                Group account: {group.bankAccount ? `${group.bankAccount.bankName} ${group.bankAccount.masked}` : 'not added yet'}
              </Text>
              {rules
                ? rules.summary.slice(0, 4).map((l) => (
                    <Text key={l} variant="caption" tone="secondary">
                      • {l}
                    </Text>
                  ))
                : null}
            </>
          ) : (
            <Text variant="caption" tone="secondary">
              No circle yet.
            </Text>
          )}
        </Row>
        <View className="h-px bg-border" />
        <Row label="Contributors" state={state(3, live.length > 0)} onFix={() => onFix(3)}>
          <Text variant="caption" tone="secondary">
            {live.length} added · {approved} approved · {active} active
          </Text>
        </Row>
        <View className="h-px bg-border" />
        <Row label="Team and collectors" state={progress.completed.includes(4) ? 'done' : 'skipped'} onFix={() => onFix(4)}>
          <Text variant="caption" tone="secondary">
            {progress.completed.includes(4) ? 'Invites sent.' : 'Nobody invited yet. You can do it from Settings later.'}
          </Text>
        </Row>
      </Card>

      <View className="gap-2">
        <Text variant="h3">What happens next</Text>
        <Text variant="body" tone="secondary">
          1. Open the circle so your contributors can see it and accept the rules.
        </Text>
        <Text variant="body" tone="secondary">
          2. SocietyLedger checks each person&apos;s name, phone, address and payout account. Nobody can be paid out until they are verified.
        </Text>
        <Text variant="body" tone="secondary">
          3. Start the circle on {group ? formatDay(group.startDate) : 'its start date'}.
        </Text>
        <Text variant="body" tone="secondary">
          4. Record contributions as they come in. Every contributor gets a receipt.
        </Text>
        <Text variant="caption" tone="tertiary">
          Your circle&apos;s money stays in your own bank account. SocietyLedger keeps the records.
        </Text>
      </View>

      {problem ? (
        <Text variant="body" tone="danger">
          {problem}
        </Text>
      ) : null}
      <View className="gap-3">
        {draft && group ? (
          <Button onPress={() => confirmSheet.current?.present()} testID="ajo-review-open">
            {`Open ${group.name}`}
          </Button>
        ) : null}
        <Button variant="secondary" loading={busy} onPress={() => void keepAsDraft()} testID="ajo-review-draft">
          {group ? 'Keep as draft and go to Ajo' : 'Go to Ajo'}
        </Button>
      </View>

      <AjoActionSheet
        ref={confirmSheet}
        title={`Open ${group?.name ?? 'the circle'}?`}
        summary="Contributors will see the circle and its rules. If you change the rules later, a new version is saved and applies from then on. People you have already approved become active now."
        confirmLabel="Open the circle"
        onConfirm={async () => {
          if (group) await ajoApi.openGroup(group.id);
          await onFinish(group?.id ?? null, true);
        }}
        successMessage="The circle is open."
        testID="ajo-review-open-sheet"
      />
    </View>
  );
}
