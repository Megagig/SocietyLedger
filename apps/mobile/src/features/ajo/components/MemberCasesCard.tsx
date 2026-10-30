import { useRef } from 'react';
import { View } from 'react-native';

import { SectionCard } from '@/components/layout/SectionCard';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useMemberCases } from '../queries';
import { formatDay } from '../format';
import { AjoMoney } from './AjoMoney';
import { AjoStatusBadge } from './AjoStatusBadge';
import { CaseResponseSheet, type CaseResponseSheetHandle } from './CaseResponseSheet';

const STATUS_WORDS: Record<string, string> = { OPEN: 'Open', PLAN_AGREED: 'Repayment plan agreed', RESOLVED: 'Resolved', CLOSED_UNRESOLVED: 'Closed' };

/**
 * A case the officers opened about this person's unpaid rounds: what is outstanding, any repayment plan, and a place to give their own
 * side. Shown only when there is one. A person is never called a defaulter; the case describes a situation.
 */
export function MemberCasesCard({ membershipId, canWrite }: { membershipId: number; canWrite: boolean }) {
  const cases = useMemberCases(membershipId);
  const sheet = useRef<CaseResponseSheetHandle>(null);
  if (!cases.data || cases.data.length === 0) return null;

  return (
    <>
      <SectionCard title="Cases about your unpaid rounds">
        {cases.data.map((c) => (
          <View key={c.id} className="gap-1 px-4 py-3" testID={`ajo-case-${c.id}`}>
            <View className="flex-row items-center justify-between gap-2">
              <Text variant="body-strong">Opened {formatDay(c.openedAt)}</Text>
              <AjoStatusBadge status={c.status} label={STATUS_WORDS[c.status] ?? c.status} />
            </View>
            <Text variant="body">
              Outstanding when it opened: <AjoMoney kobo={c.outstandingAtOpeningKobo} />. Outstanding now: <AjoMoney kobo={c.outstandingNowKobo} />.
            </Text>
            {c.plans.map((p) => (
              <Text key={p.id} variant="caption" tone="tertiary">
                Repayment plan: {p.status.toLowerCase()}, {p.schedule.length} payment{p.schedule.length === 1 ? '' : 's'}.
              </Text>
            ))}
            {c.resolution ? (
              <Text variant="caption" tone="tertiary">
                Outcome: {c.resolution}
              </Text>
            ) : null}
            {c.memberResponse ? (
              <Text variant="caption" tone="tertiary">
                Your explanation: {c.memberResponse}
              </Text>
            ) : null}
            {canWrite && (c.status === 'OPEN' || c.status === 'PLAN_AGREED') ? (
              <View className="pt-2">
                <Button variant="secondary" size="sm" onPress={() => sheet.current?.open(c.id)} testID={`ajo-case-respond-${c.id}`}>
                  Add your explanation
                </Button>
              </View>
            ) : null}
          </View>
        ))}
      </SectionCard>
      <CaseResponseSheet ref={sheet} />
    </>
  );
}
