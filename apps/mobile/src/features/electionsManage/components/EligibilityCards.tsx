import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useMyEligibility } from '../queries';

/**
 * What an election asks of people, and whether I meet it — shown only when the association has set a rule. With none (the default) it
 * renders nothing at all, so a member of such an association sees exactly what they always have.
 */
export function RequirementsCard({ electionId, focus }: { electionId: number; focus: 'vote' | 'stand' | null }) {
  const { data } = useMyEligibility(electionId);
  if (!data || !data.hasRules) return null;

  const mine = focus === 'vote' ? data.vote : focus === 'stand' ? data.stand : null;

  return (
    <View className="gap-3 rounded-lg border border-border bg-surface p-4 dark:border-transparent" testID={`requirements-${electionId}`}>
      <Text variant="h3">Who can vote and stand</Text>
      {data.requirements.voters.length > 0 ? (
        <View className="gap-1">
          <Text variant="label">To vote</Text>
          {data.requirements.voters.map((line) => (
            <Text key={line} variant="body" tone="secondary">{`• ${line}`}</Text>
          ))}
        </View>
      ) : null}
      {data.requirements.candidates.length > 0 ? (
        <View className="gap-1">
          <Text variant="label">To stand</Text>
          {data.requirements.candidates.map((line) => (
            <Text key={line} variant="body" tone="secondary">{`• ${line}`}</Text>
          ))}
        </View>
      ) : null}
      {mine ? (
        <View className={mine.eligible ? 'rounded-md bg-success-soft p-3' : 'rounded-md bg-warning-soft p-3'} testID={`my-eligibility-${electionId}`}>
          <Text variant="body">{mine.eligible ? (focus === 'vote' ? 'You can vote in this election.' : 'You can stand in this election.') : mine.reason ?? ''}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** One line on a list of elections: why I can't vote in this one, when the association's rules say so. Nothing for anyone who can. */
export function IneligibleNote({ electionId }: { electionId: number }) {
  const { data } = useMyEligibility(electionId);
  if (!data || data.vote.eligible) return null;
  return (
    <View className="rounded-md bg-warning-soft p-3" testID={`ineligible-${electionId}`}>
      <Text variant="caption">{data.vote.reason ?? ''}</Text>
    </View>
  );
}
