const post = jest.fn().mockResolvedValue({ data: { data: { id: 7 } } });
jest.mock('@/lib/axios', () => ({ __esModule: true, default: { post: (...a: unknown[]) => post(...a), get: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() } }));

import { ajoStaffApi } from '@/lib/ajo/staffApi';

describe('recordReceived', () => {
  it('sends the payment, its bank reference and how it was checked as a form, with an idempotency key', async () => {
    await ajoStaffApi.recordReceived(8, { membershipId: 3, amountKobo: BigInt(500000), bankReference: 'NIP-123456', note: 'seen in the 14 Nov statement', paidOn: '2026-11-14', idempotencyKey: 'key-abc' });
    const [url, form, config] = post.mock.calls[0] as [string, FormData, { headers: Record<string, string> }];
    expect(url).toBe('/ajo/groups/8/contributions/record-received');
    expect(form.get('membershipId')).toBe('3');
    expect(form.get('amountKobo')).toBe('500000');
    expect(form.get('bankReference')).toBe('NIP-123456');
    expect(form.get('note')).toBe('seen in the 14 Nov statement');
    expect(form.get('paidOn')).toBe('2026-11-14');
    expect(config.headers['Idempotency-Key']).toBe('key-abc');
  });
});
