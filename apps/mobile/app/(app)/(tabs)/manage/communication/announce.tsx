import { zodResolver } from '@hookform/resolvers/zod';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ConfirmSheet } from '@/components/feedback/ConfirmSheet';
import { NoPermission } from '@/components/feedback/NoPermission';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Switch } from '@/components/forms/Switch';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { AudiencePicker } from '@/features/communication/components/AudiencePicker';
import { CostNotice, CountLine, SummaryCard } from '@/features/communication/components/Notices';
import { ANNOUNCE_ACCESS, ANNOUNCEMENT_AUDIENCE_OPTIONS, COMMUNICATION_MODULE, PRIORITY_OPTIONS, SMS_ANY_ACCESS } from '@/features/communication/labels';
import { useSendAnnouncement } from '@/features/communication/mutations';
import { useAnnouncementPreview } from '@/features/communication/queries';
import {
  announcementFormSchema,
  announcementReady,
  audienceProblem,
  emptyAnnouncementValues,
  toAnnouncementPayload,
  type AnnouncementFormValues,
  type AudienceDraft,
} from '@/features/communication/schemas';
import { useCan } from '@/hooks/useCan';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import type { AnnouncementAudience, AnnouncementPayload, AnnouncementPriority, AnnouncementResultDTO } from '@/types/api/communication';

/** A one-line account of what an announcement did, from what the server reports. */
function sentMessage(r: AnnouncementResultDTO): string {
  const parts = [`Sent to ${r.count.toLocaleString('en-NG')} members`];
  if (r.emailsSent > 0) parts.push(`${r.emailsSent.toLocaleString('en-NG')} emails`);
  if (r.smsInProgress) parts.push('texts are still going out');
  else if (r.smsSent > 0 || r.smsFailed > 0) parts.push(`${r.smsSent.toLocaleString('en-NG')} texts${r.smsFailed > 0 ? `, ${r.smsFailed.toLocaleString('en-NG')} failed (refunded)` : ''}`);
  return parts.join(' · ');
}

/**
 * project-overview.md §6.9 CM2 — one announcement to everyone, a category or chosen members. It always reaches the app feed and
 * push of members with a login; email and texts are ticked on top. Before sending it shows who it reaches and misses, and what the
 * texts cost against the balance.
 */
