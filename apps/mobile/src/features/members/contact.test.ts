import { mailUrl, normalizePhone, telUrl, whatsappUrl } from './contact';

describe('normalizePhone', () => {
  it.each([
    ['0803 123 4567', '2348031234567'],
    ['+234 803 123 4567', '2348031234567'],
    ['2348031234567', '2348031234567'],
    ['803-123-4567', '2348031234567'],
    ['(0803) 123-4567', '2348031234567'],
  ])('turns %s into %s', (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected);
  });

  it('keeps a foreign number as digits', () => {
    expect(normalizePhone('+44 7700 900123')).toBe('447700900123');
  });

  it('returns null for empty or too-short input', () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('12345')).toBeNull();
  });
});

describe('contact urls', () => {
  it('builds tel and WhatsApp links from a local number', () => {
    expect(telUrl('08031234567')).toBe('tel:+2348031234567');
    expect(whatsappUrl('08031234567')).toBe('https://wa.me/2348031234567');
  });

  it('gives null when there is nothing to dial', () => {
    expect(telUrl(null)).toBeNull();
    expect(whatsappUrl('abc')).toBeNull();
  });

  it('builds a mailto link and trims the address', () => {
    expect(mailUrl('  ada@example.com ')).toBe('mailto:ada@example.com');
    expect(mailUrl('   ')).toBeNull();
    expect(mailUrl(undefined)).toBeNull();
  });
});
