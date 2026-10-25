/**
 * F0.4 — the bridge Paystack's checkout redirects back to after a mobile
 * payment, since Paystack itself can't redirect directly into a custom
 * `societyledger://` URL scheme. Public, mounted before tenantMiddleware
 * (architecture.md §9.3) — no tenant/auth context is needed or used here.
 *
 * The target scheme is hard-coded, never built from any request input
 * (`redirect` or otherwise), so this can never become an open redirect.
 */
import { Router, Request, Response } from 'express';

const router: Router = Router();

const MOBILE_SCHEME = 'societyledger://payments/return';

router.get('/', (req: Request, res: Response) => {
  const reference = (req.query.reference ?? req.query.trxref) as string | undefined;
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;

  const params = new URLSearchParams();
  if (reference) params.set('reference', reference);
  if (status) params.set('status', status);

  const query = params.toString();
  const deepLink = query ? `${MOBILE_SCHEME}?${query}` : MOBILE_SCHEME;
  const safeDeepLink = deepLink.replace(/&/g, '&amp;');

  res.status(302).set('Location', deepLink);
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>Payment complete</title></head>
  <body style="font-family: sans-serif; text-align: center; padding: 48px 16px;">
    <p>Redirecting you back to the SocietyLedger app&hellip;</p>
    <p><a href="${safeDeepLink}">Tap here if nothing happens</a></p>
  </body>
</html>`);
});

export default router;
