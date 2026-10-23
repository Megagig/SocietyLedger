jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));

import { attentionCount } from '@/features/dashboard/queries';
import { attentionRows } from './attention';

jest.mock('@/hooks/useTenantKey', () => ({ useTenantKey: () => 't' }));
jest.mock('@/api/endpoints/dashboard', () => ({ attentionApi: {}, dashboardApi: {} }));

describe('attentionRows', () => {
  it('words each queue with its count, singular and plural', () => {
    const rows = attentionRows([
      { key: 'paymentProofs', count: 1 },
      { key: 'paymentProofs' as const, count: 3 },
    ]);
    expect(rows.map((r) => r.label(r.count))).toEqual(['1 payment proof to verify', '3 payment proofs to verify']);
  });

  it('keeps the order the API sent and links each to its queue', () => {
    const rows = attentionRows([
      { key: 'memberApprovals', count: 2 },
      { key: 'overdueCharges', count: 5 },
    ]);
    expect(rows.map((r) => r.key)).toEqual(['memberApprovals', 'overdueCharges']);
    expect(rows.map((r) => r.href)).toEqual(['/(app)/(tabs)/manage/members/approvals', '/(app)/(tabs)/manage/finance/overdue']);
    expect(rows.map((r) => r.urgent ?? false)).toEqual([false, true]);
  });

  it('leaves out queues that have no screen in the app yet, and empty ones', () => {
    const rows = attentionRows([
      { key: 'loanApplications', count: 4 },
      { key: 'welfarePayouts', count: 1 },
      { key: 'cashLodgments', count: 0 },
      { key: 'supportTickets', count: 2 },
    ]);
    expect(rows.map((r) => r.key)).toEqual(['supportTickets']);
  });

  it('returns nothing before the list has loaded', () => {
    expect(attentionRows(undefined)).toEqual([]);
  });
});

describe('attentionCount', () => {
  it('reads one queue, and is 0 when it is absent', () => {
    const items = [{ key: 'paymentProofs' as const, count: 6 }];
    expect(attentionCount(items, 'paymentProofs')).toBe(6);
    expect(attentionCount(items, 'bankTransfers')).toBe(0);
    expect(attentionCount(undefined, 'bankTransfers')).toBe(0);
  });
});
