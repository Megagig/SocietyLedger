import { validateAttachment } from './attachmentPickers';

const file = (overrides: Partial<{ type: string; size: number }> = {}) => ({ uri: 'file:///a', name: 'a', type: 'image/png', size: 1000, ...overrides });

describe('validateAttachment', () => {
  it('accepts a small photo or PDF', () => {
    expect(validateAttachment(file())).toBeNull();
    expect(validateAttachment(file({ type: 'application/pdf' }))).toBeNull();
  });

  it('rejects a type the API would reject', () => {
    expect(validateAttachment(file({ type: 'application/zip' }))).toBe('That file type is not supported.');
  });

  it('rejects a file over the limit, naming it in MB', () => {
    expect(validateAttachment(file({ size: 6 * 1024 * 1024 }))).toBe('File is larger than 5MB.');
    expect(validateAttachment(file({ size: 6 * 1024 * 1024 }), undefined, 10 * 1024 * 1024)).toBeNull();
  });

  it('does not reject a file whose size is unknown', () => {
    expect(validateAttachment({ uri: 'file:///a', name: 'a', type: 'image/png' })).toBeNull();
  });
});
