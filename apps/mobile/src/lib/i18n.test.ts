import { t } from './i18n';

describe('t', () => {
  it('returns the mapped string for a known key', () => {
    expect(t('common.undo')).toBe('Undo');
  });

  it('substitutes {{param}} placeholders', () => {
    expect(t('validation.maxLength', { max: 20 })).toBe('Must be 20 characters or fewer');
  });

  it('leaves the template untouched when no params are given', () => {
    expect(t('validation.maxLength')).toBe('Must be {{max}} characters or fewer');
  });

  it('falls back to the key itself when unmapped', () => {
    // @ts-expect-error -- deliberately an unmapped key, to test the fallback branch
    expect(t('some.unmapped.key')).toBe('some.unmapped.key');
  });
});
