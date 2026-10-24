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
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { MemberMultiPicker } from '@/features/communication/components/MemberMultiPicker';
import { CostNotice, CountLine, SummaryCard } from '@/features/communication/components/Notices';
import { COMMUNICATION_MODULE, parseNumbers, SMS_SEND_ACCESS } from '@/features/communication/labels';
import { useSendQuickSms } from '@/features/communication/mutations';
import { useAudiencePreview } from '@/features/communication/queries';
import { quickSmsSchema, type QuickSmsValues } from '@/features/communication/schemas';
import { MEMBERS_VIEW_ACCESS } from '@/features/members/queries';
import { useCan } from '@/hooks/useCan';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import type { AudiencePreviewPayload, QuickSmsResultDTO } from '@/types/api/communication';

type Mode = 'MEMBERS' | 'NUMBERS';

/** What a quick send did, said plainly: a text that fails is refunded and counted, never reported as sent. */
function resultMessage(r: QuickSmsResultDTO): string {
  if (r.inProgress) return `Sending to ${(r.accepted ?? 0).toLocaleString('en-NG')} people. You can leave this screen.`;
  if (r.totalFailed > 0) return `${r.totalSent.toLocaleString('en-NG')} sent, ${r.totalFailed.toLocaleString('en-NG')} did not go out (those credits are refunded).`;
  return `Sent to ${r.totalSent.toLocaleString('en-NG')} ${r.totalSent === 1 ? 'person' : 'people'}.`;
}

/**
 * project-overview.md §6.9 CM3 — a quick text to a few members or phone numbers. The same sending engine as campaigns: credits are set
 * aside first, each text is recorded before it goes, and one that fails is refunded.
 */
export default function QuickSmsScreen() {
  const router = useRouter();
  const allowed = useModuleAccess(SMS_SEND_ACCESS, COMMUNICATION_MODULE);
  const canPickMembers = useCan(MEMBERS_VIEW_ACCESS);
  const send = useSendQuickSms();
  const confirmRef = useRef<BottomSheetModal>(null);
  const { control, handleSubmit } = useForm<QuickSmsValues>({ resolver: zodResolver(quickSmsSchema), defaultValues: { message: '', numbers: '' }, mode: 'onTouched' });
  const values = useWatch({ control }) as QuickSmsValues;
  const [mode, setMode] = useState<Mode>(canPickMembers ? 'MEMBERS' : 'NUMBERS');
  const [memberIds, setMemberIds] = useState<number[]>([]);
  const numbers = parseNumbers(values.numbers ?? '');
  const message = (values.message ?? '').trim();
  const named = mode === 'MEMBERS' ? memberIds.length > 0 : numbers.length > 0;

  const payload: AudiencePreviewPayload | null = named
    ? mode === 'MEMBERS'
      ? { recipientType: 'SELECTED_MEMBERS', recipientFilter: { memberIds }, message: message || undefined }
      : { recipientType: 'CUSTOM_NUMBERS', recipientFilter: { customNumbers: numbers }, message: message || undefined }
    : null;
  const debounced = useDebouncedValue(JSON.stringify(payload), 500);
  const preview = useAudiencePreview(debounced === 'null' ? null : (JSON.parse(debounced) as AudiencePreviewPayload));
  const p = preview.data;
  const cannotAfford = p?.enough === false;
  const back = () => router.back();

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Quick text" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const submit = (v: QuickSmsValues) => {
    const recipients = mode === 'MEMBERS' ? memberIds.map(String) : parseNumbers(v.numbers);
    send.mutate(
      { recipients, message: v.message.trim() },
      {
        onSuccess: (result) => {
          toast.success(resultMessage(result));
          router.back();
        },
        onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not send the text. Try again.'),
      },
    );
  };

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title="Quick text" onBack={back} docsKey="CM3" />

      <View className="gap-6 pb-6">
        <Section title="Who to text">
          <View className="gap-3">
            {canPickMembers ? (
              <SegmentedControl
                options={[
                  { label: 'Members', value: 'MEMBERS' },
                  { label: 'Phone numbers', value: 'NUMBERS' },
                ]}
                value={mode}
                onChange={setMode}
              />
            ) : null}
            {mode === 'MEMBERS' ? (
              <MemberMultiPicker value={memberIds} onChange={setMemberIds} testID="sms-members" />
            ) : (
              <TextField
                control={control}
                name="numbers"
                label="Phone numbers"
                helper="Separate numbers with a comma, a space or a new line."
                multiline
                keyboardType="phone-pad"
                autoCapitalize="none"
                placeholder="08031234567, 08051234567"
                testID="sms-numbers"
              />
            )}
          </View>
        </Section>

        <Section title="The message">
          <TextField control={control} name="message" label="Message" multiline autoCapitalize="sentences" placeholder="Write the text" testID="sms-message" />
        </Section>

        {p ? (
          <SummaryCard title="Before you send">
            <View className="gap-2">
              <CountLine label="Will get a text" value={p.willText} />
              <CountLine label="No usable phone number" value={p.noPhone} />
              {p.invalidNumbers.length > 0 ? <CountLine label="Numbers that can’t be texted" value={p.invalidNumbers.length} note={p.invalidNumbers.slice(0, 3).join(', ')} /> : null}
            </View>
            {p.credits !== null && p.segments !== null && p.enough !== null && p.shortBy !== null ? (
              <CostNotice segments={p.segments} credits={p.credits} balance={p.balance} enough={p.enough} shortBy={p.shortBy} />
            ) : (
              <Text variant="caption" tone="secondary">
                Write the message to see what it costs.
              </Text>
            )}
          </SummaryCard>
        ) : null}
        {preview.isError ? (
          <Text variant="caption" tone="danger">
            {preview.error instanceof ApiError ? preview.error.message : 'Could not work out the cost.'}
          </Text>
        ) : null}
      </View>

      <StickyFooter>
        <View className="flex-1">
          <Button
            variant="primary"
            fullWidth
            disabled={!named || !message || cannotAfford || p?.willText === 0}
            loading={send.isPending}
            onPress={() => {
              void handleSubmit(() => confirmRef.current?.present())();
            }}
            testID="sms-send"
          >
            {p ? `Send to ${p.willText.toLocaleString('en-NG')}` : 'Send text'}
          </Button>
        </View>
      </StickyFooter>

      <ConfirmSheet
        ref={confirmRef}
        title="Send this text?"
        description={p?.credits != null ? `It uses ${p.credits.toLocaleString('en-NG')} credits. A text that fails is refunded.` : 'A text that fails is refunded.'}
        confirmLabel="Send text"
        cancelLabel="Not yet"
        destructive={false}
        onConfirm={() => {
          confirmRef.current?.dismiss();
          void handleSubmit(submit)();
        }}
      />
    </Screen>
  );
}
