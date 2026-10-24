/** Settings are saved only when they are a known key with a sensible value; each category has its own permission. */
import { sniffImageType } from '../../src/modules/settings/logo.service';
import { SETTINGS_READ_PERMISSIONS, SETTINGS_WRITE_PERMISSIONS, validateSettings } from '../../src/modules/settings/settings.schema';
import { RuleError } from '../../src/modules/finance/rule-error';

function refusal(run: () => unknown): RuleError {
  try {
    run();
  } catch (error) {
    if (error instanceof RuleError) return error;
    throw error;
  }
  throw new Error('expected the settings to be refused');
}

describe('validateSettings', () => {
  it('keeps the values a category knows', () => {
    expect(validateSettings('financial', { enableLateFees: true, lateFeeType: 'percentage', lateFeeAmount: 5, defaultGracePeriodDays: 10 })).toEqual({
      enableLateFees: true,
      lateFeeType: 'percentage',
      lateFeeAmount: 5,
      defaultGracePeriodDays: 10,
    });
  });

  it('refuses a key that is not a setting, naming it', () => {
    const error = refusal(() => validateSettings('financial', { enableLateFees: true, isAdmin: true }));
    expect(error.status).toBe(400);
    expect(error.code).toBe('INVALID_SETTINGS');
    expect(error.message).toContain('isAdmin');
  });

  it('refuses the platform category, which belongs to SocietyLedger staff', () => {
    const error = refusal(() => validateSettings('platform', { maintenance: true }));
    expect(error.status).toBe(403);
    expect(error.code).toBe('SETTINGS_NOT_EDITABLE');
  });

  it('refuses a body that is not an object', () => {
    expect(refusal(() => validateSettings('payments', ['cash'])).code).toBe('INVALID_SETTINGS');
    expect(refusal(() => validateSettings('payments', 'cash')).code).toBe('INVALID_SETTINGS');
  });

  it('refuses wrong types and out-of-range numbers in plain words', () => {
    expect(refusal(() => validateSettings('financial', { lateFeeAmount: -1 })).message).toContain('Late fee');
    expect(refusal(() => validateSettings('financial', { enableLateFees: 'yes' })).code).toBe('INVALID_SETTINGS');
    expect(refusal(() => validateSettings('members_access', { inviteExpiryHours: 0 })).message).toContain('Invite lifetime');
    expect(refusal(() => validateSettings('payments', { cashLodgmentDueDays: 500 })).message).toContain('Cash lodgment days');
  });

  it('does not allow a percentage late fee above 100', () => {
    expect(refusal(() => validateSettings('financial', { lateFeeType: 'percentage', lateFeeAmount: 150 })).message).toContain('more than 100');
    expect(() => validateSettings('financial', { lateFeeType: 'fixed', lateFeeAmount: 150 })).not.toThrow();
  });

  it('accepts only real payment methods and at most six reminders', () => {
    expect(refusal(() => validateSettings('payments', { enabledChannels: ['cash', 'bitcoin'] })).code).toBe('INVALID_SETTINGS');
    expect(refusal(() => validateSettings('notifications', { paymentReminderDays: [1, 2, 3, 4, 5, 6, 7] })).message).toContain('Reminder days');
    expect(validateSettings('payments', { enabledChannels: ['cash', 'bank_transfer'] })).toEqual({ enabledChannels: ['cash', 'bank_transfer'] });
  });

  it('upper-cases a member ID prefix and clears it when blank', () => {
    expect(validateSettings('members_access', { memberIdPrefix: 'ogu' })).toEqual({ memberIdPrefix: 'OGU' });
    expect(validateSettings('members_access', { memberIdPrefix: '  ' })).toEqual({ memberIdPrefix: null });
    expect(refusal(() => validateSettings('members_access', { memberIdPrefix: 'TOO-LONG-PREFIX' })).message).toContain('Member ID prefix');
  });

  it('takes the empty text the web forms send as cleared, not as a bad value', () => {
    expect(validateSettings('integrations', { paystackPublicKey: '', nombaAccountId: ' ', webhookUrl: '' })).toEqual({ paystackPublicKey: null, nombaAccountId: null, webhookUrl: null });
    expect(validateSettings('notifications', { senderEmail: '', quietHoursStart: '', quietHoursEnd: '' })).toEqual({ senderEmail: null, quietHoursStart: null, quietHoursEnd: null });
  });

  it('requires an https address for a webhook', () => {
    expect(refusal(() => validateSettings('integrations', { webhookUrl: 'http://example.com/hook' })).code).toBe('INVALID_SETTINGS');
    expect(validateSettings('integrations', { webhookUrl: 'https://example.com/hook' })).toEqual({ webhookUrl: 'https://example.com/hook' });
  });

  describe('the association profile', () => {
    it('checks the colour, email, website and phone, and treats empty text as cleared', () => {
      expect(refusal(() => validateSettings('association', { primaryColor: 'green' })).message).toContain('Brand colour');
      expect(refusal(() => validateSettings('association', { email: 'not-an-email' })).code).toBe('INVALID_SETTINGS');
      expect(refusal(() => validateSettings('association', { website: 'javascript:alert(1)' })).code).toBe('INVALID_SETTINGS');
      expect(refusal(() => validateSettings('association', { phone: 'call me' })).code).toBe('INVALID_SETTINGS');
      expect(validateSettings('association', { address: '', city: ' Lagos ', primaryColor: '#1a7f5a' })).toEqual({ address: null, city: 'Lagos', primaryColor: '#1a7f5a' });
    });

    it('needs a real time zone and a month from 1 to 12', () => {
      expect(refusal(() => validateSettings('association', { timezone: 'Mars/Olympus' })).code).toBe('INVALID_SETTINGS');
      expect(refusal(() => validateSettings('association', { fiscalYearStart: 13 })).code).toBe('INVALID_SETTINGS');
      expect(validateSettings('association', { timezone: 'Africa/Lagos', fiscalYearStart: 4 })).toEqual({ timezone: 'Africa/Lagos', fiscalYearStart: 4 });
    });

    it('drops a logo sent with the profile: only the upload route changes it', () => {
      expect(validateSettings('association', { name: 'Opuogun Union', logo: '/../../etc/passwd' })).toEqual({ name: 'Opuogun Union' });
    });
  });
});

