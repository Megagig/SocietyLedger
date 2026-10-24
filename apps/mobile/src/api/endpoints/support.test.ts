import { supportApi } from './support';

const mockPost = jest.fn();
jest.mock('../client', () => ({ client: { post: (...args: unknown[]) => mockPost(...args), get: jest.fn() } }));

const ok = (data: unknown, extra: Record<string, unknown> = {}) => Promise.resolve({ data: { success: true, data, ...extra } });

beforeEach(() => jest.clearAllMocks());

describe('supportApi.createTicket', () => {
  it('sends multipart with every field and each file under "files"', async () => {
    mockPost.mockReturnValue(ok({ id: 3 }));
    const append = jest.spyOn(FormData.prototype, 'append');

    await supportApi.createTicket({
      subject: 'My payment is missing',
      description: 'Paid on Monday, still not showing.',
      category: 'PAYMENTS',
      priority: 'HIGH',
      files: [
        { uri: 'file:///a.png', name: 'a.png', type: 'image/png' },
        { uri: 'file:///b.pdf', name: 'b.pdf', type: 'application/pdf' },
      ],
    });

    expect(append.mock.calls.map(([key]) => key)).toEqual(['subject', 'description', 'category', 'priority', 'files', 'files']);
    expect(mockPost.mock.calls[0][0]).toBe('/support/tickets');
    expect(mockPost.mock.calls[0][2]).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } });
    append.mockRestore();
  });

  it('reports an attachment failure without losing the ticket', async () => {
    mockPost.mockReturnValue(ok({ id: 3 }, { attachmentError: 'Your files could not be uploaded.' }));

    const result = await supportApi.createTicket({
      subject: 'My payment is missing',
      description: 'Paid on Monday, still not showing.',
      category: 'PAYMENTS',
      priority: 'LOW',
    });

    expect(result.ticket).toEqual({ id: 3 });
    expect(result.attachmentError).toBe('Your files could not be uploaded.');
  });
});

describe('AI assists', () => {
  it('treats an unavailable AI service as "no suggestion"', async () => {
    mockPost.mockReturnValue(ok({ category: 'OTHER', confidence: 0, suggestedPriority: 'MEDIUM', reasoning: '', aiAvailable: false }));

    expect(await supportApi.categorize('Something is wrong with my account')).toBeNull();
  });

  it('never throws when the AI endpoints fail', async () => {
    mockPost.mockRejectedValue(new Error('403'));

    expect(await supportApi.categorize('x'.repeat(30))).toBeNull();
    expect(await supportApi.suggestArticles('x'.repeat(30))).toEqual([]);
  });

  it('returns the suggested articles themselves', async () => {
    mockPost.mockReturnValue(ok({ suggestions: [{ article: { id: 1, title: 'Paying online' }, relevanceScore: 0.9, matchReason: 'x' }] }));

    expect(await supportApi.suggestArticles('how do I pay my dues online')).toEqual([{ id: 1, title: 'Paying online' }]);
  });
});
