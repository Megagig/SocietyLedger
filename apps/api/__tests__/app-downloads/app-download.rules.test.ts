import {
  detectDevice,
  downloadRequestSchema,
  leadsToCsv,
  leadToCells,
  normalizeEmail,
  releaseInputSchema,
} from '../../src/modules/app-downloads/app-download.rules';

const valid = { firstName: 'Ada', lastName: 'Obi', email: 'Ada@Example.com ', phone: '0803 123-4567', consent: true };

describe('download request', () => {
  it('accepts a complete request and cleans the phone number', () => {
    const r = downloadRequestSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.phone).toBe('08031234567');
  });

  it('accepts international numbers', () => {
    expect(downloadRequestSchema.safeParse({ ...valid, phone: '+234 803 123 4567' }).success).toBe(true);
  });

  it.each([
    ['firstName', ''],
    ['lastName', '  '],
    ['email', 'not-an-email'],
    ['phone', '12ab'],
    ['phone', '123'],
  ])('rejects a bad %s', (field, value) => {
    expect(downloadRequestSchema.safeParse({ ...valid, [field]: value }).success).toBe(false);
  });

  it('requires consent to be given', () => {
    expect(downloadRequestSchema.safeParse({ ...valid, consent: false }).success).toBe(false);
    const { consent: _omit, ...rest } = valid;
    expect(downloadRequestSchema.safeParse(rest).success).toBe(false);
  });

  it('matches emails regardless of case and spacing', () => {
    expect(normalizeEmail(' Ada@Example.COM ')).toBe('ada@example.com');
  });
});

describe('release input', () => {
  it('needs an https link', () => {
    expect(releaseInputSchema.safeParse({ version: '1.0.0', url: 'http://files.example.com/app.apk' }).success).toBe(false);
    expect(releaseInputSchema.safeParse({ version: '1.0.0', url: 'javascript:alert(1)' }).success).toBe(false);
    expect(releaseInputSchema.safeParse({ version: '1.0.0', url: 'https://files.example.com/app.apk' }).success).toBe(true);
  });

  it('needs a version', () => {
    expect(releaseInputSchema.safeParse({ version: ' ', url: 'https://files.example.com/app.apk' }).success).toBe(false);
  });
});

describe('device detection', () => {
  it('tells the common devices apart', () => {
    expect(detectDevice('Mozilla/5.0 (Linux; Android 14; Redmi Note 13) Chrome/120')).toBe('android');
    expect(detectDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('ios');
    expect(detectDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('desktop');
    expect(detectDevice(undefined)).toBe('other');
  });
});

describe('export', () => {
  const row = {
    firstName: 'Ada',
    lastName: 'Obi, Jr.',
    email: 'ada@example.com',
    phone: '08031234567',
    consent: true,
    firstDownloadAt: new Date('2026-11-01T10:00:00Z'),
    lastDownloadAt: null,
    downloads: 2,
  };

  it('writes a header row and quotes values that contain commas', () => {
    const csv = leadsToCsv([row]);
    const lines = csv.replace('﻿', '').trim().split('\r\n');
    expect(lines[0]).toBe('First name,Last name,Email,Phone,Consented,First seen,Last download,Downloads');
    expect(lines[1]).toContain('"Obi, Jr."');
    expect(lines[1]).toContain(',Yes,');
  });

  it('keeps a spreadsheet from running a name as a formula', () => {
    expect(leadToCells({ ...row, firstName: '=HYPERLINK("http://evil")' })[0]).toBe('\'=HYPERLINK("http://evil")');
  });
});
