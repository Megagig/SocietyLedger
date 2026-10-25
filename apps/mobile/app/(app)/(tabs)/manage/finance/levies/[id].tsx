import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MoreVertical } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ConfirmSheet } from '@/components/feedback/ConfirmSheet';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Money } from '@/components/ui/Money';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatTile } from '@/components/ui/StatTile';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { ASSIGNMENT_STATUS_LABELS, assignmentCanRemove, CAMPAIGN_STATUS_LABELS, campaignCanAssign, campaignCanClose, campaignCanEdit, campaignStatusKey, deadlineLabel, stillOwedLine } from '@/features/financeSetup/labels';
import { useRemoveAssignment, useUpdateCampaign } from '@/features/financeSetup/mutations';
import { ASSIGN_ACCESS, ASSIGN_REMOVE_ACCESS, FINANCE_VIEW_ACCESS, SETUP_EDIT_ACCESS, useCampaign } from '@/features/financeSetup/queries';
import { FactRow } from '@/features/members/components/FactRow';
import { useCan } from '@/hooks/useCan';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { CampaignAssignmentDTO } from '@/types/api/financeSetup';

/**
 * project-overview.md §6.9 FN9 — one levy campaign: collected against the target, who owes what, put members on it, edit it or close it.
 * Closing only stops new members; the charges already raised stay owed (and reminded) until paid, waived or voided one member at a time.
 */
