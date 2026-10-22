import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { MailPlus, Send } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ConfirmSheet } from '@/components/feedback/ConfirmSheet';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { SearchField } from '@/components/forms/SearchField';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import { InviteMemberRow } from '@/features/members/components/InviteMemberRow';
import { PendingInviteRow } from '@/features/members/components/PendingInviteRow';
import { memberFullName } from '@/features/members/labels';
import { useBulkInvite, useResendInvite, useRevokeInvite } from '@/features/members/mutations';
import { MEMBERS_INVITE_ACCESS, useInvitableMembers, usePendingInvites } from '@/features/members/queries';
import { useCan } from '@/hooks/useCan';
import type { InvitableMemberDTO, PendingInviteDTO } from '@/types/api/membersManage';

type Tab = 'invite' | 'pending';

/** project-overview.md §6.9 MG4 — invite members to activate a login (by email), and manage the invites still waiting. */
export default function InviteMembersScreen() {
  const router = useRouter();
  const canInvite = useCan(MEMBERS_INVITE_ACCESS);
  const [tab, setTab] = useState<Tab>('invite');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [revoking, setRevoking] = useState<PendingInviteDTO | null>(null);
  const revokeSheetRef = useRef<BottomSheetModal>(null);

  const term = search.trim();
  const invitable = useInvitableMembers(term);
  const pending = usePendingInvites();
  const bulkInvite = useBulkInvite();
  const resend = useResendInvite();
  const revoke = useRevokeInvite();

  const members = useMemo(() => invitable.data?.pages.flatMap((page) => page.members) ?? [], [invitable.data]);
  const pendingInvites = pending.data ?? [];
  const back = () => router.back();

  const toggle = useCallback((member: InvitableMemberDTO) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(member.id)) next.delete(member.id);
      else next.add(member.id);
      return next;
    });
  }, []);

  if (!canInvite) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Invite members" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const onError = (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Something went wrong. Try again.');

  const sendInvites = () => {
    const ids = [...selected];
    bulkInvite.mutate(ids, {
      onSuccess: ({ results }) => {
        const sent = results.filter((r) => r.success && r.emailSent !== false).length;
        const notEmailed = results.filter((r) => r.success && r.emailSent === false).length;
        const failed = results.filter((r) => !r.success);
        setSelected(new Set());
        if (sent > 0) toast.success(sent === 1 ? 'Invite sent' : `${sent} invites sent`);
        // Saved but not delivered: it's in Pending, where Resend retries it.
        if (notEmailed > 0) toast.warning(`${notEmailed} invite${notEmailed === 1 ? ' was' : 's were'} created but the email couldn't be sent. Resend from Pending.`);
        if (failed.length > 0) toast.error(failed[0]?.message ?? 'Some invites could not be sent.');
      },
      onError,
    });
  };

  const resendInvite = (invite: PendingInviteDTO) =>
    resend.mutate(invite.id, {
      onSuccess: (result) => (result.emailSent ? toast.success('Invite resent') : toast.warning("The invite was renewed, but the email couldn't be sent. Try again shortly.")),
      onError,
    });

  const confirmRevoke = () => {
    if (!revoking) return;
    revoke.mutate(revoking.id, {
      onSuccess: () => {
        revokeSheetRef.current?.dismiss();
        toast.success('Invite revoked');
      },
      onError,
    });
  };

  const loadMore = () => {
    if (invitable.hasNextPage && !invitable.isFetchingNextPage) void invitable.fetchNextPage();
  };

  return (
    <Screen edges={['top', 'bottom']} scroll={false}>
      <ScreenHeader title="Invite members" onBack={back} docsKey="MG4" />

      <View className="gap-3 pb-3">
        <SegmentedControl<Tab>
          options={[
            { label: 'Invite', value: 'invite' },
            { label: pendingInvites.length > 0 ? `Pending (${pendingInvites.length})` : 'Pending', value: 'pending' },
          ]}
          value={tab}
          onChange={setTab}
          testID="invite-tabs"
        />
        {tab === 'invite' ? (
          <>
            <Text variant="caption" tone="secondary">
              Invites go out by email. A member with no email isn&apos;t listed — add one on their profile first.
            </Text>
            <SearchField value={search} onChangeText={setSearch} placeholder="Search name, ID or email" />
          </>
        ) : null}
      </View>

      {tab === 'invite' ? (
        invitable.isPending ? (
          <View className="gap-3">
            <Skeleton width="100%" height={64} radius="md" />
            <Skeleton width="100%" height={64} radius="md" />
          </View>
        ) : invitable.isError ? (
          <ErrorState error={invitable.error} onRetry={() => invitable.refetch()} />
        ) : (
          <FlashList
            data={members}
            extraData={selected}
            keyExtractor={(member) => String(member.id)}
            renderItem={({ item }) => <InviteMemberRow member={item} selected={selected.has(item.id)} onToggle={toggle} />}
            ListEmptyComponent={
              <EmptyState
                icon={MailPlus}
                title={term ? 'No members match' : 'No one to invite'}
                description={term ? 'Try a different name or email.' : 'Everyone with an email already has a login.'}
              />
            }
            ListFooterComponent={
              invitable.isFetchingNextPage ? (
                <View className="items-center py-4">
                  <Spinner />
                </View>
              ) : (
                <View className="h-24" />
              )
            }
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            refreshing={invitable.isRefetching && !invitable.isFetchingNextPage}
            onRefresh={() => void invitable.refetch()}
            showsVerticalScrollIndicator={false}
          />
        )
      ) : pending.isPending ? (
        <View className="gap-3">
          <Skeleton width="100%" height={120} radius="lg" />
          <Skeleton width="100%" height={120} radius="lg" />
        </View>
      ) : pending.isError ? (
        <ErrorState error={pending.error} onRetry={() => pending.refetch()} />
      ) : (
        <FlashList
          data={pendingInvites}
          keyExtractor={(invite) => String(invite.id)}
          renderItem={({ item }) => (
            <View className="pb-3">
              <PendingInviteRow
                invite={item}
                busy={resend.isPending || revoke.isPending}
                onResend={resendInvite}
                onRevoke={(invite) => {
                  setRevoking(invite);
                  revokeSheetRef.current?.present();
                }}
              />
            </View>
          )}
          ListEmptyComponent={<EmptyState icon={Send} title="No invites waiting" description="Invites you send show up here until the member activates their login." />}
          ListFooterComponent={<View className="h-6" />}
          refreshing={pending.isRefetching}
          onRefresh={() => void pending.refetch()}
          showsVerticalScrollIndicator={false}
        />
      )}

      {tab === 'invite' && selected.size > 0 ? (
        <StickyFooter>
          <Button variant="primary" loading={bulkInvite.isPending} onPress={sendInvites} testID="send-invites">
            {selected.size === 1 ? 'Send 1 invite' : `Send ${selected.size} invites`}
          </Button>
        </StickyFooter>
      ) : null}

      <ConfirmSheet
        ref={revokeSheetRef}
        title="Revoke this invite?"
        description={revoking ? `The link sent to ${memberFullName(revoking.member)} stops working. You can invite them again later.` : 'The link stops working.'}
        confirmLabel="Revoke invite"
        onConfirm={confirmRevoke}
        onDismiss={() => setRevoking(null)}
      />
    </Screen>
  );
}
