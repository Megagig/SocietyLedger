import { supportApi } from './support';

const mockPost = jest.fn();
const mockGet = jest.fn();
const mockPatch = jest.fn();
jest.mock('../client', () => ({
  client: { post: (...args: unknown[]) => mockPost(...args), get: (...args: unknown[]) => mockGet(...args), patch: (...args: unknown[]) => mockPatch(...args) },
}));

const ok = (data: unknown) => Promise.resolve({ data: { success: true, data } });

beforeEach(() => jest.clearAllMocks());

describe('Tier 2 and staff calls', () => {
  it("opens a platform ticket on its own endpoint, with only the fields a platform ticket takes", async () => {
    mockPost.mockReturnValue(ok({ id: 9 }));
    const append = jest.spyOn(FormData.prototype, 'append');

    await supportApi.createPlatformTicket({
      subject: 'Plan upgrade stuck',
      description: 'The upgrade did not apply to our association.',
      category: 'BILLING',
      priority: 'HIGH',
      aiCategory: 'PAYMENTS',
      aiCategoryConfidence: 0.9,
    });

    expect(mockPost.mock.calls[0][0]).toBe('/support/platform-tickets');
    expect(append.mock.calls.map(([key]) => key)).toEqual(['subject', 'description', 'category', 'priority']);
    append.mockRestore();
  });

  it("escalates a member's ticket to the ticket's own escalate endpoint, sending the officer's summary", async () => {
    mockPost.mockReturnValue(ok({ id: 50, ticketNumber: 'TKT-50' }));
    const append = jest.spyOn(FormData.prototype, 'append');

    const { ticket } = await supportApi.escalateTicket(3, { subject: 'Payment sync fails', summary: 'Several members report it.', category: 'BUG', priority: 'MEDIUM' });

    expect(ticket.id).toBe(50);
    expect(mockPost.mock.calls[0][0]).toBe('/support/tickets/3/escalate');
    expect(append.mock.calls.map(([key]) => key)).toEqual(['subject', 'summary', 'category', 'priority']);
    append.mockRestore();
  });

  it('lists my own tickets with my user id, and Tier 2 tickets with the audience', async () => {
    mockGet.mockReturnValue(ok({ tickets: [], total: 0, hasMore: false }));

    await supportApi.listTickets({ userId: 7 });
    await supportApi.listTickets({ audience: 'PLATFORM' });

    expect(mockGet.mock.calls[0][1].params).toMatchObject({ userId: 7, audience: undefined });
    expect(mockGet.mock.calls[1][1].params).toMatchObject({ audience: 'PLATFORM' });
  });

  it('marks a reply as an internal note only when asked', async () => {
    mockPost.mockReturnValue(ok({ id: 1 }));
    const append = jest.spyOn(FormData.prototype, 'append');

    await supportApi.reply(3, 'plain');
    expect(append.mock.calls.map(([key]) => key)).toEqual(['message']);

    append.mockClear();
    await supportApi.reply(3, 'note', undefined, { isInternal: true });
    expect(append.mock.calls).toEqual([['message', 'note'], ['isInternal', 'true']]);
    append.mockRestore();
  });

  it('changes status, priority or assignee with a PATCH', async () => {
    mockPatch.mockReturnValue(ok({ id: 3 }));

    await supportApi.updateTicket(3, { status: 'IN_PROGRESS', assignedToId: 7 });

    expect(mockPatch).toHaveBeenCalledWith('/support/tickets/3', { status: 'IN_PROGRESS', assignedToId: 7 });
  });

  it('returns a suggested reply, and null when the AI service is off or fails', async () => {
    mockPost.mockReturnValueOnce(ok({ suggestion: 'Thanks — we are looking into it.', confidence: 0.8, tone: 'friendly', sources: [] }));
    expect((await supportApi.suggestReply({ subject: 's', description: 'd', category: 'OTHER' }))?.suggestion).toContain('looking into it');

    mockPost.mockRejectedValueOnce(new Error('503'));
    expect(await supportApi.suggestReply({ subject: 's', description: 'd', category: 'OTHER' })).toBeNull();
  });
});
