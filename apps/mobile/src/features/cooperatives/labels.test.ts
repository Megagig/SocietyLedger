import { COOPERATIVE_SAVINGS_VIEW_ACCESS, can, canAny } from '@/lib/permissions';
import { DEPOSIT_STATUS_LABELS, DEPOSIT_STATUS_TONES, isCreditTransaction } from './labels';

describe('cooperatives labels', () => {
  it('uses the same deposit wording as the web', () => {
    expect(DEPOSIT_STATUS_LABELS).toEqual({ PENDING: 'Awaiting confirmation', APPROVED: 'Confirmed', REJECTED: 'Not approved' });
    expect(DEPOSIT_STATUS_TONES.PENDING).toBe('warning');
  });

  it('treats deposits, interest and transfers in as credits only', () => {
    expect(isCreditTransaction('DEPOSIT')).toBe(true);
    expect(isCreditTransaction('INTEREST')).toBe(true);
    expect(isCreditTransaction('TRANSFER_IN')).toBe(true);
    expect(isCreditTransaction('WITHDRAWAL')).toBe(false);
    expect(isCreditTransaction('FEE')).toBe(false);
  });
});

describe('cooperatives permissions', () => {
  it('lets a member with only cooperatives.view_own see savings', () => {
    expect(canAny(['cooperatives.view_own'], COOPERATIVE_SAVINGS_VIEW_ACCESS)).toBe(true);
    expect(canAny(['members.view_own'], COOPERATIVE_SAVINGS_VIEW_ACCESS)).toBe(false);
  });

  it('gates deposits on the own-deposit key, not ledger.create', () => {
    expect(can(['cooperatives.savings_deposit_own'], 'COOPERATIVE_SAVINGS_DEPOSIT_OWN')).toBe(true);
    expect(can(['ledger.create'], 'COOPERATIVE_SAVINGS_DEPOSIT_OWN')).toBe(false);
  });
});
