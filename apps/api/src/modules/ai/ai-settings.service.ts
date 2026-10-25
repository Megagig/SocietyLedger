/**
 * The AI settings the platform owner changes in the admin console: the model, the credit price, the minimum purchase, each plan's daily
 * allowance and what each kind of request costs. Stored as one JSON value under `platform.ai` (the same place as the other platform
 * settings), so changing them never needs a code change. Reads are cached for a few seconds so a busy assistant does not ask the
 * database on every request.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { aiSettingsSchema, AiCreditsError, assertConsistent, mergeAiSettings, type AiSettings } from './ai-credits-rules';

const KEY = 'platform.ai';
const CACHE_MS = 15_000;
let cached: { at: number; value: AiSettings } | null = null;

async function readStored(): Promise<unknown> {
  const rows = await prisma.$queryRaw<Array<{ value: string | null }>>`SELECT value FROM settings WHERE association_id IS NULL AND key = ${KEY} LIMIT 1`;
  const raw = rows[0]?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export const aiSettingsService = {
  /** The settings in force: what the owner saved over the defaults. */
  async get(): Promise<AiSettings> {
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
    const value = mergeAiSettings(await readStored());
    cached = { at: Date.now(), value };
    return value;
  },

  /** Saves a change to some of the settings. Only the fields sent are changed; the whole must still make sense. */
  async update(change: unknown, userId: number): Promise<AiSettings> {
    const parsed = aiSettingsSchema.safeParse(change);
    if (!parsed.success) {
      throw new AiCreditsError(parsed.error.issues[0]?.message ?? 'Those settings are not valid.', 400, 'INVALID_AI_SETTINGS');
    }
    const before = mergeAiSettings(await readStored());
    const next = mergeAiSettings({
      ...before,
      ...parsed.data,
      allowances: { ...before.allowances, ...parsed.data.allowances },
      weights: { ...before.weights, ...parsed.data.weights },
    });
    assertConsistent(next);

    const text = JSON.stringify(next);
    const existing = await prisma.$queryRaw<Array<{ id: number }>>`SELECT id FROM settings WHERE association_id IS NULL AND key = ${KEY} LIMIT 1`;
    if (existing.length > 0) {
      await prisma.settings.update({ where: { id: existing[0].id }, data: { value: text, updatedBy: userId } });
    } else {
      await prisma.$executeRaw`
        INSERT INTO settings (key, value, description, updated_by, created_at, updated_at)
        VALUES (${KEY}, ${text}, ${'Platform setting: AI assistant'}, ${userId}, NOW(), NOW())
      `;
    }
    await prisma.auditLog.create({
      data: { userId, action: 'PLATFORM_AI_SETTINGS_UPDATED', tableName: 'settings', oldValues: before as unknown as Prisma.InputJsonValue, newValues: next as unknown as Prisma.InputJsonValue },
    });
    cached = null;
    return next;
  },

  /** Forgets what was read, so the next request reads again (after a save, and in tests). */
  clearCache(): void {
    cached = null;
  },
};
