import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';
import { z } from 'zod';

import { ApiError } from '@/api/errors';
import { EmptyState } from '@/components/feedback/EmptyState';
import { AttachmentsField } from '@/components/forms/AttachmentsField';
import type { Attachment } from '@/components/forms/attachmentPickers';
import { FieldShell } from '@/components/forms/FieldShell';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { PLATFORM_CATEGORY_OPTIONS, PRIORITY_OPTIONS } from '@/features/support/labels';
import { SUPPORT_ESCALATE_ACCESS, useEscalateTicket } from '@/features/support/queries';
import { useCan } from '@/hooks/useCan';
import type { TicketCategory, TicketPriority } from '@/types/api/support';

const schema = z.object({
  subject: z.string().trim().min(5, 'Give the ticket a subject of at least 5 characters').max(200, 'Keep the subject under 200 characters'),
  summary: z.string().trim().min(10, 'Describe the problem in at least 10 characters').max(5000, 'Keep it under 5,000 characters'),
  category: z.string().min(1, 'Choose a category'),
});
type FormValues = z.infer<typeof schema>;

/**
 * An officer escalates a member's ticket to SocietyLedger support. Only what is written here is shared — the member's
 * ticket and their details are not — and the member is not told.
 */
export default function EscalateTicketScreen() {
  const router = useRouter();
  const { ticketId: ticketIdParam, subject: subjectParam } = useLocalSearchParams<{ ticketId?: string; subject?: string }>();
  const ticketId = Number(ticketIdParam);

  const canEscalate = useCan(SUPPORT_ESCALATE_ACCESS);
  const escalate = useEscalateTicket(ticketId);
  const [priority, setPriority] = useState<TicketPriority>('MEDIUM');
  const [files, setFiles] = useState<Attachment[]>([]);

  const { control, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { subject: subjectParam ? `Escalation: ${subjectParam}`.slice(0, 200) : '', summary: '', category: 'OTHER' },
  });

  const back = () => router.back();

  if (!canEscalate || !Number.isFinite(ticketId)) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Escalate" onBack={back} />
        <EmptyState icon={ShieldCheck} title="Not available" description="Only your association's admins can escalate a ticket to SocietyLedger." />
      </Screen>
    );
  }

  const onSubmit = (values: FormValues) => {
    escalate.mutate(
      {
        subject: values.subject.trim(),
        summary: values.summary.trim(),
        category: values.category as TicketCategory,
        priority,
        files: files.map((f) => ({ uri: f.uri, name: f.name, type: f.type })),
      },
      {
        onSuccess: ({ ticket, attachmentError }) => {
          toast.success(`Sent to SocietyLedger support as ${ticket.ticketNumber}.`);
          if (attachmentError) toast.error(attachmentError);
          // My own ticket to SocietyLedger — the same thread screen a member uses.
          router.replace(`/(app)/(tabs)/profile/help/tickets/${ticket.id}` as never);
        },
        onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not escalate the ticket. Try again.'),
      },
    );
  };

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title="Escalate to SocietyLedger" onBack={back} docsKey="ST11" />

      <View className="gap-5 pb-6">
        <Card className="gap-1">
          <Text variant="body-strong">What is shared</Text>
          <Text variant="body" tone="secondary">
            This opens a new ticket with SocietyLedger&apos;s support team. Only what you write below goes to them — not the member&apos;s ticket or details — and the member isn&apos;t told. A note is left on the original ticket.
          </Text>
        </Card>

        <TextField control={control} name="subject" label="Subject" placeholder="What should SocietyLedger look into?" />
        <TextField control={control} name="summary" label="Describe the problem" placeholder="In your own words, without member names or personal details" multiline />
        <SelectSheet control={control} name="category" label="Category" options={PLATFORM_CATEGORY_OPTIONS} />
        <FieldShell label="Priority">
          <SegmentedControl<TicketPriority> options={PRIORITY_OPTIONS} value={priority} onChange={setPriority} />
        </FieldShell>
        <AttachmentsField files={files} onChange={setFiles} label="Attachments (optional)" helper="Up to 3 files — photos or PDFs, 5MB each." />
      </View>

      <StickyFooter>
        <Button variant="primary" loading={escalate.isPending} onPress={() => { handleSubmit(onSubmit)(); }} testID="send-escalation">
          Escalate
        </Button>
      </StickyFooter>
    </Screen>
  );
}
