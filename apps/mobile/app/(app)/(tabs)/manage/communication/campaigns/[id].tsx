import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef } from 'react';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ConfirmSheet } from '@/components/feedback/ConfirmSheet';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { CostNotice, CountLine, SummaryCard } from '@/features/communication/components/Notices';
import {
  CAMPAIGN_CANCELLABLE,
  CAMPAIGN_DELETABLE,
  CAMPAIGN_STARTABLE,
  CAMPAIGN_STATUS_LABELS,
  campaignProgress,
  campaignStatusKey,
  COMMUNICATION_MODULE,
  RECIPIENT_TYPE_LABELS,
  SMS_CAMPAIGN_ACCESS,
  SMS_VIEW_ACCESS,
} from '@/features/communication/labels';
import { useCancelCampaign, useDeleteCampaign, useStartCampaign } from '@/features/communication/mutations';
import { useAudiencePreview, useCampaign } from '@/features/communication/queries';
import { useCan } from '@/hooks/useCan';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { formatDate } from '@/lib/dates';
import type { AudiencePreviewPayload, SmsCampaignStatus } from '@/types/api/communication';

const when = (iso: string) => `${formatDate(iso, 'long')}, ${formatDate(iso, 'time')}`;

/**
 * project-overview.md §6.9 CM4 — one campaign: its progress while it sends, who it goes to, and what you can do next. A draft can be
 * started (the cost is checked against the balance first), a waiting or sending one can be stopped, and a draft can be deleted.
 */
