import { campaignProgress, creditsLabel, messageStatusKey, parseNumbers } from './labels';
import {
  announcementFormSchema,
  announcementReady,
  audienceProblem,
  campaignFormSchema,
  emptyAnnouncementValues,
  emptyAudience,
  placeholdersIn,
  quickSmsSchema,
  templateFormSchema,
  toAnnouncementPayload,
  toCampaignPayload,
  toRecipientFilter,
  toTemplatePayload,
} from './schemas';

describe('phone numbers typed or pasted', () => {
  it('splits on commas, spaces and new lines, and drops repeats', () => {
    expect(parseNumbers('08031234567, 08051234567\n08031234567;  08061234567')).toEqual(['08031234567', '08051234567', '08061234567']);
    expect(parseNumbers('  ')).toEqual([]);
  });
});

describe('credits', () => {
  it('are said as whole counts', () => {
    expect(creditsLabel(1)).toBe('1 credit');
    expect(creditsLabel(2500)).toBe('2,500 credits');
  });

  it('campaign progress counts failed texts as done, and never passes 100', () => {
    expect(campaignProgress(40, 10, 100)).toBe(50);
    expect(campaignProgress(120, 0, 100)).toBe(100);
    expect(campaignProgress(0, 0, 0)).toBe(0);
  });

  it('a text that is only sent is not shown as delivered', () => {
    expect(messageStatusKey('SENT')).not.toBe(messageStatusKey('DELIVERED'));
  });
});

describe('who a message goes to', () => {
  it('an audience that names nobody is refused, never treated as everyone', () => {
    expect(audienceProblem(emptyAudience('CATEGORY'))).toBe('Pick at least one category');
    expect(audienceProblem(emptyAudience('SELECTED'))).toBe('Choose at least one member');
    expect(audienceProblem(emptyAudience('SELECTED_MEMBERS'))).toBe('Choose at least one member');
    expect(audienceProblem(emptyAudience('CUSTOM_NUMBERS'))).toBe('Add at least one phone number');
    expect(audienceProblem(emptyAudience('ALL'))).toBeNull();
    expect(audienceProblem(emptyAudience('OWING_MEMBERS'))).toBeNull();
  });

  it('builds the filter each text audience needs', () => {
    expect(toRecipientFilter({ ...emptyAudience('MEMBER_CATEGORY'), categories: ['student'] })).toEqual({ categories: ['student'] });
    expect(toRecipientFilter({ ...emptyAudience('SELECTED_MEMBERS'), memberIds: [3, 4] })).toEqual({ memberIds: [3, 4] });
    expect(toRecipientFilter({ ...emptyAudience('CUSTOM_NUMBERS'), numbers: '08031234567, 08051234567' })).toEqual({ customNumbers: ['08031234567', '08051234567'] });
    expect(toRecipientFilter(emptyAudience('ALL_MEMBERS'))).toBeUndefined();
  });
});

describe('an announcement', () => {
  const base = { ...emptyAnnouncementValues(), title: ' AGM ', message: ' We meet on Saturday ' };
  const draft = { values: base, priority: 'info' as const, audience: 'ALL' as const, categories: [], memberIds: [] };

  it('needs a title, a message and a named audience', () => {
    expect(announcementReady(draft)).toBe(true);
    expect(announcementReady({ ...draft, values: { ...base, title: '' } })).toBe(false);
    expect(announcementReady({ ...draft, audience: 'CATEGORY' })).toBe(false);
    expect(announcementReady({ ...draft, audience: 'SELECTED', memberIds: [1] })).toBe(true);
  });

  it('sends only what its audience needs, trimmed, and the text wording only when texts are ticked', () => {
    expect(toAnnouncementPayload(draft)).toEqual({ title: 'AGM', message: 'We meet on Saturday', priority: 'info', audience: 'ALL', sendEmail: false, sendSms: false });
    const texted = toAnnouncementPayload({ ...draft, audience: 'CATEGORY', categories: ['student'], values: { ...base, sendSms: true, smsText: ' AGM Sat ' } });
    expect(texted).toMatchObject({ audience: 'CATEGORY', categories: ['student'], sendSms: true, smsText: 'AGM Sat' });
    expect(texted).not.toHaveProperty('memberIds');
    expect(toAnnouncementPayload({ ...draft, values: { ...base, smsText: 'ignored' } })).not.toHaveProperty('smsText');
  });

  it('the form refuses an empty title or message', () => {
    expect(announcementFormSchema.safeParse(emptyAnnouncementValues()).success).toBe(false);
    expect(announcementFormSchema.safeParse(base).success).toBe(true);
  });
});

describe('a campaign', () => {
  it('needs a name and a message that fits in a text', () => {
    expect(campaignFormSchema.safeParse({ name: '', message: 'Hi', numbers: '', scheduledAt: '' }).success).toBe(false);
    expect(campaignFormSchema.safeParse({ name: 'Dues', message: 'x'.repeat(919), numbers: '', scheduledAt: '' }).success).toBe(false);
    expect(campaignFormSchema.safeParse({ name: 'Dues', message: 'Hi', numbers: '', scheduledAt: '' }).success).toBe(true);
  });

  it('is sent with its audience, template and time', () => {
    const payload = toCampaignPayload({ name: ' Dues ', message: ' Pay ', numbers: '', scheduledAt: '2026-11-01T10:00:00.000Z' }, { ...emptyAudience('MEMBER_CATEGORY'), categories: ['regular'] }, 5);
    expect(payload).toMatchObject({ name: 'Dues', message: 'Pay', recipientType: 'MEMBER_CATEGORY', recipientFilter: { categories: ['regular'] }, templateId: 5, scheduledAt: '2026-11-01T10:00:00.000Z' });
    expect(toCampaignPayload({ name: 'A', message: 'B', numbers: '', scheduledAt: '' }, emptyAudience('ALL_MEMBERS'))).toEqual({ name: 'A', message: 'B', recipientType: 'ALL_MEMBERS' });
  });
});

describe('a quick text and a template', () => {
  it('a quick text needs a message', () => {
    expect(quickSmsSchema.safeParse({ message: '  ', numbers: '' }).success).toBe(false);
    expect(quickSmsSchema.safeParse({ message: 'Hello', numbers: '' }).success).toBe(true);
  });

  it('a template lists the words it fills in', () => {
    expect(placeholdersIn('Dear {name}, you owe {amount}. Thanks {name}')).toEqual(['name', 'amount']);
    expect(toTemplatePayload({ name: ' Dues ', content: 'Dear {name}', category: 'DUES' })).toEqual({ name: 'Dues', content: 'Dear {name}', category: 'DUES', placeholders: ['name'] });
    expect(templateFormSchema.safeParse({ name: '', content: 'x', category: 'GENERAL' }).success).toBe(false);
  });
});
