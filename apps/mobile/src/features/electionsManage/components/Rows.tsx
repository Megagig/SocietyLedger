import { Trophy } from 'lucide-react-native';
import { memo } from 'react';
import { View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { GroupedRow, type RowPosition } from '@/features/financeSetup/components/GroupedRow';
import { formatDate } from '@/lib/dates';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { CandidateResultDTO } from '@/types/api/electionsManage';
import type { CandidateDTO, ElectionListItemDTO, PollListItemDTO } from '@/types/api/voting';
import type { ElectionStatus, PollStatus } from '@/types/api/enums';
import {
  CANDIDATE_GUARD_MESSAGES,
  CANDIDATE_STATUS_LABELS,
  candidateStatusKey,
  ELECTION_STATUS_LABELS,
  ELECTION_TYPE_LABELS,
  electionStatusKey,
  pollStatusKey,
  POLL_STATUS_LABELS,
  turnoutPercent,
  type CandidateGuard,
} from '../labels';

const memberName = (m: { firstName: string; lastName: string }) => `${m.firstName} ${m.lastName}`.trim();

/** One election: its title and kind, where it stands, and when voting runs — with turnout while voting is open. */
function ElectionRowBase({ item, position, onPress }: { item: ElectionListItemDTO; position: RowPosition; onPress?: (item: ElectionListItemDTO) => void }) {
  const status = item.status as ElectionStatus;
  const open = status === 'VOTING_OPEN';
  return (
    <GroupedRow
      position={position}
      onPress={onPress ? () => onPress(item) : undefined}
      accessibilityLabel={`${item.title}, ${ELECTION_STATUS_LABELS[status]}`}
      testID={`election-row-${item.id}`}
      minHeight={88}
    >
      <View className="gap-1.5">
        <View className="flex-row items-start gap-3">
          <View className="flex-1 gap-0.5">
            <Text variant="body-lg" numberOfLines={2}>
              {item.title}
            </Text>
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {`${ELECTION_TYPE_LABELS[item.electionType]} · ${item.positions.length} ${item.positions.length === 1 ? 'position' : 'positions'} · ${item._count.candidates} ${item._count.candidates === 1 ? 'candidate' : 'candidates'}`}
            </Text>
          </View>
          <StatusChip status={electionStatusKey(status)} label={ELECTION_STATUS_LABELS[status]} />
        </View>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {`Voting ${formatDate(item.votingStartDate, 'long')} to ${formatDate(item.votingEndDate, 'long')}`}
        </Text>
        {open ? (
          <View className="gap-1">
            <ProgressBar percent={turnoutPercent(item.totalVotesCast, item.eligibleVoterCount)} label="Members who have voted" />
            <Text variant="caption" tone="secondary">
              {`${item.totalVotesCast} of ${item.eligibleVoterCount} members have voted`}
            </Text>
          </View>
        ) : null}
      </View>
    </GroupedRow>
  );
}
export const ElectionRow = memo(ElectionRowBase);

/** One poll: its title, how members answer, where it stands and how many have answered. */
function PollRowBase({ item, position, onPress }: { item: PollListItemDTO; position: RowPosition; onPress?: (item: PollListItemDTO) => void }) {
  const status = item.status as PollStatus;
  return (
    <GroupedRow
      position={position}
      onPress={onPress ? () => onPress(item) : undefined}
      accessibilityLabel={`${item.title}, ${POLL_STATUS_LABELS[status] ?? item.status}`}
      testID={`poll-row-${item.id}`}
      minHeight={80}
    >
      <View className="flex-row items-start gap-3">
        <View className="flex-1 gap-0.5">
          <Text variant="body-lg" numberOfLines={2}>
            {item.title}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {`${item.options.length} answers · ${item._count.responses} ${item._count.responses === 1 ? 'answer' : 'answers'} so far`}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {`Ends ${formatDate(item.endDate, 'long')}`}
          </Text>
        </View>
        <StatusChip status={pollStatusKey(item.status)} label={POLL_STATUS_LABELS[status] ?? item.status} />
      </View>
    </GroupedRow>
  );
}
export const PollRow = memo(PollRowBase);

/**
 * One candidate: who is standing, for what, and where their nomination stands. A nomination that is waiting shows Approve and Reject
 * to the committee members allowed to decide it; their own shows a note instead, because another member has to decide it.
 */
export function CandidateCard({
  candidate,
  guard,
  busy,
  showPosition,
  onApprove,
  onReject,
}: {
  candidate: CandidateDTO;
  guard: CandidateGuard;
  busy?: boolean;
  showPosition?: boolean;
  onApprove: (candidate: CandidateDTO) => void;
  onReject: (candidate: CandidateDTO) => void;
}) {
  const dimmed = candidate.status === 'REJECTED' || candidate.status === 'WITHDRAWN';
  return (
    <View className="gap-3 rounded-lg border border-border bg-surface p-4 dark:border-transparent" testID={`candidate-${candidate.id}`}>
      <View className={dimmed ? 'flex-row items-start opacity-70' : 'flex-row items-start'}>
        <View className="flex-1 gap-0.5">
          <Text variant="body-lg" numberOfLines={1}>
            {memberName(candidate.member)}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {showPosition && candidate.position ? `${candidate.member.memberId} · ${candidate.position.title}` : candidate.member.memberId}
          </Text>
          {candidate.manifesto ? (
            <Text variant="caption" tone="secondary" numberOfLines={3}>
              {candidate.manifesto}
            </Text>
          ) : null}
        </View>
        <View className="ml-3">
          <StatusChip status={candidateStatusKey(candidate.status)} label={CANDIDATE_STATUS_LABELS[candidate.status]} />
        </View>
      </View>

      {candidate.status === 'REJECTED' && candidate.rejectionReason ? (
        <Text variant="caption" tone="secondary">{`Reason: ${candidate.rejectionReason}`}</Text>
      ) : null}

      {guard === 'ok' ? (
        <View className="flex-row gap-3">
          <Button variant="secondary" fullWidth disabled={busy} onPress={() => onReject(candidate)} testID={`candidate-reject-${candidate.id}`}>
            Reject
          </Button>
          <Button variant="primary" fullWidth loading={busy} onPress={() => onApprove(candidate)} testID={`candidate-approve-${candidate.id}`}>
            Approve
          </Button>
        </View>
      ) : guard === 'own' ? (
        <Text variant="caption" tone="secondary" testID={`candidate-guard-${candidate.id}`}>
          {CANDIDATE_GUARD_MESSAGES.own}
        </Text>
      ) : null}
    </View>
  );
}

/** One line of a result: the name, a bar for the share of the votes, and the count. The winner is marked. */
export function ResultBar({ row, winner, tied }: { row: CandidateResultDTO; winner?: boolean; tied?: boolean }) {
  const { color } = useThemeTokens();
  return (
    <View className="gap-1.5" testID={`result-${row.candidateId}`}>
      <View className="flex-row items-center gap-2">
        <Text variant="body-lg" numberOfLines={1} className="flex-1">
          {row.memberName}
        </Text>
        {winner ? <Trophy size={18} color={color.primary} strokeWidth={1.75} /> : null}
        {winner ? <Badge tone="success">Winner</Badge> : null}
        {tied ? <Badge tone="warning">Level</Badge> : null}
      </View>
      <ProgressBar percent={row.votePercentage} tone={winner ? 'success' : 'primary'} label={`${row.memberName}, ${row.votePercentage} percent`} />
      <Text variant="caption" tone="secondary">
        {`${row.voteCount} ${row.voteCount === 1 ? 'vote' : 'votes'} · ${row.votePercentage}%`}
      </Text>
    </View>
  );
}
