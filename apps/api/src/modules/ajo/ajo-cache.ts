/**
 * A short-lived cache for the Ajo screens that many people open and that are costly to work out (the circle board).
 *
 * How it stays correct:
 *  - Every entry belongs to one association AND one viewer (their user and whether they are an officer), because the board shows different
 *    things to different people. An entry is never shared across associations or people.
 *  - Each association has a version number. Every entry is stored under the version that was current when its read STARTED. Any Ajo write bumps
 *    the version before the writer gets its answer, so the next read cannot find an older copy. A slow read that began before the write can
 *    only store under the old version, which nothing reads any more.
 *  - Entries live 30 seconds at most, so a change made outside the Ajo routes (a renamed member, a changed role) is also short-lived.
 *  - Nothing about one person's own money is cached here (their savings, payments, contributions): only the board.
 *
 * Redis in production. Outside production, when Redis is not running, a small in-process copy is used so the same code runs on a laptop.
 * In production with Redis down nothing is cached: slower, never wrong.
 */
import { getRedisClient } from '../../lib/redis';

export const AJO_CACHE_TTL_SECONDS = 30;
const VERSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const MEMORY_MAX_ENTRIES = 500;

const memory = new Map<string, { expiresAt: number; value: string }>();
const memoryVersions = new Map<number, number>();
let memoryEpoch = 0;

const versionKey = (associationId: number) => `ajo:ver:${associationId}`;
const EPOCH_KEY = `ajo:ver:all`;
const useMemory = () => process.env.NODE_ENV !== 'production';

async function redis() {
  try {
    return await getRedisClient();
  } catch {
    return null;
  }
}

/** The association's current version (its own count plus the whole-system epoch), or null when no cache can be used. */
async function currentVersion(associationId: number): Promise<string | null> {
  const client = await redis();
  if (client) {
    try {
      const [own, epoch] = await Promise.all([client.get(versionKey(associationId)), client.get(EPOCH_KEY)]);
      return `${epoch ?? 0}.${own ?? 0}`;
    } catch {
      return null;
    }
  }
  return useMemory() ? `${memoryEpoch}.${memoryVersions.get(associationId) ?? 0}` : null;
}

/** Something in this association's Ajo data changed: every cached answer for it is now out of date. */
export async function bumpAjoCache(associationId: number): Promise<void> {
  const client = await redis();
  if (client) {
    try {
      await client.incr(versionKey(associationId));
      await client.expire(versionKey(associationId), VERSION_TTL_SECONDS);
    } catch (error) {
      console.error('[ajo-cache] could not bump the version:', (error as Error).message);
    }
    return;
  }
  if (useMemory()) memoryVersions.set(associationId, (memoryVersions.get(associationId) ?? 0) + 1);
}

/** A scheduled job changed data for any number of associations: every cached answer is out of date. */
export async function bumpAjoCacheForAll(): Promise<void> {
  const client = await redis();
  if (client) {
    try {
      await client.incr(EPOCH_KEY);
      await client.expire(EPOCH_KEY, VERSION_TTL_SECONDS);
    } catch (error) {
      console.error('[ajo-cache] could not bump the epoch:', (error as Error).message);
    }
    return;
  }
  if (useMemory()) memoryEpoch += 1;
}

export interface CacheViewer {
  userId: number;
  isOfficer: boolean;
}

function entryKey(associationId: number, version: string, viewer: CacheViewer, scope: ReadonlyArray<string | number>): string {
  return `ajo:c:${associationId}:v${version}:u${viewer.userId}:${viewer.isOfficer ? 'o' : 'm'}:${scope.join(':')}`;
}

async function read(key: string): Promise<string | null> {
  const client = await redis();
  if (client) {
    try {
      return await client.get(key);
    } catch {
      return null;
    }
  }
  if (!useMemory()) return null;
  const hit = memory.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    memory.delete(key);
    return null;
  }
  return hit.value;
}

async function write(key: string, value: string): Promise<void> {
  const client = await redis();
  if (client) {
    try {
      await client.setEx(key, AJO_CACHE_TTL_SECONDS, value);
    } catch {
      /* a failed write only means the next read works it out again */
    }
    return;
  }
  if (!useMemory()) return;
  if (memory.size >= MEMORY_MAX_ENTRIES) memory.delete(memory.keys().next().value as string);
  memory.set(key, { expiresAt: Date.now() + AJO_CACHE_TTL_SECONDS * 1000, value });
}

/**
 * The answer for this association, viewer and scope: from the cache if it is there, otherwise worked out and kept. An error is never kept.
 * `scope` names what was asked for (for example ['board', groupId, 'matrix']) and must include every input that changes the answer.
 */
export async function ajoCached<T>(associationId: number, viewer: CacheViewer, scope: ReadonlyArray<string | number>, compute: () => Promise<T>): Promise<T> {
  const version = await currentVersion(associationId);
  if (version === null) return compute();
  const key = entryKey(associationId, version, viewer, scope);
  const hit = await read(key);
  if (hit !== null) {
    try {
      return JSON.parse(hit) as T;
    } catch {
      /* a damaged entry is treated as a miss */
    }
  }
  const value = await compute();
  await write(key, JSON.stringify(value));
  return value;
}

/** Test helper. */
export function resetAjoCacheForTests(): void {
  memory.clear();
  memoryVersions.clear();
  memoryEpoch = 0;
}
