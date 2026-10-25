import { tenantBaseUrl } from '../../src/lib/tenant-url';

describe('where a payment returns the buyer to', () => {
  it('is the association’s own address, so the signed-in session is still there', () => {
    expect(tenantBaseUrl('oko-youth-forum', 'http://localhost:3000')).toBe('http://oko-youth-forum.localhost:3000');
    expect(tenantBaseUrl('oko', 'https://societyledger.com.ng/')).toBe('https://oko.societyledger.com.ng');
    expect(tenantBaseUrl('oko', 'https://www.societyledger.com.ng')).toBe('https://oko.societyledger.com.ng');
  });
  it('is left alone when already there, or when there is nothing usable to add', () => {
    expect(tenantBaseUrl('oko', 'https://oko.societyledger.com.ng')).toBe('https://oko.societyledger.com.ng');
    expect(tenantBaseUrl(null, 'http://localhost:3000')).toBe('http://localhost:3000');
    expect(tenantBaseUrl('bad host/..', 'http://localhost:3000')).toBe('http://localhost:3000');
  });
});
