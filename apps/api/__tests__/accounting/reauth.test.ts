/** Confirming a password before something that cannot be undone: only wrong ones count, and five lock the person out. */
const prismaMock: any = { user: { findUnique: jest.fn() } };
jest.mock('../../src/lib/prisma', () => ({ __esModule: true, default: prismaMock, prisma: prismaMock }));
jest.mock('../../src/lib/redis', () => ({ getRedisClient: jest.fn().mockResolvedValue(null), isRedisAvailable: () => false }));
const mockVerify = jest.fn();
jest.mock('../../src/lib/auth', () => ({ verifyPassword: (...a: unknown[]) => mockVerify(...a) }));

import { REAUTH_MAX_WRONG, confirmPassword, reauthFailure } from '../../src/lib/reauth';

let nextUser = 1000;
beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.user.findUnique.mockResolvedValue({ passwordHash: 'hash' });
  mockVerify.mockImplementation(async (password: string) => password === 'right');
});

describe('confirmPassword', () => {
  it('accepts the right password, however many times', async () => {
    const user = nextUser++;
    for (let i = 0; i < 12; i += 1) expect(await confirmPassword(user, 'right')).toEqual({ ok: true });
  });

  it('says a wrong password is wrong', async () => {
    expect(await confirmPassword(nextUser++, 'nope')).toEqual({ ok: false, reason: 'wrong' });
  });

  it('refuses a person with no password on file', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ passwordHash: null });
    expect(await confirmPassword(nextUser++, 'right')).toEqual({ ok: false, reason: 'wrong' });
  });

  it('locks the person out after five wrong passwords, even for the right one', async () => {
    const user = nextUser++;
    for (let i = 0; i < REAUTH_MAX_WRONG; i += 1) expect(await confirmPassword(user, 'nope')).toEqual({ ok: false, reason: 'wrong' });
    const locked = await confirmPassword(user, 'right');
    expect(locked).toMatchObject({ ok: false, reason: 'locked' });
    expect(mockVerify).toHaveBeenCalledTimes(REAUTH_MAX_WRONG); // the locked attempt never reached the password check
  });

  it('keeps one person\'s mistakes from locking another', async () => {
    const a = nextUser++;
    const b = nextUser++;
    for (let i = 0; i < REAUTH_MAX_WRONG; i += 1) await confirmPassword(a, 'nope');
    expect(await confirmPassword(b, 'right')).toEqual({ ok: true });
  });

  it('does not count right passwords towards the lock', async () => {
    const user = nextUser++;
    for (let i = 0; i < 4; i += 1) await confirmPassword(user, 'nope');
    for (let i = 0; i < 10; i += 1) await confirmPassword(user, 'right');
    expect(await confirmPassword(user, 'right')).toEqual({ ok: true });
  });
});

describe('reauthFailure', () => {
  it('is a 403 for a wrong password and a 429 with the wait for a lock', () => {
    expect(reauthFailure({ ok: false, reason: 'wrong' })).toMatchObject({ status: 403, body: { code: 'REAUTH_FAILED' } });
    const locked = reauthFailure({ ok: false, reason: 'locked', retryAfterSeconds: 61 });
    expect(locked.status).toBe(429);
    expect(locked.body.message).toContain('2 minutes');
    expect(reauthFailure({ ok: false, reason: 'locked', retryAfterSeconds: 20 }).body.message).toContain('1 minute');
  });
});
