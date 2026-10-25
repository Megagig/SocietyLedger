import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { NoPermission } from '@/components/feedback/NoPermission';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { AiGate } from '@/features/ai/components/AiGate';
import { UsageBar } from '@/features/ai/components/AiParts';
import { AI_BUY_ACCESS, packsFor, priceOf } from '@/features/ai/labels';
import { useStartCreditPurchase, useVerifyCreditPurchase } from '@/features/ai/mutations';
import { useAiCredits } from '@/features/ai/queries';
import { waitForCredit } from '@/features/ai/purchase';
import { useCan } from '@/hooks/useCan';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/dates';
import type { AiPurchaseDTO } from '@/types/api/ai';

const PURCHASE_TONE: Record<AiPurchaseDTO['status'], 'success' | 'warning' | 'danger'> = { success: 'success', pending: 'warning', failed: 'danger' };
const PURCHASE_WORDS: Record<AiPurchaseDTO['status'], string> = { success: 'Added', pending: 'Waiting', failed: 'Not paid' };

/** project-overview.md §6.9 AI4 — buy credits with Paystack, the same way as text-message credits. They are added as soon as the payment is confirmed and never expire. */
export default function AiCreditsScreen() {
  return (
    <AiGate title="AI credits">
      <Credits />
    </AiGate>
  );
}

function Credits() {
  const router = useRouter();
  const canBuy = useCan(AI_BUY_ACCESS);
  const query = useAiCredits();
  const start = useStartCreditPurchase();
  const verify = useVerifyCreditPurchase();
  const status = query.data?.status;
  const purchases = query.data?.purchases ?? [];
  const packs = status ? packsFor(status) : [];
  const [chosen, setChosen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState<string | null>(null);
  const credits = chosen ?? packs[0];

  /** `returned` is true when the buyer came back from Paystack; closing the page without paying is checked once and left quiet. */
  async function settle(reference: string, added: number, returned: boolean) {
    const outcome = await waitForCredit(() => verify.mutateAsync(reference), returned ? {} : { tries: 1 });
    if (outcome === 'success') {
      setWaiting(null);
      toast.success(`${added} credits added.`);
    } else if (outcome === 'failed') {
      setWaiting(null);
      toast.error('The payment did not go through. You have not been charged.');
    } else if (returned) {
      setWaiting(reference);
      toast('Waiting for Paystack to confirm. The credits are added as soon as it does.');
    } else {
      setWaiting(null);
    }
    void query.refetch();
  }

  async function buy() {
    if (!credits) return;
    setBusy(true);
    try {
      const init = await start.mutateAsync(credits);
      const browser = await WebBrowser.openAuthSessionAsync(init.authorizationUrl, 'societyledger://');
      // Whatever the buyer did in the browser, ask: closing it early after paying is common
      await settle(init.reference, init.credits, browser.type === 'success');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not start the payment. Nothing was charged.');
    } finally {
      setBusy(false);
    }
  }

  async function checkAgain() {
    if (!waiting) return;
    setBusy(true);
    try {
      const pending = purchases.find((p) => p.reference === waiting);
      await settle(waiting, pending?.credits ?? 0, true);
    } finally {
      setBusy(false);
    }
  }

  if (!canBuy) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="AI credits" onBack={() => router.back()} />
        <NoPermission />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <ScreenHeader title="AI credits" onBack={() => router.back()} docsKey="AI4" />
      <View className="gap-4 pb-8">
        <UsageBar status={status} canBuy={false} onBuy={() => undefined} />

        {query.isPending || !status ? (
          <Skeleton width="100%" height={220} radius="lg" />
        ) : (
          <Card className="gap-3">
            <Text variant="h3">Buy credits</Text>
            <Text variant="body" tone="secondary">
              {`When the day's free requests run out, credits are used instead. Each is ${priceOf(1, status)}, they never expire, and they are added as soon as the payment is confirmed.`}
            </Text>
            <View className="gap-2">
              {packs.map((pack) => {
                const on = credits === pack;
                return (
                  <Pressable
                    key={pack}
                    onPress={() => setChosen(pack)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    className={cn('flex-row items-center justify-between rounded-md border px-4 py-3', on ? 'border-primary bg-primary-soft' : 'border-border bg-surface dark:border-transparent')}
                    testID={`ai-pack-${pack}`}
                  >
                    <Text variant="body-strong">{`${pack} credits`}</Text>
                    <Text variant="num">{priceOf(pack, status)}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text variant="caption" tone="secondary">{`The smallest purchase is ${priceOf(status.minimumCredits, status)}.`}</Text>
            <Button variant="primary" fullWidth loading={busy} disabled={!credits} onPress={() => void buy()} testID="ai-pay">
              {credits ? `Pay ${priceOf(credits, status)} with Paystack` : 'Pay with Paystack'}
            </Button>
            {waiting ? (
              <View className="gap-2" testID="ai-waiting">
                <Text variant="caption" tone="warning">
                  A payment is waiting for Paystack to confirm. If you have paid, your credits will appear shortly.
                </Text>
                <Button variant="secondary" fullWidth loading={busy} onPress={() => void checkAgain()} testID="ai-check-again">
                  Check again
                </Button>
              </View>
            ) : null}
          </Card>
        )}

        {purchases.length > 0 ? (
          <View className="gap-2" testID="ai-purchases">
            <Text variant="h3">Your purchases</Text>
            {purchases.map((p) => (
              <Card key={p.id} className="flex-row items-center justify-between gap-3">
                <View className="gap-0.5">
                  <Text variant="body-strong">{`${p.credits} credits`}</Text>
                  <Text variant="caption" tone="secondary">
                    {formatDate(p.paidAt ?? p.createdAt, 'long')}
                  </Text>
                </View>
                <View className="items-end gap-1">
                  <Money value={p.amount} />
                  <Badge tone={PURCHASE_TONE[p.status]}>{PURCHASE_WORDS[p.status]}</Badge>
                </View>
              </Card>
            ))}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
