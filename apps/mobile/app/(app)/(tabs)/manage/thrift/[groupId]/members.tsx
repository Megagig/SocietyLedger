import { useLocalSearchParams } from 'expo-router';
import { Users } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ajoApi } from '@/api/endpoints/ajo';
import { ApiError } from '@/api/errors';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { AddPersonSheet, type AddPersonSheetHandle } from '@/features/ajo/components/AddPersonSheet';
import { useAjoWrite } from '@/features/ajo/components/AjoGate';
import { AjoLoading } from '@/features/ajo/components/AjoStates';
import { AjoScreen } from '@/features/ajo/components/AjoScreen';
import { AjoStatusBadge } from '@/features/ajo/components/AjoStatusBadge';
import { GuarantorSheet, type GuarantorSheetHandle } from '@/features/ajo/components/GuarantorSheet';
import { RecordRulesAcceptanceSheet, type RecordRulesAcceptanceSheetHandle } from '@/features/ajo/components/RecordRulesAcceptanceSheet';
import { SharesSheet, type SharesSheetHandle } from '@/features/ajo/components/SharesSheet';
import { useAjoAction } from '@/features/ajo/mutations';
import { useGroupDetail, useGroupTrust, useRoster } from '@/features/ajo/queries';
import { useAjoCan } from '@/features/ajo/useAjoCan';
import type { RosterPersonDTO } from '@/types/api/ajo';

