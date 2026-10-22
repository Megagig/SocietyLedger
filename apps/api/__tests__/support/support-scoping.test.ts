/**
 * Support tickets belong to the member who opened them. A member must never see, close, reopen or open files from
 * someone else's ticket — not by passing another `userId` to the list, and not by guessing ticket or attachment ids.
 * Staff (support.view_all / support.manage) keep the full view of their own association. Prisma and storage are mocked.
 */
const mockPrisma = {
  supportTicket: { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  ticketAttachment: { findUnique: jest.fn(), create: jest.fn() },
  auditLog: { create: jest.fn() },
};
jest.mock('../../src/lib/prisma', () => ({ prisma: mockPrisma }));
jest.mock('../../src/lib/storage', () => ({
  uploadFile: jest.fn(),
  deleteFile: jest.fn(),
  getPresignedUrl: jest.fn().mockResolvedValue('https://storage.example/signed'),
}));

import type { Request, Response } from 'express';
import { supportService } from '../../src/modules/support/support.service';
import { supportController } from '../../src/modules/support/support.controller';

function makeRes() {
  const res = { status: jest.fn(), json: jest.fn() } as unknown as Response & { status: jest.Mock; json: jest.Mock };
  res.status.mockReturnValue(res);
  return res;
}

function makeReq(opts: { permissions: string[]; params?: Record<string, string>; userId?: number }): Request {
  return {
    user: { id: opts.userId ?? 7, associationId: 15 },
    params: opts.params ?? {},
    query: {},
    body: {},
    permissions: new Set(opts.permissions),
  } as unknown as Request;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.supportTicket.findMany.mockResolvedValue([]);
  mockPrisma.supportTicket.count.mockResolvedValue(0);
  mockPrisma.supportTicket.findFirst.mockResolvedValue(null);
});

describe('listTickets', () => {
  it("ignores a member's userId filter and returns only their own tickets", async () => {
    await supportService.listTickets(15, { userId: 99 } as never, { viewAll: false, userId: 7 });

    expect(mockPrisma.supportTicket.findMany.mock.calls[0][0].where.userId).toBe(7);
  });

  it('never widens the list when the caller has no user id', async () => {
    await supportService.listTickets(15, {} as never, { viewAll: false });

    expect(mockPrisma.supportTicket.findMany.mock.calls[0][0].where.userId).toBe(-1);
  });

  it('lets staff filter by another user', async () => {
    await supportService.listTickets(15, { userId: 99 } as never, { viewAll: true, userId: 1 });

    expect(mockPrisma.supportTicket.findMany.mock.calls[0][0].where.userId).toBe(99);
  });

  it('shows staff everything in the association when they do not filter', async () => {
    await supportService.listTickets(15, {} as never, { viewAll: true, userId: 1 });

    expect(mockPrisma.supportTicket.findMany.mock.calls[0][0].where).toEqual({ associationId: 15, audience: 'ASSOCIATION' });
  });
});

describe('getTicketById', () => {
  it('scopes a non-staff lookup to the caller', async () => {
    await supportService.getTicketById(15, 3, { viewAll: false, userId: 7 });

    expect(mockPrisma.supportTicket.findFirst.mock.calls[0][0].where).toEqual({
      id: 3,
      associationId: 15,
      OR: [{ audience: 'ASSOCIATION' }, { userId: 7 }],
      userId: 7,
    });
  });

  it('never leaves a non-staff lookup unscoped', async () => {
    await supportService.getTicketById(15, 3, { viewAll: false });

    expect(mockPrisma.supportTicket.findFirst.mock.calls[0][0].where.userId).toBe(-1);
  });
});

