/**
 * F0.3 unit tests — lib/auth.ts's token-generation additions. No mocking
 * needed: these are pure functions (JWT signing, crypto). Confirms web's
 * default (no `isMobile`) token keeps its original 7-day lifetime —
 * the "web login unchanged" half of F0.3's DoD.
 */
import jwt from 'jsonwebtoken';
import {
  generateToken,
  mobileAccessTokenExpiresAt,
  generateRefreshToken,
  hashRefreshToken,
} from '../../src/lib/auth';

const basePayload = { id: 1, email: 'a@b.com', role: 'member' };

describe('generateToken', () => {
  it('defaults to a ~7-day expiry when no options are given (web, unchanged)', () => {
    const token = generateToken(basePayload);
    const decoded = jwt.decode(token) as { iat: number; exp: number };
    const lifetimeSeconds = decoded.exp - decoded.iat;
    expect(lifetimeSeconds).toBe(7 * 24 * 60 * 60);
  });

  it('uses a ~15-minute expiry when isMobile is true', () => {
    const token = generateToken(basePayload, { isMobile: true });
    const decoded = jwt.decode(token) as { iat: number; exp: number };
    const lifetimeSeconds = decoded.exp - decoded.iat;
    expect(lifetimeSeconds).toBe(15 * 60);
  });

  it('impersonation expiry still wins over isMobile if both were somehow set', () => {
    const token = generateToken(basePayload, { isImpersonation: true, isMobile: true });
    const decoded = jwt.decode(token) as { iat: number; exp: number };
    const lifetimeSeconds = decoded.exp - decoded.iat;
    expect(lifetimeSeconds).toBe(4 * 60 * 60); // default IMPERSONATION_EXPIRY
  });
});

describe('mobileAccessTokenExpiresAt', () => {
  it('returns a Date about 15 minutes in the future', () => {
    const before = Date.now();
    const expiresAt = mobileAccessTokenExpiresAt();
    const deltaMs = expiresAt.getTime() - before;
    expect(deltaMs).toBeGreaterThan(14 * 60 * 1000);
    expect(deltaMs).toBeLessThanOrEqual(15 * 60 * 1000 + 1000);
  });
});

describe('generateRefreshToken / hashRefreshToken', () => {
  it('generates a 64-character hex string (32 bytes) each time, never repeating', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(b).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });

  it('hashes deterministically and never stores/returns the plaintext', () => {
    const token = generateRefreshToken();
    const hash1 = hashRefreshToken(token);
    const hash2 = hashRefreshToken(token);
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(token);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/); // sha256 hex digest
  });
});
