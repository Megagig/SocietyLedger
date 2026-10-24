const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();
jest.mock('../client', () => ({
  client: {
    get: (...a: unknown[]) => mockGet(...a),
    post: (...a: unknown[]) => mockPost(...a),
    put: (...a: unknown[]) => mockPut(...a),
    delete: (...a: unknown[]) => mockDelete(...a),
  },
}));

import { communicationApi } from './communication';

const ok = (data: unknown) => Promise.resolve({ data: { success: true, data } });

beforeEach(() => jest.clearAllMocks());

describe('communicationApi announcements', () => {
  const payload = { title: 'AGM', message: 'Saturday', priority: 'info' as const, audience: 'ALL' as const, sendEmail: false, sendSms: true };

  it('previews, sends and lists announcements on the notification routes', async () => {
    mockPost.mockReturnValue(ok({}));
    mockGet.mockReturnValue(ok({ announcements: [], pagination: {} }));
    await communicationApi.previewAnnouncement(payload);
    await communicationApi.sendAnnouncement(payload);
    await communicationApi.listAnnouncements({ page: 2, limit: 20 });
    expect(mockPost).toHaveBeenNthCalledWith(1, '/notifications/announcement/preview', payload);
    expect(mockPost).toHaveBeenNthCalledWith(2, '/notifications/announcement', payload);
    expect(mockGet).toHaveBeenCalledWith('/notifications/announcements', { params: { page: 2, limit: 20 } });
  });
});

describe('communicationApi texts', () => {
  it('reads the dashboard, the balance and the credit history', async () => {
    mockGet.mockReturnValue(ok({}));
    await communicationApi.getSmsDashboard();
    await communicationApi.getBalance();
    await communicationApi.getCreditHistory({ page: 1, limit: 20 });
    expect(mockGet).toHaveBeenNthCalledWith(1, '/sms/dashboard');
    expect(mockGet).toHaveBeenNthCalledWith(2, '/sms/credits/balance');
    expect(mockGet).toHaveBeenNthCalledWith(3, '/sms/credits/history', { params: { page: 1, limit: 20 } });
  });

  it('previews an audience and sends a quick text', async () => {
    mockPost.mockReturnValue(ok({}));
    await communicationApi.previewAudience({ recipientType: 'OWING_MEMBERS', message: 'Pay up' });
    await communicationApi.sendQuick({ recipients: ['12', '08031234567'], message: 'Hello' });
    expect(mockPost).toHaveBeenNthCalledWith(1, '/sms/audience/preview', { recipientType: 'OWING_MEMBERS', message: 'Pay up' });
    expect(mockPost).toHaveBeenNthCalledWith(2, '/sms/send', { recipients: ['12', '08031234567'], message: 'Hello' });
  });

  it('lists messages, filtered by status and campaign', async () => {
    mockGet.mockReturnValue(ok({ messages: [] }));
    await communicationApi.listMessages({ page: 1, limit: 20, status: 'FAILED', campaignId: 4 });
    expect(mockGet).toHaveBeenCalledWith('/sms/messages', { params: { page: 1, limit: 20, status: 'FAILED', campaignId: 4 } });
  });
});

describe('communicationApi campaigns and templates', () => {
  it('creates, starts, cancels and deletes a campaign', async () => {
    mockPost.mockReturnValue(ok({ id: 7 }));
    mockDelete.mockReturnValue(ok({}));
    await communicationApi.createCampaign({ name: 'Dues', message: 'Pay', recipientType: 'ALL_MEMBERS' });
    await communicationApi.startCampaign(7);
    await communicationApi.cancelCampaign(7);
    await communicationApi.deleteCampaign(7);
    expect(mockPost).toHaveBeenNthCalledWith(1, '/sms/campaigns', expect.objectContaining({ name: 'Dues' }));
    expect(mockPost).toHaveBeenNthCalledWith(2, '/sms/campaigns/7/start');
    expect(mockPost).toHaveBeenNthCalledWith(3, '/sms/campaigns/7/cancel');
    expect(mockDelete).toHaveBeenCalledWith('/sms/campaigns/7');
  });

  it('lists campaigns by status and opens one', async () => {
    mockGet.mockReturnValue(ok({}));
    await communicationApi.listCampaigns({ page: 1, limit: 20, status: 'IN_PROGRESS' });
    await communicationApi.getCampaign(7);
    expect(mockGet).toHaveBeenNthCalledWith(1, '/sms/campaigns', { params: { page: 1, limit: 20, status: 'IN_PROGRESS' } });
    expect(mockGet).toHaveBeenNthCalledWith(2, '/sms/campaigns/7');
  });

  it('adds, changes and removes a template', async () => {
    mockPost.mockReturnValue(ok({ id: 2 }));
    mockPut.mockReturnValue(ok({ id: 2 }));
    mockDelete.mockReturnValue(ok({}));
    await communicationApi.createTemplate({ name: 'Dues', content: 'Hi {name}', category: 'DUES', placeholders: ['name'] });
    await communicationApi.updateTemplate(2, { isActive: false });
    await communicationApi.deleteTemplate(2);
    expect(mockPost).toHaveBeenCalledWith('/sms/templates', expect.objectContaining({ category: 'DUES' }));
    expect(mockPut).toHaveBeenCalledWith('/sms/templates/2', { isActive: false });
    expect(mockDelete).toHaveBeenCalledWith('/sms/templates/2');
  });
});