export default function CampaignDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const canView = useCan(FINANCE_VIEW_ACCESS);
  const canEdit = useCan(SETUP_EDIT_ACCESS);
  const canAssign = useCan(ASSIGN_ACCESS);
  const canRemove = useCan(ASSIGN_REMOVE_ACCESS);
  const query = useCampaign(id);
  const update = useUpdateCampaign(id);
  const removeAssignment = useRemoveAssignment(id);
  const [picked, setPicked] = useState<CampaignAssignmentDTO | null>(null);
  const menuRef = useRef<BottomSheetModal>(null);
  const closeRef = useRef<BottomSheetModal>(null);
  const memberRef = useRef<BottomSheetModal>(null);
  const removeRef = useRef<BottomSheetModal>(null);
  const back = () => router.back();
  const go = (path: string) => router.push(`/(app)/(tabs)/manage/finance/${path}` as never);

  if (!canView) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Campaign" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const campaign = query.data;
  const showEdit = !!campaign && canEdit && campaignCanEdit(campaign.status);
  const showClose = !!campaign && canEdit && campaignCanClose(campaign.status);
  const showAssign = !!campaign && canAssign && campaignCanAssign(campaign.status);
  const hasMenu = showEdit || showClose;

  const close = () =>
    update.mutate(
      { status: 'CLOSED' },
      {
        onSuccess: () => {
          closeRef.current?.dismiss();
          toast.success('Campaign closed — what members owe is unchanged');
        },
        onError: (error) => {
          closeRef.current?.dismiss();
          toast.error(error instanceof ApiError ? error.message : 'Could not close the campaign. Try again.');
        },
      },
    );

  const remove = () => {
    if (!picked) return;
    removeAssignment.mutate(picked.id, {
      onSuccess: () => {
        removeRef.current?.dismiss();
        toast.success('Member removed — their charge was voided');
        setPicked(null);
      },
      onError: (error) => {
        removeRef.current?.dismiss();
        toast.error(error instanceof ApiError ? error.message : 'Could not remove the member. Try again.');
        void query.refetch();
      },
    });
  };

  const openMember = (assignment: CampaignAssignmentDTO) => {
    setPicked(assignment);
    memberRef.current?.present();
  };

  const owing = campaign ? campaign.progress.assignedMembers - campaign.progress.paidCount : 0;
  const memberName = (a: CampaignAssignmentDTO) => `${a.member.firstName} ${a.member.lastName}`.trim();

  return (
    <Screen edges={['top', 'bottom']} refreshing={query.isRefetching} onRefresh={() => query.refetch()}>
      <ScreenHeader
        title="Campaign"
        onBack={back}
        docsKey="FN9"
        rightActions={hasMenu ? <IconButton icon={MoreVertical} accessibilityLabel="More actions" onPress={() => menuRef.current?.present()} testID="campaign-more" /> : undefined}
      />

      {query.isPending ? (
        <View className="gap-4 pb-6">
          <Skeleton width="100%" height={130} radius="lg" />
          <Skeleton width="100%" height={200} radius="md" />
        </View>
      ) : query.isError || !campaign ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <View className="gap-6 pb-8">
          <View className="gap-3">
            <View className="flex-row items-center justify-between gap-2">
              <Text variant="h2" className="flex-1" numberOfLines={2}>
                {campaign.name}
              </Text>
              <StatusChip status={campaignStatusKey(campaign.status)} label={CAMPAIGN_STATUS_LABELS[campaign.status]} />
            </View>
            <Text variant="body" tone="secondary">
              {campaign.description || campaign.category.name}
            </Text>
            <ProgressBar percent={campaign.progress.progressPercentage} tone={campaign.status === 'COMPLETED' ? 'success' : 'primary'} label="Collected so far" testID="campaign-progress" />
            <View className="flex-row flex-wrap items-center gap-x-1">
              <Money value={campaign.progress.totalCollected} size="body-strong" />
              <Text variant="caption" tone="secondary">
                {` collected of `}
              </Text>
              <Money value={campaign.targetAmount} size="caption" tone="secondary" />
              <Text variant="caption" tone="secondary">
                {` · ${Math.round(campaign.progress.progressPercentage)}%`}
              </Text>
            </View>
          </View>

          <View className="flex-row gap-2">
            <StatTile label="Assigned" value={formatMoney(campaign.progress.totalAssigned)} tone="info" />
            <StatTile label="Still owed" value={formatMoney(campaign.progress.stillOwed)} tone="warning" />
            <StatTile label="Members paid" value={`${campaign.progress.paidCount}/${campaign.progress.assignedMembers}`} tone="success" />
          </View>

          {campaign.status === 'CLOSED' ? (
            <View className="gap-1 rounded-lg bg-warning-soft p-4" testID="campaign-closed">
              <Text variant="label">Closed to new members</Text>
              <Text variant="body">{stillOwedLine(owing, true)}</Text>
            </View>
          ) : null}

          <Section title="Details">
            <ListGroup>
              <FactRow label="Levy type" value={campaign.category.name} />
              <FactRow label="Deadline" value={`${formatDate(campaign.deadline, 'long')} · ${deadlineLabel(campaign.deadline)}`} />
              <FactRow label="Per member" amount={campaign.amountPerMember ?? undefined} value={campaign.amountPerMember === null ? 'Varies' : undefined} />
            </ListGroup>
          </Section>

          <Section title={campaign.assignments.length === 0 ? 'Members' : `Members · ${campaign.assignments.length}`}>
            {campaign.assignments.length === 0 ? (
              <Text variant="body" tone="secondary">
                No members have been put on this campaign yet.
              </Text>
            ) : (
              <ListGroup>
                {campaign.assignments.map((a) => (
                  <ListItem
                    key={a.id}
                    title={memberName(a)}
                    meta={`${formatMoney(a.amount)} · paid ${formatMoney(a.paidAmount)}`}
                    trailing={<StatusChip status={a.calculatedStatus === 'pending' ? 'pending' : a.calculatedStatus} label={ASSIGNMENT_STATUS_LABELS[a.calculatedStatus]} />}
                    showChevron
                    onPress={() => openMember(a)}
                    testID={`assignment-${a.id}`}
                  />
                ))}
              </ListGroup>
            )}
          </Section>
        </View>
      )}

      {showAssign ? (
        <StickyFooter>
          <View className="flex-1">
            <Button variant="primary" fullWidth onPress={() => go(`levies/assign?id=${id}`)} testID="campaign-assign">
              Assign members
            </Button>
          </View>
        </StickyFooter>
      ) : null}

      <BottomSheet ref={menuRef} title="Campaign actions" snapPoints={['35%']}>
        <View className="gap-3 pb-6">
          {showEdit ? (
            <Button
              variant="secondary"
              onPress={() => {
                menuRef.current?.dismiss();
                go(`levies/campaign-form?id=${id}`);
              }}
              testID="campaign-edit"
            >
              Edit campaign
            </Button>
          ) : null}
          {showClose ? (
            <Button
              variant="secondary"
              onPress={() => {
                menuRef.current?.dismiss();
                closeRef.current?.present();
              }}
              testID="campaign-close"
            >
              Close campaign
            </Button>
          ) : null}
        </View>
      </BottomSheet>

      <ConfirmSheet
        ref={closeRef}
        title="Close this campaign?"
        description={`No more members can be added. Everything already charged stays owed — ${owing} ${owing === 1 ? 'member' : 'members'} still ${owing === 1 ? 'owes' : 'owe'} it, and keep being reminded until they pay, or you waive or void their charge.`}
        confirmLabel="Close campaign"
        cancelLabel="Keep open"
        destructive={false}
        onConfirm={close}
      />

      <BottomSheet ref={memberRef} title={picked ? memberName(picked) : 'Member'} snapPoints={['40%']}>
        <View className="gap-3 pb-6">
          {picked ? (
            <Text variant="body" tone="secondary">
              {`${formatMoney(picked.amount)} charged · ${formatMoney(picked.paidAmount)} paid · ${formatMoney(Math.max(0, picked.balance))} left`}
            </Text>
          ) : null}
          {picked?.transaction ? (
            <Button
              variant="primary"
              onPress={() => {
                memberRef.current?.dismiss();
                go(`transactions/${picked.transaction!.id}`);
              }}
              testID="assignment-open-charge"
            >
              Open their charge
            </Button>
          ) : null}
          {picked && canRemove && assignmentCanRemove(picked) ? (
            <Button
              variant="danger"
              onPress={() => {
                memberRef.current?.dismiss();
                removeRef.current?.present();
              }}
              testID="assignment-remove"
            >
              Remove from campaign
            </Button>
          ) : null}
          <Text variant="caption" tone="secondary">
            To drop what a member owes, open their charge and waive or void it there. Removing is for a mistake and isn&apos;t possible once they have paid something.
          </Text>
        </View>
      </BottomSheet>

      <ConfirmSheet
        ref={removeRef}
        title="Remove this member?"
        description="Their charge for this levy is voided and taken off their ledger. Use this to correct a mistake."
        confirmLabel="Remove member"
        onConfirm={remove}
      />
    </Screen>
  );
}
