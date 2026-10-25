import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LifeBuoy } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';
import { z } from 'zod';

import { ApiError } from '@/api/errors';
import { ConfirmSheet } from '@/components/feedback/ConfirmSheet';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { AttachmentsField } from '@/components/forms/AttachmentsField';
import type { Attachment } from '@/components/forms/attachmentPickers';
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
import { CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS, canCloseTicket } from '@/features/support/labels';
import { SUPPORT_CREATE_ACCESS, useCanViewTickets, useCloseTicket, useReopenTicket, useReplyToTicket, useTicket } from '@/features/support/queries';
import { useCan } from '@/hooks/useCan';
import { formatDate } from '@/lib/dates';
import type { TicketResponseDTO } from '@/types/api/support';

const schema = z.object({ message: z.string().trim().min(1, 'Write a message').max(10000, 'Keep the message under 10,000 characters') });
type FormValues = z.infer<typeof schema>;

function staffName(reply: TicketResponseDTO, platform: boolean): string {
  // SocietyLedger's own staff are shown as the team, not by name.
  if (platform) return 'SocietyLedger support';
  const member = reply.user?.member;
  return member ? `${member.firstName} ${member.lastName}` : 'Support team';
}

/** project-overview.md §6.7 P10 — Ticket thread: chat-style replies, a reply box with files, close and reopen. */
export default function TicketThreadScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const ticketId = Number(id);

  const canView = useCanViewTickets();
  const canReply = useCan(SUPPORT_CREATE_ACCESS);
  const query = useTicket(ticketId);
  const reply = useReplyToTicket(ticketId);
  const close = useCloseTicket(ticketId);
  const reopen = useReopenTicket(ticketId);

  const closeRef = useRef<BottomSheetModal>(null);
  const [files, setFiles] = useState<Attachment[]>([]);
  const { control, handleSubmit, reset } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { message: '' } });

  const back = () => router.back();
  const ticket = query.data;

  if (!canView) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Ticket" onBack={back} />
        <EmptyState icon={LifeBuoy} title="No access" description="You don't have access to support tickets." />
      </Screen>
    );
  }

  if (query.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Ticket" onBack={back} />
        <View className="gap-3">
          <Skeleton width="100%" height={96} radius="lg" />
          <Skeleton width="70%" height={64} radius="lg" />
        </View>
      </Screen>
    );
  }

  // The API 404s a ticket that isn't the caller's, which lands here too.
  if (query.isError || !ticket) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Ticket" onBack={back} />
        <ErrorState title="This ticket isn't available." description="It may not exist, or it isn't yours." error={query.error} onRetry={() => query.refetch()} />
      </Screen>
    );
  }

  const open = canCloseTicket(ticket.status);
  const replies = ticket.responses ?? [];
  const isPlatform = ticket.audience === 'PLATFORM';

  const send = (values: FormValues) => {
    reply.mutate(
      { message: values.message.trim(), files: files.map((f) => ({ uri: f.uri, name: f.name, type: f.type })) },
      {
        onSuccess: ({ attachmentError }) => {
          reset({ message: '' });
          setFiles([]);
          if (attachmentError) toast.error(attachmentError);
        },
        onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not send your message. Try again.'),
      },
    );
  };

  return (
    <Screen edges={['top', 'bottom']} keyboard refreshing={query.isRefetching} onRefresh={() => query.refetch()}>
      <ScreenHeader title={ticket.ticketNumber} onBack={back} docsKey="P10" />

      <View className="gap-4 pb-6">
        <Card className="gap-2">
          <View className="flex-row items-start justify-between gap-3">
            <Text variant="h3" className="flex-1">
              {ticket.subject}
            </Text>
            <StatusChip status={ticket.status.toLowerCase()} label={STATUS_LABELS[ticket.status]} />
          </View>
          <Text variant="caption" tone="secondary">
            {`${CATEGORY_LABELS[ticket.category]} · ${PRIORITY_LABELS[ticket.priority]} priority · opened ${formatDate(ticket.createdAt, 'long')}`}
          </Text>
          {isPlatform ? (
            <Text variant="caption" tone="primary">
              With SocietyLedger support
            </Text>
          ) : null}
          {ticket.status === 'WAITING_ON_USER' ? (
            <Text variant="caption" tone="warning">
              Support is waiting for your reply.
            </Text>
          ) : null}
        </Card>

        <View className="gap-3">
          <ThreadMessage author="You" message={ticket.description} createdAt={ticket.createdAt} fromStaff={false} attachments={ticket.attachments} testID="thread-description" />
          {replies.map((r) => (
            <ThreadMessage
              key={r.id}
              author={r.isStaff ? staffName(r, isPlatform) : 'You'}
              message={r.message}
              createdAt={r.createdAt}
              fromStaff={r.isStaff}
              attachments={r.attachments}
              testID={`thread-reply-${r.id}`}
            />
          ))}
        </View>

        {open ? (
          <Button variant="secondary" loading={close.isPending} onPress={() => closeRef.current?.present()} testID="close-ticket">
            Close this ticket
          </Button>
        ) : null}
      </View>

      <StickyFooter>
        {open ? (
          canReply ? (
            <View className="flex-1 gap-3">
              <AttachmentsField files={files} onChange={setFiles} disabled={reply.isPending} />
              <TextField control={control} name="message" placeholder="Write a reply" multiline />
              <Button variant="primary" loading={reply.isPending} onPress={() => { handleSubmit(send)(); }} testID="send-reply">
                Send reply
              </Button>
            </View>
          ) : null
        ) : (
          <Button
            variant="primary"
            fullWidth
            loading={reopen.isPending}
            onPress={() =>
              reopen.mutate(undefined, {
                onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not reopen the ticket. Try again.'),
              })
            }
            testID="reopen-ticket"
          >
            Reopen this ticket
          </Button>
        )}
      </StickyFooter>

      <ConfirmSheet
        ref={closeRef}
        title="Close this ticket?"
        description="You can reopen it later if you still need help."
        confirmLabel="Close ticket"
        cancelLabel="Keep it open"
        destructive={false}
        onConfirm={() =>
          close.mutate(undefined, {
            onSuccess: () => {
              closeRef.current?.dismiss();
              toast.success('Ticket closed.');
            },
            onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not close the ticket. Try again.'),
          })
        }
      />
    </Screen>
  );
}
