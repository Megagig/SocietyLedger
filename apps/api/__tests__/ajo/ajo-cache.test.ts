/**
 * The short-lived cache behind the circle board. What matters: nobody is ever given another person's or another association's copy, a
 * write makes the next read recompute (including the writer's own next read), a slow read that began before a write cannot be served after it,
 * an error is never kept, and with no Redis in production nothing is cached.
 */
jest.mock('../../src/lib/redis', () => ({ getRedisClient: jest.fn(async () => null) }));

import express from 'express';
import request from 'supertest';
import { ajoCached, bumpAjoCache, bumpAjoCacheForAll, resetAjoCacheForTests } from '../../src/modules/ajo/ajo-cache';
import { bumpAjoCacheOnWrite } from '../../src/modules/ajo/ajo-cache.middleware';

const member = { userId: 10, isOfficer: false };
const officer = { userId: 11, isOfficer: true };
const A = 1;
const B = 2;

function counter() {
  let n = 0;
  return { calls: () => n, compute: (label = 'v') => async () => ({ label, n: ++n }) };
}

beforeEach(() => resetAjoCacheForTests());

describe('who an entry belongs to', () => {
  it('serves the same viewer, circle and question from the cache', async () => {
    const c = counter();
    const first = await ajoCached(A, member, ['board', 4, 'matrix'], c.compute());
    const second = await ajoCached(A, member, ['board', 4, 'matrix'], c.compute());
    expect(second).toEqual(first);
    expect(c.calls()).toBe(1);
  });

  it('never gives one person another person’s copy', async () => {
    const c = counter();
    await ajoCached(A, member, ['board', 4, 'matrix'], c.compute());
    await ajoCached(A, { userId: 99, isOfficer: false }, ['board', 4, 'matrix'], c.compute());
    expect(c.calls()).toBe(2);
  });

  it('never gives a member the officer’s copy, or the reverse', async () => {
    const c = counter();
    await ajoCached(A, officer, ['board', 4, 'members'], c.compute('officer'));
    const asMember = await ajoCached(A, { userId: officer.userId, isOfficer: false }, ['board', 4, 'members'], c.compute('member'));
    expect(asMember.label).toBe('member');
  });

  it('never shares anything between associations', async () => {
    const c = counter();
    await ajoCached(A, member, ['board', 4, 'matrix'], c.compute('a'));
    const other = await ajoCached(B, member, ['board', 4, 'matrix'], c.compute('b'));
    expect(other.label).toBe('b');
    expect(c.calls()).toBe(2);
  });

  it('keeps different circles and different questions apart', async () => {
    const c = counter();
    await ajoCached(A, member, ['board', 4, 'matrix'], c.compute());
    await ajoCached(A, member, ['board', 5, 'matrix'], c.compute());
    await ajoCached(A, member, ['board', 4, 'round', 2, 'PAID'], c.compute());
    await ajoCached(A, member, ['board', 4, 'round', 2, 'NOT_PAID'], c.compute());
    expect(c.calls()).toBe(4);
  });
});

describe('a change makes the next read recompute', () => {
  it('after a write in the same association, and only there', async () => {
    const c = counter();
    await ajoCached(A, member, ['board', 4, 'matrix'], c.compute('a'));
    await ajoCached(B, member, ['board', 4, 'matrix'], c.compute('b'));
    await bumpAjoCache(A);
    expect((await ajoCached(A, member, ['board', 4, 'matrix'], c.compute('a2'))).label).toBe('a2');
    expect((await ajoCached(B, member, ['board', 4, 'matrix'], c.compute('b2'))).label).toBe('b'); // the other association kept its copy
  });

  it('after a scheduled job, for every association', async () => {
    const c = counter();
    await ajoCached(A, member, ['x'], c.compute('a'));
    await ajoCached(B, member, ['x'], c.compute('b'));
    await bumpAjoCacheForAll();
    expect((await ajoCached(A, member, ['x'], c.compute('a2'))).label).toBe('a2');
    expect((await ajoCached(B, member, ['x'], c.compute('b2'))).label).toBe('b2');
  });

  it('even for a slow read that began before the write: its late answer is never served afterwards', async () => {
    let release!: (v: { label: string }) => void;
    const slow = ajoCached(A, member, ['board', 4, 'matrix'], () => new Promise<{ label: string }>((resolve) => { release = resolve; }));
    await new Promise((r) => setTimeout(r, 0)); // the slow read has taken its version and is working
    await bumpAjoCache(A); // a payment is confirmed meanwhile
    release({ label: 'computed-before-the-payment' });
    await slow;
    const after = await ajoCached(A, member, ['board', 4, 'matrix'], async () => ({ label: 'computed-after-the-payment' }));
    expect(after.label).toBe('computed-after-the-payment');
  });
});

describe('what is never kept', () => {
  it('an error', async () => {
    let calls = 0;
    const failing = async () => {
      calls++;
      throw new Error('BOARD_NOT_AVAILABLE');
    };
    await expect(ajoCached(A, member, ['board', 4, 'matrix'], failing)).rejects.toThrow('BOARD_NOT_AVAILABLE');
    await expect(ajoCached(A, member, ['board', 4, 'matrix'], failing)).rejects.toThrow('BOARD_NOT_AVAILABLE');
    expect(calls).toBe(2);
  });

  it('anything, in production with no Redis', async () => {
    const before = process.env.NODE_ENV;
    (process.env as Record<string, string>).NODE_ENV = 'production';
    try {
      const c = counter();
      await ajoCached(A, member, ['board', 4, 'matrix'], c.compute());
      await ajoCached(A, member, ['board', 4, 'matrix'], c.compute());
      expect(c.calls()).toBe(2);
    } finally {
      (process.env as Record<string, string>).NODE_ENV = before as string;
    }
  });
});

describe('the write middleware', () => {
  function app() {
    const a = express();
    a.use(express.json());
    // sign-in is not under test: the association comes from the request
    a.use((req, _res, next) => {
      (req as unknown as { user: { associationId: number } }).user = { associationId: A };
      next();
    });
    a.use(bumpAjoCacheOnWrite);
    let balance = 100;
    a.get('/board', async (_req, res) => {
      const data = await ajoCached(A, member, ['board', 4, 'matrix'], async () => ({ balance }));
      res.json(data);
    });
    a.post('/payments', (_req, res) => {
      balance += 50;
      res.status(201).json({ ok: true });
    });
    a.post('/payments/fail', (_req, res) => {
      balance += 1; // a partly applied write
      res.status(500).json({ ok: false });
    });
    return a;
  }

  it('shows a saved change on the very next read, never the old copy', async () => {
    const a = app();
    expect((await request(a).get('/board')).body.balance).toBe(100);
    expect((await request(a).get('/board')).body.balance).toBe(100); // served from the cache
    await request(a).post('/payments').send({});
    expect((await request(a).get('/board')).body.balance).toBe(150);
  });

  it('also after a write that failed, because it may have changed something', async () => {
    const a = app();
    await request(a).get('/board');
    await request(a).post('/payments/fail').send({});
    expect((await request(a).get('/board')).body.balance).toBe(101);
  });

  it('does nothing for a read', async () => {
    const a = app();
    await request(a).get('/board');
    await request(a).get('/board');
    // a read must not bump: the second read above was a hit, which a bump would have turned into a miss
    let computed = 0;
    await ajoCached(A, member, ['board', 4, 'matrix'], async () => { computed++; return { balance: -1 }; });
    expect(computed).toBe(0);
  });
});