export default function AnnounceScreen() {
  const router = useRouter();
  const allowed = useCan(ANNOUNCE_ACCESS);
  const canText = useModuleAccess(SMS_ANY_ACCESS, COMMUNICATION_MODULE);
  const send = useSendAnnouncement();
  const confirmRef = useRef<BottomSheetModal>(null);
  const { control, handleSubmit } = useForm<AnnouncementFormValues>({ resolver: zodResolver(announcementFormSchema), defaultValues: emptyAnnouncementValues(), mode: 'onTouched' });
  const values = useWatch({ control }) as AnnouncementFormValues;
  const [priority, setPriority] = useState<AnnouncementPriority>('info');
  const [audience, setAudience] = useState<AudienceDraft>({ type: 'ALL', categories: [], memberIds: [], numbers: '' });

  const draft = { values: { ...emptyAnnouncementValues(), ...values }, priority, audience: audience.type as AnnouncementAudience, categories: audience.categories, memberIds: audience.memberIds };
  const ready = announcementReady(draft);
  const payload = ready ? toAnnouncementPayload(draft) : null;
  // The server is asked once typing pauses, not on every key
  const debounced = useDebouncedValue(JSON.stringify(payload), 500);
  const preview = useAnnouncementPreview(debounced === 'null' ? null : (JSON.parse(debounced) as AnnouncementPayload));
  const reach = preview.data?.reach;
  const sms = preview.data?.sms ?? null;
  const cannotAfford = draft.values.sendSms && sms !== null && !sms.enough;
  const problem = audienceProblem(audience);
  const back = () => router.back();

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Announcement" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const submit = () => {
    if (!payload) return;
    send.mutate(payload, {
      onSuccess: (result) => {
        toast.success(sentMessage(result));
        router.back();
      },
      onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not send the announcement. Try again.'),
    });
  };

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title="Announcement" onBack={back} docsKey="CM2" />

      <View className="gap-6 pb-6">
        <Section title="The message">
          <View className="gap-4">
            <TextField control={control} name="title" label="Title" placeholder="Annual general meeting" autoCapitalize="sentences" testID="announce-title" />
            <TextField control={control} name="message" label="Message" multiline autoCapitalize="sentences" placeholder="Write what members need to know" testID="announce-message" />
            <View className="gap-1.5">
              <Text variant="label">How important</Text>
              <SegmentedControl options={PRIORITY_OPTIONS} value={priority} onChange={setPriority} />
            </View>
          </View>
        </Section>

        <Section title="Who gets it">
          <AudiencePicker options={ANNOUNCEMENT_AUDIENCE_OPTIONS} value={audience} onChange={setAudience} testID="announce-audience" />
          {problem ? (
            <Text variant="caption" tone="secondary">
              {problem}
            </Text>
          ) : null}
        </Section>

        <Section title="How it reaches them">
          <Text variant="caption" tone="secondary">
            The app feed and a push notification always go to members who have signed up. Members without a login are reached by email or text only.
          </Text>
          <View className="gap-3">
            <Switch control={control} name="sendEmail" label="Also send by email" />
            {canText ? <Switch control={control} name="sendSms" label="Also send as a text message" helper="Uses SMS credits." /> : null}
            {canText && values.sendSms ? (
              <TextField
                control={control}
                name="smsText"
                label="Text wording (optional)"
                helper="Leave empty to use the title and message."
                multiline
                autoCapitalize="sentences"
                placeholder={preview.data?.smsText}
                testID="announce-sms-text"
              />
            ) : null}
          </View>
        </Section>

        {ready && reach ? (
          <SummaryCard title="Who this reaches">
            <View className="gap-2">
              <CountLine label="Members" value={reach.members} />
              <CountLine label="In the app (have a login)" value={reach.withLogin} />
              <CountLine label="No login" value={reach.noLogin} note={values.sendEmail || values.sendSms ? undefined : 'Not reached unless email or text is ticked'} />
              {values.sendEmail ? <CountLine label="Have an email" value={reach.withEmail} /> : null}
              {values.sendSms ? (
                <>
                  <CountLine label="Will get a text" value={reach.willText} />
                  <CountLine label="No usable phone number" value={reach.noPhone} />
                  <CountLine label="Opted out of texts" value={reach.optedOut} />
                </>
              ) : null}
            </View>
            {values.sendSms && sms ? <CostNotice segments={sms.segments} credits={sms.credits} balance={sms.balance} enough={sms.enough} shortBy={sms.shortBy} /> : null}
          </SummaryCard>
        ) : null}
        {preview.isError ? (
          <Text variant="caption" tone="danger">
            {preview.error instanceof ApiError ? preview.error.message : 'Could not work out who this reaches.'}
          </Text>
        ) : null}
      </View>

      <StickyFooter>
        <View className="flex-1">
          <Button
            variant="primary"
            fullWidth
            disabled={!ready || !!problem || cannotAfford}
            loading={send.isPending}
            onPress={() => {
              void handleSubmit(() => confirmRef.current?.present())();
            }}
            testID="announce-send"
          >
            {reach ? `Send to ${reach.members.toLocaleString('en-NG')} members` : 'Send announcement'}
          </Button>
        </View>
      </StickyFooter>

      <ConfirmSheet
        ref={confirmRef}
        title="Send this announcement?"
        description={
          values.sendSms && sms
            ? `It goes to ${reach?.members.toLocaleString('en-NG') ?? ''} members and the texts use ${sms.credits.toLocaleString('en-NG')} credits. It can’t be taken back.`
            : `It goes to ${reach?.members.toLocaleString('en-NG') ?? 'the'} members you chose. It can’t be taken back.`
        }
        confirmLabel="Send announcement"
        cancelLabel="Not yet"
        destructive={false}
        onConfirm={() => {
          confirmRef.current?.dismiss();
          submit();
        }}
      />
    </Screen>
  );
}
