'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Badge, Button, Loader, Paper, Text } from '@mantine/core';
import { aiApi, AICreditPurchase, AIStatusDetail } from '@/lib/api/ai';
import { toast } from '@/lib/toast';

const naira = (v: number | string) => `₦${Number(v).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const TONE = { success: 'green', pending: 'yellow', failed: 'red' } as const;
const WORDS = { success: 'Added', pending: 'Waiting', failed: 'Not paid' } as const;

function Credits() {
  const reference = useSearchParams().get('reference');
  const [status, setStatus] = useState<AIStatusDetail | null>(null);
  const [purchases, setPurchases] = useState<AICreditPurchase[]>([]);
  const [chosen, setChosen] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [checking, setChecking] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await aiApi.getCredits();
      setStatus(res.data.status);
      setPurchases(res.data.purchases);
      // A payment that was made but never confirmed (the buyer closed the tab, or Paystack could not reach the server): ask Paystack now
      const waiting = res.data.purchases.filter((p) => p.status === 'pending');
      if (waiting.length > 0) {
        const results = await Promise.all(waiting.map((p) => aiApi.verifyCredits(p.reference).catch(() => null)));
        if (results.some((r) => r?.data.status === 'success' || r?.data.status === 'failed')) {
          const fresh = await aiApi.getCredits();
          setStatus(fresh.data.status);
          setPurchases(fresh.data.purchases);
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load credits');
    } finally {
      setLoading(false);
    }
  }, []);

  // Back from Paystack: ask whether the payment went through (the webhook may already have added the credits)
  useEffect(() => {
    void load();
    if (!reference) return;
    setChecking(true);
    (async () => {
      for (let i = 0; i < 5; i += 1) {
        try {
          const res = await aiApi.verifyCredits(reference);
          if (res.data.status === 'success') {
            toast.success(`${res.data.credits} credits added.`);
            break;
          }
          if (res.data.status === 'failed') {
            toast.error('The payment did not go through. You have not been charged.');
            break;
          }
        } catch {
          /* try again */
        }
        await new Promise((r) => setTimeout(r, 2500));
      }
      setChecking(false);
      void load();
    })();
  }, [reference, load]);

  const packs = status ? [1, 2, 4, 10].map((m) => status.minimumCredits * m) : [];
  const credits = chosen ?? packs[0];

  const pay = async () => {
    if (!credits) return;
    setPaying(true);
    try {
      const res = await aiApi.purchaseCredits(credits);
      window.location.href = res.data.authorizationUrl;
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Could not start the payment. Nothing was charged.');
      setPaying(false);
    }
  };

  if (loading || !status) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl">
      <h1 className="text-2xl sm:text-3xl font-bold mb-2">AI credits</h1>
      <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-6">
        When the day&apos;s free requests run out, credits are used instead. Each costs {naira(status.creditPriceNaira)}, they never expire, and they are added as soon as the payment is confirmed.
      </p>

      <Paper className="p-4 mb-6" withBorder>
        <Text fw={600}>
          {status.allowanceLeft} free requests left today · {status.credits} {status.credits === 1 ? 'credit' : 'credits'}
        </Text>
        <Text size="sm" c="dimmed">
          Your plan includes {status.allowancePerDay} free requests a day. A question costs {status.weights.question}, a report {status.weights.report}.
        </Text>
        {checking && (
          <Text size="sm" c="yellow" mt="xs">
            Confirming your payment with Paystack…
          </Text>
        )}
      </Paper>

      <Paper className="p-4 mb-6" withBorder>
        <Text fw={600} mb="sm">
          Buy credits
        </Text>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {packs.map((pack) => (
            <Button key={pack} variant={credits === pack ? 'filled' : 'default'} onClick={() => setChosen(pack)}>
              {pack} · {naira(pack * status.creditPriceNaira)}
            </Button>
          ))}
        </div>
        <Text size="xs" c="dimmed" mb="sm">
          The smallest purchase is {naira(status.minimumCredits * status.creditPriceNaira)}.
        </Text>
        <Button loading={paying} disabled={!credits} onClick={pay}>
          {credits ? `Pay ${naira(credits * status.creditPriceNaira)} with Paystack` : 'Pay with Paystack'}
        </Button>
      </Paper>

      {purchases.length > 0 && (
        <div>
          <Text fw={600} mb="sm">
            Your purchases
          </Text>
          <div className="space-y-2">
            {purchases.map((p) => (
              <Paper key={p.id} className="p-3 flex items-center justify-between" withBorder>
                <div>
                  <Text fw={600} size="sm">
                    {p.credits} credits
                  </Text>
                  <Text size="xs" c="dimmed">
                    {new Date(p.paidAt ?? p.createdAt).toLocaleDateString()}
                  </Text>
                </div>
                <div className="text-right">
                  <Text size="sm">{naira(p.amount)}</Text>
                  <Badge color={TONE[p.status]} size="sm">
                    {WORDS[p.status]}
                  </Badge>
                </div>
              </Paper>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AICreditsPage() {
  return (
    <Suspense fallback={null}>
      <Credits />
    </Suspense>
  );
}
