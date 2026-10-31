/**
 * What a person with no account can do in Ajo, mounted at /api/public/ajo ahead of the tenant check: a guarantor opens the link an officer
 * sent them, reads the wording and accepts. The link itself is the proof, so these routes are rate limited and tell a wrong guess nothing.
 */
import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { rateLimit } from '../../middleware/rate-limit.middleware';
import { fail } from './ajo-members.controller';
import { acceptGuarantorLink, viewGuarantorLink } from './ajo-guarantor-link.service';
import { verifyCircleStatement } from './ajo-circle-statement';

const router: Router = Router();
router.use(rateLimit({ windowMs: 60_000, max: 30, message: 'Too many tries. Please wait a minute and try again.' }));

const token = z.string().min(20).max(100);

router.get('/guarantor/:token', async (req: Request, res: Response) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, data: await viewGuarantorLink(token.parse(req.params.token)) });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(404).json({ success: false, code: 'LINK_INVALID', message: 'This link is not valid. Check you opened the whole link, or ask the group officer for a new one.' });
    return fail(res, error, 'Could not open this link.');
  }
});

router.post('/guarantor/:token/accept', async (req: Request, res: Response) => {
  try {
    const { agreed } = z.object({ agreed: z.boolean() }).parse(req.body ?? {});
    const done = await acceptGuarantorLink({ token: token.parse(req.params.token), agreed });
    return res.json({ success: true, message: 'Thank you. Your agreement is recorded.', data: done });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, code: 'AGREEMENT_REQUIRED', message: 'Tick the box to say you agree.' });
    return fail(res, error, 'Could not record your agreement.');
  }
});

/** Check a circle statement against the live record. Totals only; a wrong code gets the same answer as a malformed one. */
router.get('/statement/:code', async (req: Request, res: Response) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, data: await verifyCircleStatement(z.string().min(5).max(20).parse(req.params.code)) });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(404).json({ success: false, code: 'CODE_NOT_FOUND', message: 'That code was not found. Check it matches the one printed on the statement.' });
    return fail(res, error, 'Could not check that code.');
  }
});

export default router;
