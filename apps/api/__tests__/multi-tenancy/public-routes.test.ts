/**
 * The routes a person uses before any association exists must pass the tenant middleware with no tenant at all. Sign-up for an association
 * already did; sign-up for a standalone thrift group did not, and answered "Association not found" before its own code ran.
 */
const findAssociation = jest.fn();
jest.mock('../../src/lib/tenant', () => ({
  extractSubdomain: jest.fn(() => null),
  extractSubdomainFromOrigin: jest.fn(() => null),
  findAssociationByIdentifier: (...args: unknown[]) => findAssociation(...args),
}));

import { tenantMiddleware } from '../../src/middleware/tenant.middleware';

type Reply = { statusCode: number; body: unknown };

async function visit(path: string) {
  const reply: Reply = { statusCode: 200, body: undefined };
  const res = {
    status(code: number) {
      reply.statusCode = code;
      return this;
    },
    json(body: unknown) {
      reply.body = body;
      return this;
    },
  };
  const next = jest.fn();
  await tenantMiddleware({ path, headers: {}, get: () => undefined, header: () => undefined, hostname: 'localhost' } as never, res as never, next);
  return { next, reply };
}

describe('public routes that work before an association exists', () => {
  beforeEach(() => findAssociation.mockReset());

  it.each(['/api/associations/signup', '/api/associations/thrift-signup', '/api/associations/check-subdomain'])('lets %s through with no tenant', async (path) => {
    const { next, reply } = await visit(path);
    expect(next).toHaveBeenCalledTimes(1);
    expect(reply.body).toBeUndefined();
    expect(findAssociation).not.toHaveBeenCalled();
  });

  it('still refuses an ordinary route that has no tenant', async () => {
    const { next, reply } = await visit('/api/ajo/status');
    expect(next).not.toHaveBeenCalled();
    expect(reply.statusCode).toBe(400);
    expect(reply.body).toMatchObject({ code: 'ASSOCIATION_NOT_FOUND' });
  });
});
