/**
 * Ajo secrets (T2.2): payout account numbers are encrypted at rest, bound to their owner, and shown only in masked form.
 */
import {
  decryptAccountNumber,
  encryptAccountNumber,
  generatePhoneCode,
  hashPhoneCode,
  lastFour,
  maskAccount,
  normaliseAccountNumber,
} from '../../src/modules/ajo/ajo-secrets';

const KEY = 'test-only-encryption-key-0123456789abcdef';
const ACCOUNT = '0123456789';

beforeEach(() => {
  process.env.TOTP_ENCRYPTION_KEY = KEY;
});

describe('payout account encryption', () => {
  it('round-trips an account number for its owner', () => {
    expect(decryptAccountNumber(7, encryptAccountNumber(7, ACCOUNT))).toBe(ACCOUNT);
  });

  it('never stores the number in readable form', () => {
    const stored = encryptAccountNumber(7, ACCOUNT);
    expect(stored).not.toContain(ACCOUNT);
    expect(stored).not.toContain(lastFour(ACCOUNT) + lastFour(ACCOUNT));
  });

  it('produces a different ciphertext each time', () => {
    expect(encryptAccountNumber(7, ACCOUNT)).not.toBe(encryptAccountNumber(7, ACCOUNT));
  });

  it('will not decrypt for a different member: a copied ciphertext is useless', () => {
    expect(() => decryptAccountNumber(8, encryptAccountNumber(7, ACCOUNT))).toThrow();
  });

  it('detects tampering', () => {
    const [iv, tag, data] = encryptAccountNumber(7, ACCOUNT).split(':');
    const flipped = `${data?.slice(0, -1)}${data?.endsWith('0') ? '1' : '0'}`;
    expect(() => decryptAccountNumber(7, `${iv}:${tag}:${flipped}`)).toThrow();
  });

  it('will not decrypt under a different platform key', () => {
    const stored = encryptAccountNumber(7, ACCOUNT);
    process.env.TOTP_ENCRYPTION_KEY = 'another-key-another-key-another-key-xx';
    expect(() => decryptAccountNumber(7, stored)).toThrow();
  });

  it('refuses to work without the platform key', () => {
    delete process.env.TOTP_ENCRYPTION_KEY;
    expect(() => encryptAccountNumber(7, ACCOUNT)).toThrow(/TOTP_ENCRYPTION_KEY/);
  });
});

describe('account numbers', () => {
  it('accepts ten digits, ignoring spaces and dashes people type', () => {
    expect(normaliseAccountNumber('0123456789')).toBe('0123456789');
    expect(normaliseAccountNumber('0123 456 789')).toBe('0123456789');
    expect(normaliseAccountNumber('0123-456-789')).toBe('0123456789');
  });

  it('refuses anything else', () => {
    for (const bad of ['012345678', '01234567890', '01234abcde', '', '   ', null, undefined, 123456789]) {
      expect(normaliseAccountNumber(bad)).toBeNull();
    }
  });

  it('shows only the last four digits when masked', () => {
    expect(maskAccount(lastFour(ACCOUNT))).toBe('••••6789');
    expect(maskAccount(lastFour(ACCOUNT))).not.toContain('0123');
  });

  it('masks safely when there is nothing to show', () => {
    expect(maskAccount(null)).toBe('••••');
    expect(maskAccount('12')).toBe('••••');
  });
});

describe('phone codes', () => {
  it('are six digits with leading zeros kept', () => {
    for (let i = 0; i < 200; i++) expect(generatePhoneCode()).toMatch(/^[0-9]{6}$/);
  });

  it('hash to something that is not the code, and differ by membership', () => {
    const a = hashPhoneCode(1, '123456');
    expect(a).not.toContain('123456');
    expect(a).toBe(hashPhoneCode(1, '123456'));
    expect(a).not.toBe(hashPhoneCode(2, '123456'));
    expect(a).not.toBe(hashPhoneCode(1, '123457'));
  });
});
