import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LifeBuoy } from 'lucide-react-native';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';
import { z } from 'zod';

import { ApiError } from '@/api/errors';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { AttachmentsField } from '@/components/forms/AttachmentsField';
import type { Attachment } from '@/components/forms/attachmentPickers';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { ThreadMessage } from '@/features/support/components/ThreadMessage';
import { CATEGORY_LABELS, PRIORITY_LABELS, STAFF_STATUS_LABELS, STATUS_ACTIONS, isOpenTicket } from '@/features/support/labels';
import { SUPPORT_ESCALATE_ACCESS, SUPPORT_STAFF_ACCESS, useReplySuggestion, useReplyToTicket, useTicket, useUpdateTicket } from '@/features/support/queries';
import { useCan } from '@/hooks/useCan';
import { formatDate } from '@/lib/dates';
import { useSessionStore } from '@/stores/session';
import type { TicketDTO, TicketResponseDTO } from '@/types/api/support';

const schema = z.object({ message: z.string().trim().min(1, 'Write a message').max(10000, 'Keep the message under 10,000 characters') });
type FormValues = z.infer<typeof schema>;
type Mode = 'reply' | 'note';

const nameOf = (person?: { email: string; member?: { firstName: string; lastName: string } | null } | null) =>
  person?.member ? `${person.member.firstName} ${person.member.lastName}` : person?.email ?? 'Unknown';

