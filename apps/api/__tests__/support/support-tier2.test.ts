/**
 * Tier 2 — an association admin asking SocietyLedger support. The rules that matter:
 *  - a Tier 2 ticket is visible, on the association side, only to the admin who opened it;
 *  - SocietyLedger's team can only ever read Tier 2 tickets, never a member's Tier 1 ticket;
 *  - escalating opens a new ticket in the officer's own words and copies nothing of the member's;
 *  - on a Tier 2 ticket the association admin is the customer, not staff.
 * Prisma, storage and notifications are mocked.
 */
const mockPrisma = {
  supportTicket: { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn(), create: jest.fn(), groupBy: jest.fn() },
  ticketResponse: { create: jest.fn() },
  ticketAttachment: { findUnique: jest.fn(), create: jest.fn() },
  user: { findMany: jest.fn(), findUnique: jest.fn() },
  association: { findUnique: jest.fn() },
  auditLog: { create: jest.fn() },
};
jest.mock('../../src/lib/prisma', () => ({ prisma: mockPrisma }));
jest.mock('../../src/lib/storage', () => ({ uploadFile: jest.fn(), deleteFile: jest.fn(), getPresignedUrl: jest.fn().mockResolvedValue('https://storage.example/signed') }));
const mockDispatch = jest.fn();
jest.mock('../../src/services/notification-preferences.service', () => ({ dispatchNotification: (...args: unknown[]) => mockDispatch(...args) }));
jest.mock('../../src/lib/email', () => ({ sendEmail: jest.fn() }));

import type { Request, Response } from 'express';
import { supportService } from '../../src/modules/support/support.service';
import { supportController } from '../../src/modules/support/support.controller';
import { platformSupportService } from '../../src/modules/support/support-platform.service';

function makeRes() {
  const res = { status: jest.fn(), json: jest.fn() } as unknown as Response & { status: jest.Mock; json: jest.Mock };
  res.status.mockReturnValue(res);
  return res;
}

function makeReq(opts: { permissions: string[]; params?: Record<string, string>; body?: Record<string, unknown>; userId?: number }): Request {
  return { user: { id: opts.userId ?? 7, associationId: 15 }, params: opts.params ?? {}, query: {}, body: opts.body ?? {}, files: [], permissions: new Set(opts.permissions) } as unknown as Request;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.supportTicket.findMany.mockResolvedValue([]);
  mockPrisma.supportTicket.count.mockResolvedValue(0);
  mockPrisma.supportTicket.findFirst.mockResolvedValue(null);
  mockPrisma.auditLog.create.mockResolvedValue({});
  mockDispatch.mockResolvedValue({});
});

describe('association side', () => {
  it('lists Tier 1 tickets by default, so staff never see Tier 2 tickets in the member queue', async () => {
    await supportService.listTickets(15, {} as never, { viewAll: true, userId: 1 });

    expect(mockPrisma.supportTicket.findMany.mock.calls[0][0].where.audience).toBe('ASSOCIATION');
  });

  it("shows even staff only their own tickets when listing Tier 2 — another admin's is never listed", async () => {
    await supportService.listTickets(15, { audience: 'PLATFORM', userId: 99 } as never, { viewAll: true, userId: 1 });

    const where = mockPrisma.supportTicket.findMany.mock.calls[0][0].where;
    expect(where.audience).toBe('PLATFORM');
    expect(where.userId).toBe(1);
  });

  it('reads a Tier 2 ticket only for its opener, even with view-all permission', async () => {
    await supportService.getTicketById(15, 3, { viewAll: true, userId: 1 });

    expect(mockPrisma.supportTicket.findFirst.mock.calls[0][0].where).toEqual({
      id: 3,
      associationId: 15,
      OR: [{ audience: 'ASSOCIATION' }, { userId: 1 }],
    });
  });

  it("refuses another admin's Tier 2 attachment", async () => {
    mockPrisma.ticketAttachment.findUnique.mockResolvedValue({
      id: 4,
      filePath: 'k',
      ticket: { associationId: 15, userId: 99, audience: 'PLATFORM' },
      response: null,
    });

    expect(await supportService.getAttachmentForAccess(15, 4, { userId: 1, viewAll: true })).toBeNull();
    expect(await supportService.getAttachmentForAccess(15, 4, { userId: 99, viewAll: false })).not.toBeNull();
  });
});

