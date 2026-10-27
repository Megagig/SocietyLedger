/**
 * Ajo platform settings (T1.6): the levy is billed to groups, so a bad rate or a cap above the owner's ceiling must be refused.
 */
jest.mock('../../src/lib/prisma', () => ({ __esModule: true, default: {} }));

import { AJO_LEVY_CEILING, SettingsValidationError, validateAjoSettings, type PlatformSettings } from '../../src/modules/admin/platform-settings.service';

const current = {
  ajoStandaloneSignup: false,
  ajoCycleLevyBps: 50,
  ajoCycleLevyMinKobo: 50_000,
  ajoCycleLevyMaxKobo: 500_000,
  ajoParticipantLevyBps: 25,
  ajoParticipantLevyMinKobo: 5_000,
  ajoParticipantLevyMaxKobo: 100_000,
  ajoLevyExemptAddonCodes: ['ajo-starter'],
} as unknown as PlatformSettings;

describe('validateAjoSettings', () => {
  it('accepts the owner\'s agreed levy: 0.5% (₦500.00 to ₦5,000.00) and 0.25% (₦50.00 to ₦1,000.00)', () => {
    expect(() =>
      validateAjoSettings(
        { ajoCycleLevyBps: 50, ajoCycleLevyMinKobo: 50_000, ajoCycleLevyMaxKobo: 500_000, ajoParticipantLevyBps: 25, ajoParticipantLevyMinKobo: 5_000, ajoParticipantLevyMaxKobo: 100_000 },
        current,
      ),
    ).not.toThrow();
  });

  it('refuses a cycle cap above ₦5,000.00', () => {
    expect(() => validateAjoSettings({ ajoCycleLevyMaxKobo: AJO_LEVY_CEILING.cycleMaxKobo + 1 }, current)).toThrow(SettingsValidationError);
  });

  it('refuses a participant cap above ₦1,000.00', () => {
    expect(() => validateAjoSettings({ ajoParticipantLevyMaxKobo: AJO_LEVY_CEILING.participantMaxKobo + 1 }, current)).toThrow(SettingsValidationError);
  });

  it('refuses a rate above 10%, a negative rate and a fractional one', () => {
    expect(() => validateAjoSettings({ ajoCycleLevyBps: 1_001 }, current)).toThrow(SettingsValidationError);
    expect(() => validateAjoSettings({ ajoCycleLevyBps: -1 }, current)).toThrow(SettingsValidationError);
    expect(() => validateAjoSettings({ ajoParticipantLevyBps: 0.5 }, current)).toThrow(SettingsValidationError);
  });

  it('refuses a minimum above its maximum, including against the value already stored', () => {
    expect(() => validateAjoSettings({ ajoCycleLevyMinKobo: 400_000, ajoCycleLevyMaxKobo: 100_000 }, current)).toThrow(/minimum cannot be more/);
    expect(() => validateAjoSettings({ ajoParticipantLevyMaxKobo: 1_000 }, current)).toThrow(/minimum cannot be more/);
  });

  it('refuses a value that is not a number', () => {
    expect(() => validateAjoSettings({ ajoCycleLevyBps: '50abc' as unknown as number }, current)).toThrow(SettingsValidationError);
    expect(() => validateAjoSettings({ ajoCycleLevyBps: null as unknown as number }, current)).toThrow(SettingsValidationError);
  });

  it('needs the sign-up switch to be a real boolean', () => {
    expect(() => validateAjoSettings({ ajoStandaloneSignup: 'yes' as unknown as boolean }, current)).toThrow(SettingsValidationError);
    expect(validateAjoSettings({ ajoStandaloneSignup: true }, current).ajoStandaloneSignup).toBe(true);
  });

  it('checks the exempt add-on codes and removes duplicates', () => {
    expect(validateAjoSettings({ ajoLevyExemptAddonCodes: ['ajo-starter', 'ajo-starter'] }, current).ajoLevyExemptAddonCodes).toEqual(['ajo-starter']);
    expect(() => validateAjoSettings({ ajoLevyExemptAddonCodes: ['Not A Code'] }, current)).toThrow(SettingsValidationError);
  });

  it('passes settings it does not own through untouched', () => {
    expect(validateAjoSettings({ maintenanceMode: true }, current)).toEqual({ maintenanceMode: true });
  });
});
