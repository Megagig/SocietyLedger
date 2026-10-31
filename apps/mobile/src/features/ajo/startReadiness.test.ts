import { startReadiness } from './startReadiness';

describe('startReadiness', () => {
  it('says what to do when nobody is approved yet, and where', () => {
    const r = startReadiness(0);
    expect(r.canStart).toBe(false);
    expect(r).toMatchObject({ fix: 'MEMBERS', reason: 'Nobody is approved yet. Approve at least one person on Members, then start the circle.' });
  });
  it('lets a circle with at least one approved person start (the server still checks)', () => {
    expect(startReadiness(1)).toEqual({ canStart: true });
    expect(startReadiness(12)).toEqual({ canStart: true });
  });
  it('never lets a negative or missing count through', () => {
    expect(startReadiness(-1).canStart).toBe(false);
  });
});
