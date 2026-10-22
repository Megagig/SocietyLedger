import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FileText, LifeBuoy } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';
import { z } from 'zod';

import { ApiError } from '@/api/errors';
import { EmptyState } from '@/components/feedback/EmptyState';
import { AttachmentsField } from '@/components/forms/AttachmentsField';
import type { Attachment } from '@/components/forms/attachmentPickers';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { TextField } from '@/components/forms/TextField';
import { FieldShell } from '@/components/forms/FieldShell';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { IconCircle } from '@/components/ui/IconCircle';
import { Text } from '@/components/ui/Text';
import { CATEGORY_OPTIONS, PLATFORM_CATEGORY_OPTIONS, PRIORITY_OPTIONS } from '@/features/support/labels';
import { SUPPORT_CREATE_ACCESS, SUPPORT_ESCALATE_ACCESS, useCreatePlatformTicket, useCreateTicket, useTicketAssist } from '@/features/support/queries';
import { useCan } from '@/hooks/useCan';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { TicketCategory, TicketPriority } from '@/types/api/support';

const schema = z.object({
  subject: z.string().trim().min(5, 'Give your ticket a subject of at least 5 characters').max(200, 'Keep the subject under 200 characters'),
  description: z.string().trim().min(10, 'Describe the problem in at least 10 characters').max(5000, 'Keep the description under 5,000 characters'),
  category: z.string().min(1, 'Choose a category'),
});

type FormValues = z.infer<typeof schema>;

const AUTO_FILL_CONFIDENCE = 0.7;

/** project-overview.md §6.7 P9 — New ticket: category, priority, subject, description, files; help articles suggested while typing. */
export default function NewTicketScreen() {
  const router = useRouter();
  // /new?to=platform is an association admin's own ticket to SocietyLedger support (Tier 2).
  const { to } = useLocalSearchParams<{ to?: string }>();
  const isPlatform = to === 'platform';
  const canMemberCreate = useCan(SUPPORT_CREATE_ACCESS);
  const canEscalate = useCan(SUPPORT_ESCALATE_ACCESS);
  const canCreate = isPlatform ? canEscalate : canMemberCreate;
  const createMember = useCreateTicket();
  const createPlatform = useCreatePlatformTicket();
  const create = isPlatform ? createPlatform : createMember;

  const { control, handleSubmit, setValue } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { subject: '', description: '', category: 'OTHER' },
  });
  const [priority, setPriority] = useState<TicketPriority>('MEDIUM');
  const [files, setFiles] = useState<Attachment[]>([]);
  // Once the member picks a priority or category themselves, a later AI guess must not overwrite it. Priority is
  // tracked with a flag; the category sheet can't tell us, so a category the AI didn't set (and isn't the default) is theirs.
  const priorityTouched = useRef(false);
  const lastAutoCategory = useRef<string | null>(null);

  const [description, category] = useWatch({ control, name: ['description', 'category'] });
  const debouncedDescription = useDebouncedValue(description, 600);
  const assist = useTicketAssist(debouncedDescription, canCreate);
  const articles = assist.data?.articles ?? [];
  const categorization = assist.data?.categorization ?? null;

  useEffect(() => {
    // The guess comes from the member categories, which a Tier 2 ticket can't use.
    if (isPlatform || !categorization || categorization.confidence <= AUTO_FILL_CONFIDENCE) return;
    if (category === 'OTHER' || category === lastAutoCategory.current) {
      setValue('category', categorization.category);
      lastAutoCategory.current = categorization.category;
    }
    if (!priorityTouched.current) setPriority(categorization.suggestedPriority);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when a new suggestion arrives, not on every keystroke in `category`
  }, [categorization, setValue, isPlatform]);

  const back = () => router.back();

  if (!canCreate) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="New ticket" onBack={back} />
        <EmptyState
          icon={LifeBuoy}
          title="No access"
          description={isPlatform ? "Only your association's admins can contact SocietyLedger support." : "You don't have permission to open support tickets."}
        />
      </Screen>
    );
  }

  const onSubmit = (values: FormValues) => {
    create.mutate(
      {
        subject: values.subject.trim(),
        description: values.description.trim(),
        category: values.category as TicketCategory,
        priority,
        aiCategory: isPlatform ? undefined : categorization?.category,
        aiCategoryConfidence: isPlatform ? undefined : categorization?.confidence,
        files: files.map((f) => ({ uri: f.uri, name: f.name, type: f.type })),
      },
      {
        onSuccess: ({ ticket, attachmentError }) => {
          toast.success(isPlatform ? 'Sent to SocietyLedger support. They will reply here.' : 'Ticket sent. Your association will reply here.');
          if (attachmentError) toast.error(attachmentError);
          router.replace(`/(app)/(tabs)/profile/help/tickets/${ticket.id}` as never);
        },
        onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not send your ticket. Try again.'),
      },
    );
  };

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title={isPlatform ? 'Contact SocietyLedger' : 'New ticket'} onBack={back} docsKey="P9" />

      <View className="gap-5 pb-6">
        <Text variant="body" tone="secondary">
          {isPlatform
            ? "This goes to SocietyLedger's support team — for billing, bugs, modules, data or feature requests. For a question from a member, use their ticket instead."
            : "Your ticket goes to your association's admins. Check the suggested help articles first — one may already answer it."}
        </Text>

        <TextField control={control} name="subject" label="Subject" placeholder="What do you need help with?" />
        <TextField control={control} name="description" label="Describe the problem" placeholder="What happened, and what did you expect?" multiline />

        {articles.length > 0 ? (
          <View className="gap-2">
            <Text variant="label" tone="secondary">
              These articles might help
            </Text>
            <ListGroup>
              {articles.map((article) => (
                <ListItem
                  key={article.id}
                  leading={<IconCircle icon={FileText} tone="info" />}
                  title={article.title}
                  meta={article.excerpt ?? undefined}
                  showChevron
                  onPress={() => router.push(`/(app)/(tabs)/profile/help/article/${article.slug}` as never)}
                />
              ))}
            </ListGroup>
          </View>
        ) : null}

        <SelectSheet
          control={control}
          name="category"
          label="Category"
          options={isPlatform ? PLATFORM_CATEGORY_OPTIONS : CATEGORY_OPTIONS}
          helper={categorization && categorization.confidence > AUTO_FILL_CONFIDENCE ? 'Suggested from your description — change it if it is not right.' : undefined}
        />

        <FieldShell label="Priority">
          <SegmentedControl<TicketPriority>
            options={PRIORITY_OPTIONS}
            value={priority}
            onChange={(next) => {
              priorityTouched.current = true;
              setPriority(next);
            }}
          />
        </FieldShell>

        <AttachmentsField files={files} onChange={setFiles} label="Attachments (optional)" helper="Up to 3 files — photos or PDFs, 5MB each." />
      </View>

      <StickyFooter>
        <Button variant="primary" loading={create.isPending} onPress={() => { handleSubmit(onSubmit)(); }}>
          {isPlatform ? 'Send to SocietyLedger' : 'Send ticket'}
        </Button>
      </StickyFooter>
    </Screen>
  );
}
