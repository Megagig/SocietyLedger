/**
 * The "payments waiting" badge in the sidebar is asked in the background on every page. When Ajo is not switched on for the association the
 * server refuses it (403, MODULE_DISABLED). That refusal must be an empty answer: an error would reach the app-wide "this feature isn't part of
 * your plan" pop-up on pages that have nothing to do with Ajo.
 */
const mockGet = jest.fn();
jest.mock('@/lib/axios', () => ({ __esModule: true, default: { get: (...a: unknown[]) => mockGet(...a), post: jest.fn() } }));

import { ajoStaffApi } from '@/lib/ajo/staffApi';

beforeEach(() => mockGet.mockReset());

describe('the waiting-payments badge call', () => {
  it('returns the counts when Ajo is on', async () => {
    mockGet.mockResolvedValue({ status: 200, data: { success: true, data: { transfersToConfirm: 7, cashToCount: 2 } } });
    await expect(ajoStaffApi.waitingCount()).resolves.toEqual({ transfersToConfirm: 7, cashToCount: 2 });
  });

  it('asks for the 403 as an answer, so the app-wide pop-up handler never sees it', async () => {
    mockGet.mockResolvedValue({ status: 403, data: { success: false, error: 'MODULE_DISABLED', code: 'MODULE_DISABLED' } });
    await ajoStaffApi.waitingCount();
    const [url, options] = mockGet.mock.calls[0];
    expect(url).toBe('/ajo/payments/waiting/count');
    // the client only throws (and so reaches the pop-up) for statuses this says are errors; an always-true rule means it never throws
    expect(options.validateStatus(403)).toBe(true);
    expect(options.validateStatus(500)).toBe(true);
  });

  it('is empty, not an error, when Ajo is off or the person may not see it', async () => {
    mockGet.mockResolvedValue({ status: 403, data: { success: false, error: 'MODULE_DISABLED', code: 'MODULE_DISABLED' } });
    await expect(ajoStaffApi.waitingCount()).resolves.toBeNull();
    mockGet.mockResolvedValue({ status: 403, data: { success: false, message: 'Forbidden' } });
    await expect(ajoStaffApi.waitingCount()).resolves.toBeNull();
  });
});