describe.each([
  ['closeTicket', 'closeTicket'],
  ['reopenTicket', 'reopenTicket'],
] as const)('%s endpoint', (_label, handler) => {
  const spyClose = jest.spyOn(supportService, 'closeTicket');
  const spyReopen = jest.spyOn(supportService, 'reopenTicket');

  beforeEach(() => {
    spyClose.mockResolvedValue({ id: 3 } as never);
    spyReopen.mockResolvedValue({ id: 3 } as never);
  });

  it("404s a member acting on someone else's ticket, without changing it", async () => {
    mockPrisma.supportTicket.findFirst.mockResolvedValue(null); // not theirs → scoped lookup finds nothing
    const res = makeRes();

    await supportController[handler](makeReq({ permissions: ['support.create'], params: { id: '3' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(spyClose).not.toHaveBeenCalled();
    expect(spyReopen).not.toHaveBeenCalled();
  });

  it('lets a member act on their own ticket', async () => {
    mockPrisma.supportTicket.findFirst.mockResolvedValue({ id: 3, userId: 7, responses: [], attachments: [] });
    mockPrisma.auditLog.create.mockResolvedValue({});
    const res = makeRes();

    await supportController[handler](makeReq({ permissions: ['support.create'], params: { id: '3' } }), res);

    expect(res.status).not.toHaveBeenCalledWith(404);
    expect(handler === 'closeTicket' ? spyClose : spyReopen).toHaveBeenCalledTimes(1);
  });

  it('lets staff act on any ticket in the association', async () => {
    mockPrisma.supportTicket.findFirst.mockResolvedValue({ id: 3, userId: 99, responses: [], attachments: [] });
    mockPrisma.auditLog.create.mockResolvedValue({});
    const res = makeRes();

    await supportController[handler](makeReq({ permissions: ['support.manage'], params: { id: '3' } }), res);

    expect(mockPrisma.supportTicket.findFirst.mock.calls[0][0].where).toEqual({ id: 3, associationId: 15, OR: [{ audience: 'ASSOCIATION' }, { userId: 7 }] });
    expect(handler === 'closeTicket' ? spyClose : spyReopen).toHaveBeenCalledTimes(1);
  });
});

describe('getAttachmentForAccess', () => {
  const attachment = (overrides: Record<string, unknown> = {}) => ({
    id: 4,
    filePath: 'support-tickets/15/3/a.png',
    originalName: 'a.png',
    mimeType: 'image/png',
    ticket: { associationId: 15, userId: 7 },
    response: null,
    ...overrides,
  });

  it("opens a member's own attachment", async () => {
    mockPrisma.ticketAttachment.findUnique.mockResolvedValue(attachment());

    expect(await supportService.getAttachmentForAccess(15, 4, { userId: 7, viewAll: false })).not.toBeNull();
  });

  it("refuses another member's attachment", async () => {
    mockPrisma.ticketAttachment.findUnique.mockResolvedValue(attachment({ ticket: { associationId: 15, userId: 99 } }));

    expect(await supportService.getAttachmentForAccess(15, 4, { userId: 7, viewAll: false })).toBeNull();
  });

  it("refuses an attachment from another association, even for staff", async () => {
    mockPrisma.ticketAttachment.findUnique.mockResolvedValue(attachment({ ticket: { associationId: 20, userId: 99 } }));

    expect(await supportService.getAttachmentForAccess(15, 4, { userId: 1, viewAll: true })).toBeNull();
  });

  it("hides a file on a staff-only internal note from the member who owns the ticket", async () => {
    mockPrisma.ticketAttachment.findUnique.mockResolvedValue(attachment({ response: { isInternal: true } }));

    expect(await supportService.getAttachmentForAccess(15, 4, { userId: 7, viewAll: false })).toBeNull();
    expect(await supportService.getAttachmentForAccess(15, 4, { userId: 1, viewAll: true })).not.toBeNull();
  });
});

describe('getAttachment endpoint', () => {
  it('returns a signed link without ever exposing the storage key', async () => {
    mockPrisma.ticketAttachment.findUnique.mockResolvedValue({
      id: 4,
      filePath: 'support-tickets/15/3/a.png',
      originalName: 'a.png',
      mimeType: 'image/png',
      ticket: { associationId: 15, userId: 7 },
      response: null,
    });
    const res = makeRes();

    await supportController.getAttachment(makeReq({ permissions: ['support.view_own'], params: { id: '4' } }), res);

    expect(res.json).toHaveBeenCalledWith({ success: true, data: { url: 'https://storage.example/signed', filename: 'a.png', mimeType: 'image/png' } });
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain('support-tickets/15');
  });

  it('404s an attachment the caller cannot open', async () => {
    mockPrisma.ticketAttachment.findUnique.mockResolvedValue(null);
    const res = makeRes();

    await supportController.getAttachment(makeReq({ permissions: ['support.view_own'], params: { id: '4' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
