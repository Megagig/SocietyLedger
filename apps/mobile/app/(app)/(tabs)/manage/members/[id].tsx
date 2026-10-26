import { useLocalSearchParams, useRouter } from 'expo-router';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Pencil } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ConfirmSheet } from '@/components/feedback/ConfirmSheet';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Avatar } from '@/components/ui/Avatar';
import { EditableAvatar } from '@/features/members/components/EditableAvatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FilterChip } from '@/components/ui/FilterChip';
import { IconButton } from '@/components/ui/IconButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { mailUrl, openContactUrl, telUrl, whatsappUrl } from '@/features/members/contact';
import { loginStatusLabel, loginStatusTone, memberFullName, statusLabel } from '@/features/members/labels';
import { useDisableMember, useEnableMember } from '@/features/members/mutations';
import {
  MEMBER_ATTENDANCE_ACCESS,
  MEMBER_COOPERATIVE_ACCESS,
  MEMBER_FINANCE_ACCESS,
  MEMBER_WELFARE_ACCESS,
  MEMBERS_DISABLE_ACCESS,
  MEMBERS_EDIT_ACCESS,
  MEMBERS_VIEW_ACCESS,
  useMember,
} from '@/features/members/queries';
import { MemberAttendanceTab } from '@/features/members/components/MemberAttendanceTab';
import { MemberCooperativeTab } from '@/features/members/components/MemberCooperativeTab';
import { MemberFinanceTab } from '@/features/members/components/MemberFinanceTab';
import { MemberProfileTab } from '@/features/members/components/MemberProfileTab';
import { MemberWelfareTab } from '@/features/members/components/MemberWelfareTab';
import { useCan } from '@/hooks/useCan';
import { useModuleAccess } from '@/hooks/useModuleAccess';

type TabKey = 'profile' | 'finance' | 'attendance' | 'cooperative' | 'welfare';

const TAB_LABELS: Record<TabKey, string> = {
  profile: 'Profile',
  finance: 'Finance',
  attendance: 'Attendance',
  cooperative: 'Cooperative',
  welfare: 'Welfare',
};