/** THO3: the roster with approvals, SocietyLedger verification, rule acceptance, guarantors and shares. */
export default function CircleMembersScreen() {
  const params = useLocalSearchParams<{ groupId?: string }>();
  const groupId = Number(params.groupId) || 0;
  const { canWrite } = useAjoWrite();
  const { manage } = useAjoCan();
  const group = useGroupDetail(groupId).data;
  const roster = useRoster(groupId);
  const trust = useGroupTrust(groupId);
  const trustOf = new Map((trust.data ?? []).map((t) => [t.membershipId, t]));
  const recheck = useAjoAction((memberId: number) => ajoApi.resubmitVerification(memberId));
  const approve = useAjoAction((membershipId: number) => ajoApi.approveMember(membershipId));
  const addSheet = useRef<AddPersonSheetHandle>(null);
  const guarantorSheet = useRef<GuarantorSheetHandle>(null);
  const rulesSheet = useRef<RecordRulesAcceptanceSheetHandle>(null);
  const sharesSheet = useRef<SharesSheetHandle>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const can = manage && canWrite;
  const rotating = group?.model === 'ROTATING_POT';

  const doApprove = async (p: RosterPersonDTO) => {
    setProblem(null);
    try {
      await approve.mutateAsync(p.membershipId);
      toast.success(`${p.name} was approved.`);
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'Could not approve that person.');
    }
  };

  return (
    <AjoScreen title="Members" access={['AJO_MANAGE']} refreshing={roster.isRefetching} onRefresh={() => void roster.refetch()}>
      <Text variant="body" tone="secondary">
        A person joins once the circle has approved them, they have a phone number, they accepted the rules, and any guarantor is recorded.
      </Text>
      {can && group && (group.status === 'OPEN' || group.status === 'ACTIVE' || group.status === 'DRAFT') ? (
        <Button onPress={() => addSheet.current?.open()} testID="ajo-add-person">
          Add a person
        </Button>
      ) : null}
      {problem ? (
        <View className="rounded-md bg-danger-soft p-3" accessibilityRole="alert">
          <Text variant="body" tone="danger">
            {problem}
          </Text>
        </View>
      ) : null}

      {roster.isPending ? (
        <AjoLoading />
      ) : roster.isError ? (
        <ErrorState error={roster.error} onRetry={() => roster.refetch()} />
      ) : roster.data.people.length > 0 ? (
        <View className="gap-3">
          {roster.data.people.map((p) => (
            <Card key={p.membershipId} testID={`ajo-person-${p.membershipId}`}>
              <View className="gap-3">
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text variant="h3">
                      {p.name}
                      {rotating && p.shares > 1 ? ` (${p.shares} shares)` : ''}
                    </Text>
                    <Text variant="caption" tone="tertiary">
                      {p.phone ?? 'No phone'}
                      {p.hasLogin ? '' : ' · no login'}
                    </Text>
                  </View>
                  <AjoStatusBadge status={p.status} />
                </View>
                <View className="flex-row items-center justify-between gap-2">
                  <Text variant="caption" tone="secondary">
                    SocietyLedger check
                  </Text>
                  <AjoStatusBadge status={p.verification} />
                </View>
                {can && p.verification === 'REJECTED' ? (
                  <View className="flex-row">
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={recheck.isPending && recheck.variables === p.memberId}
                      onPress={async () => {
                        setProblem(null);
                        try {
                          await recheck.mutateAsync(p.memberId);
                          toast.success(`${p.name}'s details were sent to be checked again.`);
                        } catch (error) {
                          setProblem(error instanceof ApiError ? error.message : 'Could not send this for checking.');
                        }
                      }}
                      testID={`ajo-recheck-${p.membershipId}`}
                    >
                      Check again
                    </Button>
                  </View>
                ) : null}
                {trustOf.get(p.membershipId) ? (
                  <View className="flex-row items-center justify-between gap-2">
                    <Text variant="caption" tone="secondary">
                      On-time record
                    </Text>
                    <View className="flex-row items-center gap-2">
                      <AjoStatusBadge status={trustOf.get(p.membershipId)!.band} />
                      {trustOf.get(p.membershipId)!.onTimePercent !== null ? (
                        <Text variant="caption" tone="secondary">
                          {trustOf.get(p.membershipId)!.onTimePercent}% on time
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ) : null}
                <Text variant="caption" tone="secondary">
                  Rules: {p.acceptedRuleVersion ? `Version ${p.acceptedRuleVersion}${p.acceptedVia ? ` (${p.acceptedVia})` : ''}` : 'Not accepted'}
                  {p.guarantorRecorded ? ' · guarantor on file' : ''}
                </Text>
                {p.waitingFor.length > 0 ? (
                  <View className="gap-1 rounded-md bg-warning-soft p-3">
                    <Text variant="label" tone="warning">
                      Waiting for
                    </Text>
                    {p.waitingFor.map((w) => (
                      <Text key={w.requirement} variant="caption" tone="warning">
                        • {w.text}
                      </Text>
                    ))}
                  </View>
                ) : null}
                {can ? (
                  <View className="flex-row flex-wrap gap-2">
                    {p.status === 'PENDING' && !p.approvedAt ? (
                      <Button size="sm" loading={approve.isPending && approve.variables === p.membershipId} onPress={() => void doApprove(p)} testID={`ajo-approve-${p.membershipId}`}>
                        Approve
                      </Button>
                    ) : null}
                    {p.status !== 'LEFT' && p.waitingFor.some((w) => w.requirement === 'RULE_ACCEPTANCE') ? (
                      <Button size="sm" variant="secondary" onPress={() => rulesSheet.current?.open(p)} testID={`ajo-record-rules-${p.membershipId}`}>
                        Record rules acceptance
                      </Button>
                    ) : null}
                    {p.status !== 'LEFT' ? (
                      <Button size="sm" variant="secondary" onPress={() => guarantorSheet.current?.open(p)} testID={`ajo-guarantor-${p.membershipId}`}>
                        Guarantor
                      </Button>
                    ) : null}
                    {rotating && group?.status !== 'ACTIVE' && p.status !== 'LEFT' ? (
                      <Button size="sm" variant="secondary" onPress={() => sharesSheet.current?.open(p)} testID={`ajo-shares-${p.membershipId}`}>
                        Shares
                      </Button>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState icon={Users} title="Nobody has been added yet." description="Add association members to this circle, then approve them." />
      )}

      <AddPersonSheet ref={addSheet} groupId={groupId} rotating={!!rotating} maxShares={group?.maxSharesPerMember ?? 1} minAmountKobo={group?.contributionKobo} />
      <GuarantorSheet ref={guarantorSheet} />
      <RecordRulesAcceptanceSheet ref={rulesSheet} groupId={groupId} />
      <SharesSheet ref={sharesSheet} maxShares={group?.maxSharesPerMember ?? 1} />
    </AjoScreen>
  );
}