describe('escalateTicket', () => {
  it("opens a platform ticket from the officer's own words, links it back, and notes the original", async () => {
    const create = jest.spyOn(supportService, 'createTicket').mockResolvedValue({ id: 50, ticketNumber: 'TKT-50' } as never);
    mockPrisma.ticketResponse.create.mockResolvedValue({});

    const ticket = await supportService.escalateTicket(15, 3, 1, { subject: 'Payment sync fails', summary: 'Several members report the same fault.', category: 'BUG' });

    expect(ticket.id).toBe(50);
    expect(create).toHaveBeenCalledWith(
      15,
      1,
      { subject: 'Payment sync fails', description: 'Several members report the same fault.', category: 'BUG', priority: undefined },
      { audience: 'PLATFORM', escalatedFromId: 3 }
    );
    const note = mockPrisma.ticketResponse.create.mock.calls[0][0].data;
    expect(note).toMatchObject({ ticketId: 3, userId: 1, isStaff: true, isInternal: true });
    expect(note.message).toContain('TKT-50');
    create.mockRestore();
  });

  describe('endpoint', () => {
    it('refuses someone who is not association support staff', async () => {
      const res = makeRes();
      await supportController.escalateTicket(makeReq({ permissions: ['support.escalate'], params: { id: '3' }, body: { subject: 'A subject', summary: 'A long enough summary.', category: 'BUG' } }), res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("404s a ticket that is itself a Tier 2 ticket, so tickets can't be escalated in a loop", async () => {
      mockPrisma.supportTicket.findFirst.mockResolvedValue({ id: 3, audience: 'PLATFORM', userId: 1, responses: [], attachments: [] });
      const res = makeRes();

      await supportController.escalateTicket(makeReq({ userId: 1, permissions: ['support.escalate', 'support.view_all'], params: { id: '3' }, body: { subject: 'A subject', summary: 'A long enough summary.', category: 'BUG' } }), res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('rejects a category that only members use', async () => {
      const res = makeRes();
      await supportController.escalateTicket(makeReq({ permissions: ['support.escalate', 'support.view_all'], params: { id: '3' }, body: { subject: 'A subject', summary: 'A long enough summary.', category: 'PAYMENTS' } }), res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});

describe('replying on a Tier 2 ticket from the association side', () => {
  const platformTicket = { id: 3, audience: 'PLATFORM', userId: 7, responses: [], attachments: [] };

  it('is a customer reply, even for an admin who holds support.respond — and tells SocietyLedger, not the association', async () => {
    mockPrisma.supportTicket.findFirst.mockResolvedValue(platformTicket);
    const addResponse = jest.spyOn(supportService, 'addResponse').mockResolvedValue({ id: 70 } as never);
    const notify = jest.spyOn(supportService, 'notifyOfReply').mockResolvedValue(undefined);
    const res = makeRes();

    await supportController.addResponse(makeReq({ permissions: ['support.respond', 'support.manage', 'support.create'], params: { id: '3' }, body: { message: 'Any update?' } }), res);

    expect(addResponse).toHaveBeenCalledWith(3, 7, expect.objectContaining({ message: 'Any update?' }), false);
    expect(notify).toHaveBeenCalledWith(15, 3, expect.objectContaining({ isStaff: false }));
    addResponse.mockRestore();
    notify.mockRestore();
  });

  it('cannot leave an internal note', async () => {
    mockPrisma.supportTicket.findFirst.mockResolvedValue(platformTicket);
    const res = makeRes();

    await supportController.addResponse(makeReq({ permissions: ['support.respond', 'support.create'], params: { id: '3' }, body: { message: 'note', isInternal: true } }), res);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('platform side — only ever Tier 2', () => {
  it('lists only platform tickets, however it is filtered', async () => {
    await platformSupportService.listTickets({ associationId: 15, search: 'sync' });

    expect(mockPrisma.supportTicket.findMany.mock.calls[0][0].where.audience).toBe('PLATFORM');
    expect(mockPrisma.supportTicket.count.mock.calls[0][0].where.audience).toBe('PLATFORM');
  });

  it("will not read a member's Tier 1 ticket", async () => {
    await platformSupportService.getTicket(3);

    expect(mockPrisma.supportTicket.findFirst.mock.calls[0][0].where).toEqual({ id: 3, audience: 'PLATFORM' });
  });

  it('says a ticket began as an escalation without revealing which member ticket', async () => {
    mockPrisma.supportTicket.findFirst.mockResolvedValue({ id: 50, escalatedFromId: 3, attachments: [], responses: [] });

    const ticket = await platformSupportService.getTicket(50);

    expect(ticket).toMatchObject({ id: 50, isEscalation: true });
    expect(ticket).not.toHaveProperty('escalatedFromId');
  });

  it('refuses to reply to, or change, a ticket that is not a platform ticket', async () => {
    mockPrisma.supportTicket.findFirst.mockResolvedValue(null);

    await expect(platformSupportService.respond(3, 99, { message: 'hello' })).rejects.toThrow('Ticket not found');
    await expect(platformSupportService.updateTicket(3, 99, { status: 'CLOSED' })).rejects.toThrow('Ticket not found');
  });

  it('opens only Tier 2 attachments', async () => {
    mockPrisma.ticketAttachment.findUnique.mockResolvedValue({ id: 4, filePath: 'k', ticket: { audience: 'ASSOCIATION' } });
    expect(await platformSupportService.getAttachmentForAccess(4)).toBeNull();

    mockPrisma.ticketAttachment.findUnique.mockResolvedValue({ id: 4, filePath: 'k', ticket: { audience: 'PLATFORM' } });
    expect(await platformSupportService.getAttachmentForAccess(4)).not.toBeNull();
  });

  it('assigns only to SocietyLedger support staff', async () => {
    mockPrisma.supportTicket.findFirst.mockResolvedValue({ id: 3, associationId: 15, status: 'OPEN' });
    mockPrisma.user.findMany.mockResolvedValue([{ id: 99, email: 'agent@x.com', associationId: 1 }]);

    await expect(platformSupportService.updateTicket(3, 99, { assignedToId: 12345 })).rejects.toThrow('only be assigned to SocietyLedger support staff');
  });

  it('rejects an impossible status move', async () => {
    mockPrisma.supportTicket.findFirst.mockResolvedValue({ id: 3, associationId: 15, status: 'CLOSED' });

    await expect(platformSupportService.updateTicket(3, 99, { status: 'RESOLVED' })).rejects.toThrow('Invalid status transition');
  });

  it('tells the admin who opened the ticket when support replies, by push, in-app and email', async () => {
    mockPrisma.supportTicket.findUnique.mockResolvedValue({ id: 3, userId: 7, associationId: 15, ticketNumber: 'TKT-3', subject: 'Sync', association: { name: 'Oko Youth Forum' } });

    await platformSupportService.notifyOpenerOfReply(3, 'We are on it.');

    expect(mockDispatch.mock.calls[0][0]).toMatchObject({ userId: 7, associationId: 15, pushType: 'support.ticket_reply', sendEmail: true, emailTemplate: 'support-ticket-reply' });
    expect(mockDispatch.mock.calls[0][0].emailData.staffLabel).toBe('SocietyLedger support');
  });

  it('only tells the opener about a resolved or closed ticket', async () => {
    mockPrisma.supportTicket.findUnique.mockResolvedValue({ id: 3, userId: 7, associationId: 15, ticketNumber: 'TKT-3' });

    await platformSupportService.notifyOpenerOfStatus(3, 'IN_PROGRESS');
    expect(mockDispatch).not.toHaveBeenCalled();

    await platformSupportService.notifyOpenerOfStatus(3, 'RESOLVED');
    expect(mockDispatch).toHaveBeenCalledTimes(1);
  });
});
