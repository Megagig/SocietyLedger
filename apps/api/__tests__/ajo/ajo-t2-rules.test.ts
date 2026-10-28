/**
 * The pure rules behind Ajo T2, with no database: what an audit row may carry, when "today" rolls over for the daily code limit,
 * and the cool-off arithmetic.
 */
jest.mock('../../src/lib/prisma', () => ({ __esModule: true, default: {} }));
jest.mock('../../src/modules/admin/platform-settings.service', () => ({ PlatformSettingsService: { getSettings: jest.fn() } }));
jest.mock('../../src/services/billing/entitlements.service', () => ({ computeEntitlements: jest.fn() }));
jest.mock('../../src/services/notification-preferences.service', () => ({ dispatchNotification: jest.fn() }));

import { redactSecrets } from '../../src/modules/ajo/ajo-support';
import { coolOffEnd, isInCoolOff } from '../../src/modules/ajo/ajo-payout-account.service';
import { lagosDay, MAX_CODES_PER_DAY, MAX_WRONG_TRIES } from '../../src/modules/ajo/ajo-phone-code.service';
import { unmetRequirements } from '../../src/modules/ajo/ajo-membership.service';

describe('redactSecrets', () => {
  it('drops secret-looking keys at any depth', () => {
    const out = redactSecrets({ memberId: 3, accountNumber: '0123456789', nested: { account_number: '0123456789', codeHash: 'abc', code: '123456', keep: 'yes' }, list: [{ otp: '1', ok: true }] });
    expect(out).toEqual({ memberId: 3, nested: { keep: 'yes' }, list: [{ ok: true }] });
  });

  it('masks a ten-digit run that turns up inside ordinary text', () => {
    expect(redactSecrets({ note: 'paid to 0123456789 today' })).toEqual({ note: 'paid to ••••6789 today' });
  });

  it('leaves dates, numbers, booleans and shorter digit runs alone', () => {
    const when = new Date('2027-01-01T00:00:00Z');
    expect(redactSecrets({ when, n: 5_000_000, ok: true, ref: '234803123' })).toEqual({ when, n: 5_000_000, ok: true, ref: '234803123' });
  });

  it('errs on the side of masking: any ten digits in a row, even if it is not an account number', () => {
    expect(redactSecrets({ ref: '2348031234' })).toEqual({ ref: '••••1234' });
  });

  it('does not change what it was given', () => {
    const input = { accountNumber: '0123456789', keep: 1 };
    redactSecrets(input);
    expect(input).toEqual({ accountNumber: '0123456789', keep: 1 });
  });
});

describe('the cool-off', () => {
  const now = new Date('2027-02-01T10:00:00Z');

  it('ends the configured number of hours from now, or not at all when switched off', () => {
    expect(coolOffEnd(now, 72)?.toISOString()).toBe('2027-02-04T10:00:00.000Z');
    expect(coolOffEnd(now, 1)?.toISOString()).toBe('2027-02-01T11:00:00.000Z');
    expect(coolOffEnd(now, 0)).toBeNull();
  });

  it('is over exactly when the end time arrives', () => {
    const end = new Date('2027-02-04T10:00:00Z');
    expect(isInCoolOff(end, new Date('2027-02-04T09:59:59Z'))).toBe(true);
    expect(isInCoolOff(end, end)).toBe(false);
    expect(isInCoolOff(null, now)).toBe(false);
    expect(isInCoolOff(undefined, now)).toBe(false);
  });
});

describe('the phone code limits', () => {
  it('rolls the day over at midnight in Nigeria (UTC+1), not at midnight UTC', () => {
    // 23:30 UTC is 00:30 the next day in Lagos.
    expect(lagosDay(new Date('2027-02-01T23:30:00Z')).toISOString()).toBe('2027-02-02T00:00:00.000Z');
    expect(lagosDay(new Date('2027-02-01T22:59:59Z')).toISOString()).toBe('2027-02-01T00:00:00.000Z');
    expect(lagosDay(new Date('2027-02-01T23:00:00Z')).toISOString()).toBe('2027-02-02T00:00:00.000Z');
  });

  it('allows five wrong tries and five codes a day, as agreed', () => {
    expect(MAX_WRONG_TRIES).toBe(5);
    expect(MAX_CODES_PER_DAY).toBe(5);
  });
});

describe('what a membership is still missing', () => {
  const approved = new Date();

  it('needs only approval when the group does not ask for a phone code', () => {
    expect(unmetRequirements({ approvedAt: null, requirePhoneConfirm: false, phoneConfirmedNumber: null, memberPhone: null })).toEqual(['APPROVAL']);
    expect(unmetRequirements({ approvedAt: approved, requirePhoneConfirm: false, phoneConfirmedNumber: null, memberPhone: null })).toEqual([]);
  });

  it('cannot be met when the member has no usable phone number', () => {
    expect(unmetRequirements({ approvedAt: approved, requirePhoneConfirm: true, phoneConfirmedNumber: null, memberPhone: null })).toEqual(['PHONE_CONFIRMATION']);
    expect(unmetRequirements({ approvedAt: approved, requirePhoneConfirm: true, phoneConfirmedNumber: '2348031234567', memberPhone: 'not a number' })).toEqual(['PHONE_CONFIRMATION']);
  });

  it('accepts the same number written differently', () => {
    expect(unmetRequirements({ approvedAt: approved, requirePhoneConfirm: true, phoneConfirmedNumber: '2348031234567', memberPhone: '+234 803 123 4567' })).toEqual([]);
  });
});