/** project-overview.md §6.9 MG2 — one member: contact actions and tabs for profile, finance, attendance, cooperative and welfare. */
export default function MemberDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);

  const canView = useCan(MEMBERS_VIEW_ACCESS);
  const canFinance = useCan(MEMBER_FINANCE_ACCESS);
  const canAttendance = useModuleAccess(MEMBER_ATTENDANCE_ACCESS, 'meetings');
  const canCooperative = useModuleAccess(MEMBER_COOPERATIVE_ACCESS, 'cooperatives');
  const canWelfare = useModuleAccess(MEMBER_WELFARE_ACCESS, 'welfare');
  const canEdit = useCan(MEMBERS_EDIT_ACCESS);
  const canDisable = useCan(MEMBERS_DISABLE_ACCESS);
  const [tab, setTab] = useState<TabKey>('profile');
  const disableSheetRef = useRef<BottomSheetModal>(null);

  const query = useMember(id);
  const disable = useDisableMember(id);
  const enable = useEnableMember(id);
  const failMessage = (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Could not update the member. Try again.');
  const back = () => router.back();

  if (!canView) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Member" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const member = query.data;
  const tabs: TabKey[] = [
    'profile',
    ...(canFinance ? (['finance'] as const) : []),
    ...(canAttendance ? (['attendance'] as const) : []),
    ...(canCooperative ? (['cooperative'] as const) : []),
    ...(canWelfare ? (['welfare'] as const) : []),
  ];

  const contact = async (url: string | null, failure: string) => {
    if (!url || !(await openContactUrl(url))) toast.error(failure);
  };

  return (
    <Screen edges={['top']} refreshing={query.isRefetching} onRefresh={() => query.refetch()}>
      <ScreenHeader
        title={member ? memberFullName(member) : 'Member'}
        onBack={back}
        docsKey="MG2"
        rightActions={
          member && canEdit ? (
            <IconButton icon={Pencil} accessibilityLabel="Edit member" onPress={() => router.push(`/(app)/(tabs)/manage/members/form?id=${member.id}` as never)} testID="member-edit" />
          ) : undefined
        }
      />

      {query.isPending ? (
        <View className="gap-4 pb-6">
          <Skeleton width="100%" height={96} radius="lg" />
          <Skeleton width="100%" height={200} radius="md" />
        </View>
      ) : query.isError || !member ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <View className="gap-5 pb-8">
          <View className="items-center gap-2 pt-1">
            {canEdit ? (
              <EditableAvatar name={memberFullName(member)} size={96} colorSeed={member.id} imageUrl={member.photoUrl} target={{ kind: 'member', id: member.id }} testID="member-photo" />
            ) : (
              <Avatar name={memberFullName(member)} size={96} colorSeed={member.id} imageUrl={member.photoUrl} />
            )}
            <Text variant="h2" align="center">
              {memberFullName(member)}
            </Text>
            <Text variant="caption" tone="secondary">
              {member.memberId}
            </Text>
            <View className="flex-row items-center gap-2">
              <StatusChip status={member.status.toLowerCase()} label={statusLabel(member.status.toLowerCase())} />
              <Badge tone={loginStatusTone(member.loginStatus)}>{loginStatusLabel(member.loginStatus)}</Badge>
            </View>
          </View>

          {member.phone || member.email ? (
            <View className="flex-row gap-3">
              {member.phone ? (
                <>
                  <View className="flex-1">
                    <Button variant="soft" size="sm" fullWidth onPress={() => void contact(telUrl(member.phone), "Couldn't open the phone app.")} testID="member-call">
                      Call
                    </Button>
                  </View>
                  <View className="flex-1">
                    <Button variant="soft" size="sm" fullWidth onPress={() => void contact(whatsappUrl(member.phone), "Couldn't open WhatsApp.")} testID="member-whatsapp">
                      WhatsApp
                    </Button>
                  </View>
                </>
              ) : null}
              {member.email ? (
                <View className="flex-1">
                  <Button variant="soft" size="sm" fullWidth onPress={() => void contact(mailUrl(member.email), "Couldn't open your email app.")} testID="member-email">
                    Email
                  </Button>
                </View>
              ) : null}
            </View>
          ) : null}

          {tabs.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {tabs.map((key) => (
                <FilterChip key={key} label={TAB_LABELS[key]} active={tab === key} onPress={() => setTab(key)} />
              ))}
            </ScrollView>
          ) : null}

          {tab === 'profile' ? <MemberProfileTab member={member} /> : null}
          {tab === 'finance' ? <MemberFinanceTab memberId={member.id} /> : null}
          {tab === 'attendance' ? <MemberAttendanceTab memberId={member.id} /> : null}
          {tab === 'cooperative' ? <MemberCooperativeTab memberId={member.id} /> : null}
          {tab === 'welfare' ? <MemberWelfareTab memberId={member.id} /> : null}

          {/* Disabling needs members.disable; enabling is a status edit, so it needs members.edit (the API checks the same). */}
          {(member.status === 'terminated' ? canEdit : canDisable) ? (
            <View className="mt-6 border-t border-border pt-6">
              {member.status === 'terminated' ? (
                <Button variant="soft" loading={enable.isPending} onPress={() => enable.mutate(undefined, { onSuccess: () => toast.success('Member enabled'), onError: failMessage })} testID="member-enable">
                  Enable member
                </Button>
              ) : (
                <Button variant="danger-ghost" onPress={() => disableSheetRef.current?.present()} testID="member-disable">
                  Disable member
                </Button>
              )}
            </View>
          ) : null}
        </View>
      )}

      <ConfirmSheet
        ref={disableSheetRef}
        title="Disable this member?"
        description={`${member ? memberFullName(member) : 'They'} won't be able to sign in, and they're marked Disabled. You can enable them again any time.`}
        confirmLabel="Disable member"
        onConfirm={() =>
          disable.mutate(undefined, {
            onSuccess: () => {
              disableSheetRef.current?.dismiss();
              toast.success('Member disabled');
            },
            onError: failMessage,
          })
        }
      />
    </Screen>
  );
}
