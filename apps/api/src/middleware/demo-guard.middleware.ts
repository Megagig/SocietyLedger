import { NextFunction, Response } from 'express';
import { DEMO_MAX_UPLOAD_BYTES, isDemoAssociation, isDemoEmail } from '../lib/demo';
import type { TenantRequest } from './tenant.middleware';

/**
 * Limits on a demo tenant, applied to every request that resolves to one. Real tenants pass straight through.
 *  - nothing that reaches a payment gateway (checkout, subscription, SMS/AI credits)
 *  - no password or account recovery changes (--reset-demo restores the seeded credentials)
 *  - no outbound SMS sends and no invitations to outside people
 *  - a member's email can only be a demo-domain address
 *  - uploads capped at DEMO_MAX_UPLOAD_BYTES
 */
const GATEWAY = [
  /^\/api\/payments\/(paystack|nomba)\/initialize/,
  /^\/api\/subscriptions\/(initialize|change-plan|addons\/initialize)/,
  /^\/api\/sms\/credits\/purchase/,
  /^\/api\/ai\/credits\/purchase/,
];
const ACCOUNT = [/^\/api\/auth\/(change-password|forgot-password|reset-password|register)/];
const OUTBOUND = [/^\/api\/member-invites/, /^\/api\/sms\/(send|bulk|campaigns?)/];
const MEMBER_WRITE = /^\/api\/members(\/|$)/;

function deny(res: Response, code: string, message: string): void {
  res.status(403).json({ success: false, error: { code, message }, message });
}

export async function demoGuard(req: TenantRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!(await isDemoAssociation(req.tenantId))) return next();

    const path = req.path.startsWith('/api') ? req.path : `/api${req.path}`;
    const write = req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS';
    if (!write) return next();

    if (GATEWAY.some((r) => r.test(path))) return deny(res, 'DEMO_PAYMENTS_DISABLED', 'Demo accounts cannot make real payments. Record a payment manually instead.');
    if (ACCOUNT.some((r) => r.test(path))) return deny(res, 'DEMO_ACCOUNT_LOCKED', 'Demo accounts cannot change their password. It is restored by the next demo reset.');
    if (OUTBOUND.some((r) => r.test(path))) return deny(res, 'DEMO_OUTBOUND_DISABLED', 'Demo accounts cannot send SMS or invite outside people.');

    const body = (req.body ?? {}) as { email?: unknown };
    if (MEMBER_WRITE.test(path) && typeof body.email === 'string' && body.email.length > 0 && !isDemoEmail(body.email)) {
      return deny(res, 'DEMO_EMAIL_RESTRICTED', 'Demo members can only use demo-domain email addresses.');
    }

    const size = Number(req.headers['content-length'] ?? 0);
    if ((req.headers['content-type'] ?? '').includes('multipart/') && size > DEMO_MAX_UPLOAD_BYTES) {
      res.status(413).json({ success: false, error: { code: 'DEMO_UPLOAD_TOO_LARGE', message: 'Demo uploads are limited to 1 MB.' }, message: 'Demo uploads are limited to 1 MB.' });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
}
