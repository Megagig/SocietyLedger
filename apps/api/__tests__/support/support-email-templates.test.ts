/**
 * The support emails serve two audiences — a member and their association (Tier 1), and an association admin and
 * SocietyLedger support (Tier 2). Both templates must render for both. Resend is mocked; the HTML it is given is checked.
 */
const mockSend = jest.fn();
jest.mock('resend', () => ({ Resend: jest.fn().mockImplementation(() => ({ emails: { send: (...args: unknown[]) => mockSend(...args) } })) }));

process.env.RESEND_API_KEY = 're_test';
process.env.EMAIL_FROM = 'SocietyLedger <noreply@example.com>';
process.env.APP_URL = 'https://app.example.com';

import { sendEmail } from '../../src/lib/email';

beforeEach(() => {
  mockSend.mockReset();
  mockSend.mockResolvedValue({ data: { id: 'email_1' }, error: null });
});

const htmlOf = () => mockSend.mock.calls[0][0].html as string;
const quiet = jest.spyOn(console, 'log').mockImplementation(() => undefined);
afterAll(() => quiet.mockRestore());

describe('support-ticket-new', () => {
  const base = { openerName: 'Ada Obi', associationName: 'Oko Youth Forum', ticketNumber: 'TKT-1', subject: 'Missing payment', category: 'payments', priority: 'high' };

  it('tells association staff a member opened a ticket, linking to the web tickets page', async () => {
    await sendEmail({ to: 'staff@example.com', subject: 's', template: 'support-ticket-new', data: base });

    expect(htmlOf()).toContain('New Support Ticket');
    expect(htmlOf()).toContain('<strong>Ada Obi</strong> opened a support ticket with <strong>Oko Youth Forum</strong>');
    expect(htmlOf()).toContain('https://app.example.com/dashboard/help/tickets');
  });

  it('tells SocietyLedger support an admin opened a platform ticket, linking to the admin console', async () => {
    await sendEmail({ to: 'agent@example.com', subject: 's', template: 'support-ticket-new', data: { ...base, platform: true, url: 'https://admin.example.com/support/tickets/9' } });

    expect(htmlOf()).toContain('New Platform Ticket');
    expect(htmlOf()).toContain('<strong>Ada Obi</strong> at <strong>Oko Youth Forum</strong> opened a ticket for SocietyLedger support.');
    expect(htmlOf()).toContain('https://admin.example.com/support/tickets/9');
    expect(htmlOf()).toContain('Open in Admin Console');
  });

  it('says when a platform ticket began as an escalation', async () => {
    await sendEmail({ to: 'agent@example.com', subject: 's', template: 'support-ticket-new', data: { ...base, platform: true, escalated: true } });

    expect(htmlOf()).toContain('(escalated from a member ticket)');
  });
});

describe('support-ticket-reply', () => {
  const base = { associationName: 'Oko Youth Forum', ticketNumber: 'TKT-1', subject: 'Missing payment', excerpt: 'We found it.', path: '/dashboard/help/tickets/3' };

  it('tells a member their association replied', async () => {
    await sendEmail({ to: 'member@example.com', subject: 's', template: 'support-ticket-reply', data: { ...base, fromStaff: true } });

    expect(htmlOf()).toContain('Your association replied to your support ticket.');
    expect(htmlOf()).toContain('https://app.example.com/dashboard/help/tickets/3');
    expect(htmlOf()).toContain('Help &amp; support');
  });

  it('tells an association admin SocietyLedger support replied', async () => {
    await sendEmail({ to: 'admin@example.com', subject: 's', template: 'support-ticket-reply', data: { ...base, fromStaff: true, staffLabel: 'SocietyLedger support' } });

    expect(htmlOf()).toContain('SocietyLedger support replied to your support ticket.');
  });

  it('tells SocietyLedger support an admin replied, linking to the admin console and without the app hint', async () => {
    await sendEmail({
      to: 'agent@example.com',
      subject: 's',
      template: 'support-ticket-reply',
      data: { ...base, fromStaff: false, customerLabel: 'An admin at Oko Youth Forum', url: 'https://admin.example.com/support/tickets/9' },
    });

    expect(htmlOf()).toContain('An admin at Oko Youth Forum replied to a support ticket you are handling.');
    expect(htmlOf()).toContain('https://admin.example.com/support/tickets/9');
    expect(htmlOf()).not.toContain('Help &amp; support');
  });
});