/** project-overview.md §6.9 ST11 — a member's ticket, worked by the association's staff: reply, internal notes, assign, status, escalate. */
export default function StaffTicketScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const ticketId = Number(id);

  const isStaff = useCan(SUPPORT_STAFF_ACCESS);
  const canManage = useCan('SUPPORT_MANAGE');
  const canEscalate = useCan(SUPPORT_ESCALATE_ACCESS);
  const meId = useSessionStore((s) => s.user?.id);

  const query = useTicket(ticketId);
  const reply = useReplyToTicket(ticketId);
  const update = useUpdateTicket(ticketId);
  const suggest = useReplySuggestion();

  const [mode, setMode] = useState<Mode>('reply');
  const [files, setFiles] = useState<Attachment[]>([]);
  const { control, handleSubmit, reset, setValue } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { message: '' } });

  const back = () => router.back();
  const ticket: TicketDTO | undefined = query.data;

  if (!isStaff) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Ticket" onBack={back} />
        <EmptyState icon={LifeBuoy} title="No access" description="Support tickets are handled by your association's admins and officers." />
      </Screen>
    );
  }

  if (query.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Ticket" onBack={back} />
        <View className="gap-3">
          <Skeleton width="100%" height={110} radius="lg" />
          <Skeleton width="70%" height={64} radius="lg" />
        </View>
      </Screen>
    );
  }

  if (query.isError || !ticket) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Ticket" onBack={back} />
        <ErrorState title="This ticket isn't available." description="It may not exist in your association." error={query.error} onRetry={() => query.refetch()} />
      </Screen>
    );
  }

  const open = isOpenTicket(ticket.status);
  const replies: TicketResponseDTO[] = ticket.responses ?? [];
  const assignedToMe = ticket.assignedTo?.id === meId;

  const send = (values: FormValues) => {
    reply.mutate(
      { message: values.message.trim(), files: files.map((f) => ({ uri: f.uri, name: f.name, type: f.type })), isInternal: mode === 'note' },
      {
        onSuccess: ({ attachmentError }) => {
          reset({ message: '' });
          setFiles([]);
          toast.success(mode === 'note' ? 'Internal note added.' : 'Reply sent. The member has been notified.');
          if (attachmentError) toast.error(attachmentError);
        },
        onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not send. Try again.'),
      },
    );
  };

  const change = (body: Parameters<typeof update.mutate>[0], done: string) =>
    update.mutate(body, {
      onSuccess: () => toast.success(done),
      onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not update the ticket. Try again.'),
    });

  const draftReply = () =>
    suggest.mutate(
      { subject: ticket.subject, description: ticket.description, category: ticket.category },
      {
        onSuccess: (result) => {
          if (result) {
            setMode('reply');
            setValue('message', result.suggestion, { shouldValidate: true });
          } else {
            toast('No suggestion available right now. Write your reply yourself.');
          }
        },
      },
    );

  return (
    <Screen edges={['top', 'bottom']} keyboard refreshing={query.isRefetching} onRefresh={() => query.refetch()}>
      <ScreenHeader title={ticket.ticketNumber} onBack={back} docsKey="ST11" />

      <View className="gap-4 pb-6">
        <Card className="gap-2">
          <View className="flex-row items-start justify-between gap-3">
            <Text variant="h3" className="flex-1">
              {ticket.subject}
            </Text>
            <StatusChip status={ticket.status.toLowerCase()} label={STAFF_STATUS_LABELS[ticket.status]} />
          </View>
          <Text variant="caption" tone="secondary">
            {`${nameOf(ticket.user)} · opened ${formatDate(ticket.createdAt, 'long')}`}
          </Text>
          <Text variant="caption" tone="secondary">
            {`${CATEGORY_LABELS[ticket.category]} · ${PRIORITY_LABELS[ticket.priority]} priority`}
          </Text>
          <Text variant="caption" tone={assignedToMe ? 'primary' : 'secondary'}>
            {ticket.assignedTo ? (assignedToMe ? 'Assigned to you' : `Assigned to ${nameOf(ticket.assignedTo)}`) : 'Not assigned yet'}
          </Text>
        </Card>

        {canManage ? (
          <View className="flex-row flex-wrap gap-2">
            {!assignedToMe && meId !== undefined ? (
              <Button variant="secondary" size="sm" loading={update.isPending} onPress={() => change({ assignedToId: meId }, 'Assigned to you.')} testID="assign-me">
                Assign to me
              </Button>
            ) : null}
            {STATUS_ACTIONS[ticket.status].map((action) => (
              <Button
                key={action.status}
                variant="secondary"
                size="sm"
                loading={update.isPending}
                onPress={() => change({ status: action.status }, `Ticket ${STAFF_STATUS_LABELS[action.status].toLowerCase()}.`)}
              >
                {action.label}
              </Button>
            ))}
          </View>
        ) : null}

        {canEscalate && open ? (
          <Button
            variant="accent-ghost"
            onPress={() => router.push({ pathname: '/(app)/(tabs)/manage/support/escalate', params: { ticketId: String(ticket.id), subject: ticket.subject } } as never)}
            testID="escalate"
          >
            Escalate to SocietyLedger
          </Button>
        ) : null}

        <View className="gap-3">
          <ThreadMessage
            author={nameOf(ticket.user)}
            message={ticket.description}
            createdAt={ticket.createdAt}
            fromStaff={false}
            perspective="staff"
            attachments={ticket.attachments}
            testID="thread-description"
          />
          {replies.map((r) => (
            <ThreadMessage
              key={r.id}
              author={nameOf(r.user)}
              message={r.message}
              createdAt={r.createdAt}
              fromStaff={r.isStaff}
              perspective="staff"
              internal={r.isInternal}
              attachments={r.attachments}
              testID={`thread-reply-${r.id}`}
            />
          ))}
        </View>
      </View>

      <StickyFooter>
        <View className="flex-1 gap-3">
          <SegmentedControl<Mode>
            options={[
              { label: 'Reply to member', value: 'reply' },
              { label: 'Internal note', value: 'note' },
            ]}
            value={mode}
            onChange={setMode}
          />
          <AttachmentsField files={files} onChange={setFiles} disabled={reply.isPending} />
          <TextField control={control} name="message" placeholder={mode === 'note' ? 'Add a note for the team — the member will not see it' : 'Write your reply'} multiline />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Button variant="secondary" fullWidth loading={suggest.isPending} onPress={draftReply} testID="suggest-reply">
                Suggest a reply
              </Button>
            </View>
            <View className="flex-1">
              <Button variant="primary" fullWidth loading={reply.isPending} onPress={() => { handleSubmit(send)(); }} testID="send-staff-reply">
                {mode === 'note' ? 'Add note' : 'Send reply'}
              </Button>
            </View>
          </View>
        </View>
      </StickyFooter>
    </Screen>
  );
}
