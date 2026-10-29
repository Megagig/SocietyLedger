/**
 * What a guarantor with no account can reach: the link's two public routes. Works with no sign-in, never caches, answers a bad link in
 * plain words, and records nothing unless the person says they agree.
 */
import express from 'express';
import request from 'supertest';

const svc = { viewGuarantorLink: jest.fn(), acceptGuarantorLink: jest.fn() };
jest.mock('../../src/modules/ajo/ajo-guarantor-link.service', () => ({ viewGuarantorLink: (...a: unknown[]) => svc.viewGuarantorLink(...a), acceptGuarantorLink: (...a: unknown[]) => svc.acceptGuarantorLink(...a) }));
jest.mock('../../src/modules/ajo/ajo-members.controller', () => {
  const { RuleError: Real } = jest.requireActual('../../src/modules/finance/rule-error') as typeof import('../../src/modules/finance/rule-error');
  return { fail: (res: express.Response, error: unknown, fallback: string) => (error instanceof Real ? res.status(error.status).json({ success: false, code: error.code, message: error.message }) : res.status(500).json({ success: false, message: fallback })) };
});
jest.mock('../../src/middleware/rate-limit.middleware', () => ({ rateLimit: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next() }));

import { RuleError } from '../../src/modules/finance/rule-error';
import routes from '../../src/modules/ajo/ajo-public.routes';

const app = express();
app.use(express.json());
app.use('/api/public/ajo', routes);
const TOKEN = 'a'.repeat(43);

beforeEach(() => jest.clearAllMocks());

describe('the guarantor link, with no sign-in', () => {
  it('shows the wording and is never cached', async () => {
    svc.viewGuarantorLink.mockResolvedValue({ wording: 'I agree', guarantorName: 'Mama Chidi' });
    const res = await request(app).get(`/api/public/ajo/guarantor/${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.data.wording).toBe('I agree');
    expect(svc.viewGuarantorLink).toHaveBeenCalledWith(TOKEN);
  });

  it('answers a malformed, unknown, used or expired link in plain words with the right status', async () => {
    expect((await request(app).get('/api/public/ajo/guarantor/short')).body.code).toBe('LINK_INVALID');
    expect(svc.viewGuarantorLink).not.toHaveBeenCalled();
    svc.viewGuarantorLink.mockRejectedValueOnce(new RuleError('This link has expired.', 409, 'LINK_EXPIRED'));
    const expired = await request(app).get(`/api/public/ajo/guarantor/${TOKEN}`);
    expect(expired.status).toBe(409);
    expect(expired.body).toMatchObject({ code: 'LINK_EXPIRED', message: 'This link has expired.' });
  });

  it('records the agreement only when the person says they agree', async () => {
    svc.acceptGuarantorLink.mockResolvedValue({ agreementId: 4, memberName: 'Ada Obi', groupName: 'Circle' });
    expect((await request(app).post(`/api/public/ajo/guarantor/${TOKEN}/accept`).send({})).status).toBe(400);
    expect((await request(app).post(`/api/public/ajo/guarantor/${TOKEN}/accept`).send({ agreed: 'yes' })).body.code).toBe('AGREEMENT_REQUIRED');
    expect(svc.acceptGuarantorLink).not.toHaveBeenCalled();
    const ok = await request(app).post(`/api/public/ajo/guarantor/${TOKEN}/accept`).send({ agreed: true });
    expect(ok.status).toBe(200);
    expect(svc.acceptGuarantorLink).toHaveBeenCalledWith({ token: TOKEN, agreed: true });
  });
});
