import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { NoPermission } from '@/components/feedback/NoPermission';
import { DateTimeField } from '@/components/forms/DateTimeField';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { AudiencePicker } from '@/features/communication/components/AudiencePicker';
import { CostNotice, CountLine, SummaryCard } from '@/features/communication/components/Notices';
import { CAMPAIGN_RECIPIENT_OPTIONS, COMMUNICATION_MODULE, SMS_CAMPAIGN_ACCESS } from '@/features/communication/labels';
import { useCreateCampaign } from '@/features/communication/mutations';
import { useAudiencePreview, useTemplatesInfinite } from '@/features/communication/queries';
import {
  audienceProblem,
  campaignFormSchema,
  emptyAudience,
  emptyCampaignValues,
  toCampaignPayload,
  toRecipientFilter,
  type AudienceDraft,
  type CampaignFormValues,
} from '@/features/communication/schemas';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import type { AudiencePreviewPayload, SmsRecipientType } from '@/types/api/communication';

/**
 * project-overview.md §6.9 CM4 — plan a campaign: who it goes to, what it says, and when. It is saved as a draft (or scheduled) and
 * started from its own screen, where the cost is checked against the balance once more.
 */
export default function NewCampaignScreen() {
  const router = useRouter();
  const allowed = useModuleAccess(SMS_CAMPAIGN_ACCESS, COMMUNICATION_MODULE);
  const create = useCreateCampaign();
  const templates = useTemplatesInfinite();
  const { control, handleSubmit, setValue } = useForm<CampaignFormValues>({ resolver: zodResolver(campaignFormSchema), defaultValues: emptyCampaignValues(), mode: 'onTouched' });
  const values = useWatch({ control }) as CampaignFormValues;
  const [audience, setAudience] = useState<AudienceDraft>(emptyAudience('ALL_MEMBERS'));
  const [templateId, setTemplateId] = useState<string>('');
  const full: AudienceDraft = { ...audience, numbers: values.numbers ?? '' };
  const problem = audienceProblem(full);
  const message = (values.message ?? '').trim();

  const payload: AudiencePreviewPayload | null = problem ? null : { recipientType: audience.type as SmsRecipientType, recipientFilter: toRecipientFilter(full), message: message || undefined };
  const debounced = useDebouncedValue(JSON.stringify(payload), 500);
  const preview = useAudiencePreview(debounced === 'null' ? null : (JSON.parse(debounced) as AudiencePreviewPayload));
  const p = preview.data;
  const back = () => router.back();

  const templateOptions = (templates.data?.pages.flatMap((pg) => pg.templates) ?? []).filter((t) => t.isActive);

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="New campaign" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const submit = (v: CampaignFormValues) => {
    if (problem) {
      toast.error(problem);
      return;
    }
    create.mutate(toCampaignPayload(v, audience, templateId ? Number(templateId) : undefined), {
      onSuccess: (created) => {
        toast.success(v.scheduledAt ? 'Campaign scheduled' : 'Campaign saved. Start it when you are ready.');
        router.replace(`/(app)/(tabs)/manage/communication/campaigns/${created.id}` as never);
      },
      onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not save the campaign. Try again.'),
    });
  };

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title="New campaign" onBack={back} docsKey="CM4" />

      <View className="gap-6 pb-6">
        <Section title="The campaign">
          <TextField control={control} name="name" label="Name" placeholder="Dues reminder" autoCapitalize="sentences" testID="campaign-name" />
        </Section>

        <Section title="Who gets it">
          <AudiencePicker options={CAMPAIGN_RECIPIENT_OPTIONS} value={audience} onChange={setAudience} testID="campaign-audience" />
          {audience.type === 'CUSTOM_NUMBERS' ? (
            <TextField
              control={control}
              name="numbers"
              label="Phone numbers"
              helper="Separate numbers with a comma, a space or a new line."
              multiline
              keyboardType="phone-pad"
              autoCapitalize="none"
              placeholder="08031234567, 08051234567"
              testID="campaign-numbers"
            />
          ) : null}
          {problem ? (
            <Text variant="caption" tone="secondary">
              {problem}
            </Text>
          ) : null}
        </Section>

        <Section title="The message">
          <View className="gap-4">
            {templateOptions.length > 0 ? (
              <View className="gap-1.5">
                <Text variant="label">Start from a template (optional)</Text>
                <View className="flex-row flex-wrap gap-2">
                  {templateOptions.slice(0, 8).map((t) => (
                    <Button
                      key={t.id}
                      variant={templateId === String(t.id) ? 'primary' : 'secondary'}
                      onPress={() => {
                        setTemplateId(String(t.id));
                        setValue('message', t.content, { shouldValidate: true });
                      }}
                    >
                      {t.name}
                    </Button>
                  ))}
                </View>
              </View>
            ) : null}
            <TextField control={control} name="message" label="Message" multiline autoCapitalize="sentences" placeholder="Write the text" testID="campaign-message" />
          </View>
        </Section>

        <Section title="When">
          <DateTimeField control={control} name="scheduledAt" label="Send at (optional)" helper="Leave empty to start it yourself." testID="campaign-when" />
        </Section>

        {p ? (
          <SummaryCard title="Who this reaches">
            <View className="gap-2">
              <CountLine label="Members in this group" value={p.members} />
              <CountLine label="Will get a text" value={p.willText} />
              <CountLine label="No usable phone number" value={p.noPhone} />
              <CountLine label="Opted out of texts" value={p.optedOut} />
              {audience.type === 'CUSTOM_NUMBERS' && p.invalidNumbers.length > 0 ? <CountLine label="Numbers that can’t be texted" value={p.invalidNumbers.length} note={p.invalidNumbers.slice(0, 3).join(', ')} /> : null}
            </View>
            {p.credits !== null && p.segments !== null && p.enough !== null && p.shortBy !== null ? (
              <CostNotice segments={p.segments} credits={p.credits} balance={p.balance} enough={p.enough} shortBy={p.shortBy} />
            ) : null}
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
            loading={create.isPending}
            onPress={() => {
              void handleSubmit(submit)();
            }}
            testID="campaign-save"
          >
            {values.scheduledAt ? 'Schedule campaign' : 'Save campaign'}
          </Button>
        </View>
      </StickyFooter>
    </Screen>
  );
}