export default function CampaignDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const allowed = useModuleAccess([SMS_CAMPAIGN_ACCESS, SMS_VIEW_ACCESS], COMMUNICATION_MODULE);
  const canManage = useCan(SMS_CAMPAIGN_ACCESS);
  const query = useCampaign(id);
  const campaign = query.data;
  const startRef = useRef<BottomSheetModal>(null);
  const cancelRef = useRef<BottomSheetModal>(null);
  const deleteRef = useRef<BottomSheetModal>(null);
  const start = useStartCampaign(id);
  const cancel = useCancelCampaign(id);
  const remove = useDeleteCampaign(id);
  const back = () => router.back();

  const status = campaign?.status as SmsCampaignStatus | undefined;
  const startable = !!status && CAMPAIGN_STARTABLE.includes(status);
  // Before it starts, ask what starting it would cost now
  const previewPayload: AudiencePreviewPayload | null =
    campaign && startable ? { recipientType: campaign.recipientType, recipientFilter: campaign.recipientFilter ?? undefined, message: campaign.message } : null;
  const preview = useAudiencePreview(previewPayload);
  const p = preview.data;

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Campaign" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  if (query.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Campaign" onBack={back} docsKey="CM4" />
        <View className="gap-4">
          <Skeleton width="100%" height={96} radius="md" />
          <Skeleton width="100%" height={160} radius="md" />
        </View>
      </Screen>
    );
  }

  if (query.isError || !campaign || !status) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Campaign" onBack={back} docsKey="CM4" />
        <ErrorState error={query.error} title={query.isError ? undefined : 'Campaign not found'} onRetry={() => query.refetch()} />
      </Screen>
    );
  }

  const fail = (fallback: string) => (error: unknown) => toast.error(error instanceof ApiError ? error.message : fallback);
  const sending = status === 'IN_PROGRESS';
  const progress = campaignProgress(campaign.sentCount, campaign.failedCount, campaign.totalRecipients);
  const goHistory = () => router.push(`/(app)/(tabs)/manage/communication/history?campaignId=${campaign.id}` as never);

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader title="Campaign" onBack={back} docsKey="CM4" />

      <View className="gap-6 pb-6">
        <Card>
          <View className="gap-3">
            <View className="flex-row items-start gap-3">
              <View className="flex-1 gap-0.5">
                <Text variant="h3">{campaign.name}</Text>
                <Text variant="caption" tone="secondary">
                  {`${RECIPIENT_TYPE_LABELS[campaign.recipientType]} · created ${when(campaign.createdAt)}`}
                </Text>
              </View>
              <StatusChip status={campaignStatusKey(status)} label={CAMPAIGN_STATUS_LABELS[status]} />
            </View>
            {sending || status === 'COMPLETED' || status === 'INTERRUPTED' || status === 'CANCELLED' ? (
              <View className="gap-1.5">
                <ProgressBar percent={progress} label="Texts sent" />
                <Text variant="caption" tone="secondary">
                  {`${campaign.sentCount.toLocaleString('en-NG')} of ${campaign.totalRecipients.toLocaleString('en-NG')} sent`}
                  {campaign.failedCount > 0 ? ` · ${campaign.failedCount.toLocaleString('en-NG')} failed (refunded)` : ''}
                </Text>
              </View>
            ) : null}
            {sending ? (
              <Text variant="caption" tone="secondary">
                It is sending. You can leave this screen; it carries on.
              </Text>
            ) : null}
            {status === 'INTERRUPTED' ? (
              <Text variant="caption" tone="warning">
                The server restarted before this campaign finished. Credits for the texts that did not go out were refunded. Make a new campaign for the people who were missed.
              </Text>
            ) : null}
            {status === 'SCHEDULED' && campaign.scheduledAt ? (
              <Text variant="caption" tone="secondary">
                {`Goes out ${when(campaign.scheduledAt)}`}
              </Text>
            ) : null}
          </View>
        </Card>

        <Section title="The message">
          <Card>
            <Text variant="body">{campaign.message}</Text>
          </Card>
        </Section>

        {startable ? (
          <SummaryCard title="If you start it now">
            {p ? (
              <>
                <View className="gap-2">
                  <CountLine label="Will get a text" value={p.willText} />
                  <CountLine label="No usable phone number" value={p.noPhone} />
                  <CountLine label="Opted out of texts" value={p.optedOut} />
                </View>
                {p.credits !== null && p.segments !== null && p.enough !== null && p.shortBy !== null ? (
                  <CostNotice segments={p.segments} credits={p.credits} balance={p.balance} enough={p.enough} shortBy={p.shortBy} />
                ) : null}
              </>
            ) : preview.isError ? (
              <Text variant="caption" tone="danger">
                {preview.error instanceof ApiError ? preview.error.message : 'Could not work out the cost.'}
              </Text>
            ) : (
              <Skeleton width="100%" height={72} radius="md" />
            )}
          </SummaryCard>
        ) : null}

        <Section title="Texts">
          <ListGroup>
            <ListItem title="See every text in this campaign" meta="Who got it and whether it arrived" showChevron onPress={goHistory} testID="campaign-texts" />
          </ListGroup>
        </Section>

        {canManage ? (
          <View className="gap-3">
            {startable ? (
              <Button variant="primary" fullWidth loading={start.isPending} disabled={p?.enough === false || p?.willText === 0} onPress={() => startRef.current?.present()} testID="campaign-start">
                Start campaign
              </Button>
            ) : null}
            {CAMPAIGN_CANCELLABLE.includes(status) ? (
              <Button variant="secondary" fullWidth loading={cancel.isPending} onPress={() => cancelRef.current?.present()} testID="campaign-cancel">
                {sending ? 'Stop sending' : 'Cancel campaign'}
              </Button>
            ) : null}
            {CAMPAIGN_DELETABLE.includes(status) ? (
              <Button variant="danger" fullWidth loading={remove.isPending} onPress={() => deleteRef.current?.present()} testID="campaign-delete">
                Delete draft
              </Button>
            ) : null}
          </View>
        ) : null}
      </View>

      <ConfirmSheet
        ref={startRef}
        title="Start this campaign?"
        description={p?.credits != null ? `It texts ${p.willText.toLocaleString('en-NG')} people and uses ${p.credits.toLocaleString('en-NG')} credits. A text that fails is refunded.` : 'Credits are set aside first. A text that fails is refunded.'}
        confirmLabel="Start campaign"
        cancelLabel="Not yet"
        destructive={false}
        onConfirm={() => {
          startRef.current?.dismiss();
          start.mutate(undefined, { onSuccess: () => toast.success('The campaign is sending'), onError: fail('Could not start the campaign. Try again.') });
        }}
      />
      <ConfirmSheet
        ref={cancelRef}
        title={sending ? 'Stop sending?' : 'Cancel this campaign?'}
        description={sending ? 'Texts that have not gone out yet will not be sent, and their credits are refunded. Texts already sent stay sent.' : 'It will not be sent.'}
        confirmLabel={sending ? 'Stop sending' : 'Cancel campaign'}
        cancelLabel="Keep it"
        onConfirm={() => {
          cancelRef.current?.dismiss();
          cancel.mutate(undefined, { onSuccess: () => toast.success('Campaign stopped'), onError: fail('Could not cancel the campaign. Try again.') });
        }}
      />
      <ConfirmSheet
        ref={deleteRef}
        title="Delete this draft?"
        description="It is removed for good. Nothing was sent."
        confirmLabel="Delete draft"
        onConfirm={() => {
          deleteRef.current?.dismiss();
          remove.mutate(undefined, {
            onSuccess: () => {
              toast.success('Draft deleted');
              router.back();
            },
            onError: fail('Could not delete the draft. Try again.'),
          });
        }}
      />
    </Screen>
  );
}
