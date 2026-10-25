import type { VerifyPurchaseDTO } from '@/types/api/ai';

export type WaitOptions = { tries?: number; delayMs?: number; sleep?: (ms: number) => Promise<void> };

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * After Paystack closes, asks the server whether the payment went through, a few times, a couple of seconds apart (the webhook or this
 * check adds the credits, whichever comes first). Returns the last answer: `success` once the credits are in, `failed` if Paystack says
 * it failed, `pending` if it was still not confirmed after every try.
 */
export async function waitForCredit(verify: () => Promise<VerifyPurchaseDTO>, { tries = 5, delayMs = 2500, sleep = wait }: WaitOptions = {}): Promise<VerifyPurchaseDTO['status']> {
  let last: VerifyPurchaseDTO['status'] = 'pending';
  for (let attempt = 0; attempt < tries; attempt += 1) {
    if (attempt > 0) await sleep(delayMs);
    try {
      last = (await verify()).status;
    } catch {
      last = 'pending';
    }
    if (last === 'success' || last === 'failed') return last;
  }
  return last;
}
