import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { authMiddleware, AuthRequest } from '../../middleware/auth.middleware';

const router: Router = Router();

router.use(authMiddleware);

const registerSchema = z.object({
  expoPushToken: z.string().min(1),
  platform: z.enum(['ios', 'android']),
  deviceName: z.string().optional(),
  appVersion: z.string().optional(),
});

/**
 * POST /api/devices/register
 * Upserts by `expoPushToken` (unique) — if the same physical device token
 * was previously registered to a different user (e.g. a shared/reused
 * device, or the same phone signing into a different account), it is
 * reassigned to the current caller rather than rejected, per architecture.md
 * §9.2. Re-registering an existing token also clears any prior `disabledAt`
 * flag the receipts job may have set — the token being actively presented
 * again means it's alive.
 */
router.post('/register', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { expoPushToken, platform, deviceName, appVersion } = registerSchema.parse(req.body);
    const associationId = req.user?.associationId ?? null;

    const device = await prisma.deviceToken.upsert({
      where: { expoPushToken },
      create: { userId, associationId, expoPushToken, platform, deviceName, appVersion },
      update: { userId, associationId, platform, deviceName, appVersion, lastSeenAt: new Date(), disabledAt: null },
    });

    return res.json({ success: true, data: { id: device.id } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
    }
    console.error('[devices] register error:', error);
    return res.status(500).json({ success: false, message: 'Failed to register device' });
  }
});

const unregisterSchema = z.object({
  expoPushToken: z.string().min(1),
});

/**
 * POST /api/devices/unregister
 * Scoped to the caller's own tokens — idempotent (no error if the token
 * doesn't exist or belongs to someone else, matching "best effort" logout).
 */
router.post('/unregister', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { expoPushToken } = unregisterSchema.parse(req.body);
    await prisma.deviceToken.deleteMany({ where: { expoPushToken, userId } });

    return res.json({ success: true, message: 'Device unregistered' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
    }
    console.error('[devices] unregister error:', error);
    return res.status(500).json({ success: false, message: 'Failed to unregister device' });
  }
});

export default router;
