/**
 * @jest-environment jsdom
 *
 * The page Paystack sends you back to. It must show the answer once the server has given it, in development (where React runs every effect
 * twice, in Strict Mode) as well as in production, and it must never spin forever on a check that gets no answer.
 */
import { StrictMode } from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';

const mockPush = jest.fn();
// Next returns the same router object on every render; a new one each time would hide what this test is about.
const mockRouter = { push: mockPush };
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => new URLSearchParams('trxref=SUB-1&reference=SUB-1'),
}));

const mockVerify = jest.fn();
jest.mock('@/lib/api/subscriptions', () => ({ verifySubscriptionPayment: (...a: unknown[]) => mockVerify(...a) }));

import { VerifyPayment } from '@/components/subscription/VerifyPayment';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLElement;
const successHref = (subdomain?: string) => (subdomain ? `/subscription/success?subdomain=${subdomain}` : '/subscription/success');
const page = (strict: boolean) => {
  const tree = <VerifyPayment successHref={successHref} fallback={{ label: 'Go to Login', href: '/auth/login' }} retryHref="/dashboard/subscription/plans" />;
  return strict ? <StrictMode>{tree}</StrictMode> : tree;
};
async function show(strict = true) {
  await act(async () => { root.render(page(strict)); });
}
const advance = (ms: number) => act(async () => { await jest.advanceTimersByTimeAsync(ms); });
const text = () => host.textContent ?? '';

beforeEach(() => {
  jest.useFakeTimers();
  mockPush.mockClear();
  mockVerify.mockReset();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  jest.useRealTimers();
});

describe('after paying', () => {
  it('shows success and moves on, in Strict Mode (development) as in production', async () => {
    mockVerify.mockResolvedValue({ state: 'success', message: 'Payment verified. Your subscription is active.', subdomain: 'opemulero' });
    await show(true);
    await advance(10);
    expect(text()).toContain('Payment Successful!');
    expect(text()).not.toContain('Verifying Payment');
    await advance(2000);
    expect(mockPush).toHaveBeenCalledWith('/subscription/success?subdomain=opemulero');
  });

  it('does the same without Strict Mode', async () => {
    mockVerify.mockResolvedValue({ state: 'success', message: 'ok', subdomain: 'opemulero' });
    await show(false);
    await advance(10);
    expect(text()).toContain('Payment Successful!');
    expect(mockVerify).toHaveBeenCalledTimes(1);
  });

  it('keeps checking while the provider is still processing, then shows success', async () => {
    mockVerify.mockResolvedValueOnce({ state: 'pending', message: 'processing' }).mockResolvedValue({ state: 'success', message: 'ok', subdomain: 'opemulero' });
    await show(false);
    await advance(10);
    expect(text()).toContain('Verifying Payment');
    await advance(2600);
    expect(text()).toContain('Payment Successful!');
  });

  it('says so when the payment did not go through', async () => {
    mockVerify.mockResolvedValue({ state: 'failed', message: 'Declined.' });
    await show(true);
    await advance(10);
    expect(text()).toContain('Payment Not Completed');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('stops spinning when a check gets no answer at all, and tells the person it is still processing', async () => {
    mockVerify.mockImplementation(() => new Promise(() => undefined)); // a request that never comes back
    await show(false);
    await advance(10);
    expect(text()).toContain('Verifying Payment');
    await advance(30_000 * 8 + 2500 * 8 + 100);
    expect(text()).toContain('Payment is processing');
    expect(text()).not.toContain('Verifying Payment');
  });

  it('shows an error, not a spinner, when the server cannot be reached', async () => {
    mockVerify.mockRejectedValue(new Error('network'));
    await show(true);
    await advance(10);
    expect(text()).toContain('Verification Failed');
  });

  it('does not redirect after the person has left the page', async () => {
    mockVerify.mockResolvedValue({ state: 'success', message: 'ok', subdomain: 'opemulero' });
    await show(false);
    await advance(10);
    await act(async () => root.unmount());
    root = createRoot(host);
    await advance(3000);
    expect(mockPush).not.toHaveBeenCalled();
  });
  it('is not restarted when the page around it re-renders and passes a new inline function', async () => {
    mockVerify.mockImplementation(() => new Promise(() => undefined)); // still waiting for an answer
    const inline = () => <VerifyPayment successHref={() => '/dashboard/subscription/success'} fallback={{ label: 'Go', href: '/x' }} retryHref="/y" />;
    await act(async () => { root.render(inline()); });
    await advance(10);
    await act(async () => { root.render(inline()); });
    await act(async () => { root.render(inline()); });
    await advance(10);
    expect(mockVerify).toHaveBeenCalledTimes(1);
  });

});
