import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { MemberFormFields } from '@/features/members/components/MemberFormFields';
import { useCreateMember, useUpdateMember } from '@/features/members/mutations';
import { MEMBERS_CREATE_ACCESS, MEMBERS_EDIT_ACCESS, useMember, useMemberIdAutoGenerate } from '@/features/members/queries';
import { buildMemberFormSchema, emptyMemberFormValues, memberToFormValues, toMemberPayload, type MemberFormValues } from '@/features/members/schemas';
import { useCan } from '@/hooks/useCan';

/** project-overview.md §6.9 MG3 — add a member, or edit one with `?id=`. One form for both, as on the web. */
export default function MemberFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id ? Number(params.id) : undefined;
  const isEdit = editId !== undefined;

  const canAdd = useCan(MEMBERS_CREATE_ACCESS);
  const canEdit = useCan(MEMBERS_EDIT_ACCESS);
  const allowed = isEdit ? canEdit : canAdd;
  const autoGenerate = useMemberIdAutoGenerate();
  const askMemberId = !isEdit && !autoGenerate;

  const memberQuery = useMember(editId ?? NaN);
  const create = useCreateMember();
  const update = useUpdateMember(editId ?? 0);

  const schema = useMemo(() => buildMemberFormSchema({ requireMemberId: askMemberId }), [askMemberId]);
  const { control, handleSubmit, reset } = useForm<MemberFormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyMemberFormValues(),
    mode: 'onTouched',
  });

  const member = memberQuery.data;
  useEffect(() => {
    if (member) reset(memberToFormValues(member));
  }, [member, reset]);

  const back = () => router.back();
  const title = isEdit ? 'Edit member' : 'Add member';

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  if (isEdit && memberQuery.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title={title} onBack={back} />
        <View className="gap-4">
          <Skeleton width="100%" height={52} radius="md" />
          <Skeleton width="100%" height={52} radius="md" />
          <Skeleton width="100%" height={52} radius="md" />
        </View>
      </Screen>
    );
  }

  if (isEdit && (memberQuery.isError || !member)) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <ErrorState error={memberQuery.error} onRetry={() => memberQuery.refetch()} />
      </Screen>
    );
  }

  const onError = (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Could not save the member. Try again.');

  const onSubmit = (values: MemberFormValues) => {
    if (isEdit) {
      update.mutate(toMemberPayload(values, 'edit'), {
        onSuccess: () => {
          toast.success('Member updated');
          router.back();
        },
        onError,
      });
      return;
    }
    create.mutate(toMemberPayload(values, 'create'), {
      onSuccess: (created) => {
        toast.success('Member added');
        router.replace(`/(app)/(tabs)/manage/members/${created.id}` as never);
      },
      onError,
    });
  };

  const saving = create.isPending || update.isPending;

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title={title} onBack={back} docsKey="MG3" />

      <View className="gap-5 pb-6">
        {member?.status === 'terminated' ? (
          <Text variant="body" tone="danger">
            This member is disabled and can&apos;t sign in. Set the status to Active to give them access again.
          </Text>
        ) : null}
        <MemberFormFields control={control} askMemberId={askMemberId} allowDisabledStatus={member?.status === 'terminated'} />
      </View>

      <StickyFooter>
        <Button variant="primary" loading={saving} onPress={() => { handleSubmit(onSubmit)(); }} testID="member-save">
          Save member
        </Button>
      </StickyFooter>
    </Screen>
  );
}