describe('who may change and read each category', () => {
  it('has a write permission for every category except platform', () => {
    expect(Object.keys(SETTINGS_WRITE_PERMISSIONS).sort()).toEqual(['association', 'data_privacy', 'financial', 'integrations', 'members_access', 'notifications', 'payments']);
    expect(SETTINGS_WRITE_PERMISSIONS).not.toHaveProperty('platform');
    expect(SETTINGS_READ_PERMISSIONS).not.toHaveProperty('platform');
  });

  it('does not let the billing or integrations permission change member sign-up or financial rules', () => {
    for (const category of ['association', 'members_access', 'financial', 'notifications', 'data_privacy'] as const) {
      expect(SETTINGS_WRITE_PERMISSIONS[category]).toEqual(['settings.edit']);
    }
    expect(SETTINGS_WRITE_PERMISSIONS.integrations).toEqual(['settings.integrations']);
    expect(SETTINGS_WRITE_PERMISSIONS.payments).toEqual(['settings.edit', 'settings.billing']);
  });
});

describe('sniffImageType', () => {
  it('knows a JPEG, PNG and WebP by their first bytes', () => {
    expect(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe('image/jpeg');
    expect(sniffImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]))).toBe('image/png');
    expect(sniffImageType(Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP')]))).toBe('image/webp');
  });

  it('does not take a web page or script for a picture', () => {
    expect(sniffImageType(Buffer.from('<html><script>alert(1)</script></html>'))).toBeNull();
    expect(sniffImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(sniffImageType(Buffer.alloc(0))).toBeNull();
  });
});
