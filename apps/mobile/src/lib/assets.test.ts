import { resolveAssetUrl } from './assets';

describe('resolveAssetUrl', () => {
  it('returns null for a null or undefined path', () => {
    expect(resolveAssetUrl(null)).toBeNull();
    expect(resolveAssetUrl(undefined)).toBeNull();
  });

  it('returns an absolute http(s) URL unchanged', () => {
    expect(resolveAssetUrl('https://cdn.example.com/logo.png')).toBe('https://cdn.example.com/logo.png');
    expect(resolveAssetUrl('http://cdn.example.com/logo.png')).toBe('http://cdn.example.com/logo.png');
  });

  it('prefixes a relative upload path with the API origin', () => {
    expect(resolveAssetUrl('/uploads/logos/1.png')).toBe('http://localhost:4000/uploads/logos/1.png');
  });

  it('adds a leading slash for a relative path missing one', () => {
    expect(resolveAssetUrl('uploads/logos/1.png')).toBe('http://localhost:4000/uploads/logos/1.png');
  });
});
