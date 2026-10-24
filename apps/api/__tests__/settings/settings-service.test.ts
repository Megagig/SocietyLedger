/** Saving settings: JSON values, one transaction with its audit entry, and a profile that stored keys cannot override. */
const tx: any = {
  settings: { upsert: jest.fn() },
  auditLog: { create: jest.fn() },
};
const prismaMock: any = {
  settings: { findMany: jest.fn() },
  association: { findUnique: jest.fn(), update: jest.fn() },
  auditLog: { create: jest.fn() },
  $transaction: jest.fn((run: (client: unknown) => unknown) => run(tx)),
};
jest.mock('../../src/lib/prisma', () => ({ __esModule: true, default: prismaMock, prisma: prismaMock }));

import { SettingsService } from '../../src/modules/settings/settings.service';

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.settings.findMany.mockResolvedValue([]);
  prismaMock.association.findUnique.mockResolvedValue({ id: 7, name: 'Opuogun Union', logo: '/uploads/logos/logo-7-1.png', primaryColor: '#1a7f5a' });
});

describe('SettingsService.updateSettings', () => {
  it('saves every value as JSON so text that looks like a number stays text', async () => {
    await SettingsService.updateSettings(7, 'notifications', { senderName: '2024', emailEnabled: true, paymentReminderDays: [7, 3] }, 3);
    const saved = Object.fromEntries(tx.settings.upsert.mock.calls.map(([call]: any) => [call.where.associationId_key.key, call.update.value]));
    expect(saved).toEqual({
      'notifications.senderName': '"2024"',
      'notifications.emailEnabled': 'true',
      'notifications.paymentReminderDays': '[7,3]',
    });
  });

  it('writes the audit entry in the same transaction, and only for the keys sent', async () => {
    await SettingsService.updateSettings(7, 'financial', { enableLateFees: true, lateFeeAmount: undefined }, 3);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.settings.upsert).toHaveBeenCalledTimes(1);
    const audit = tx.auditLog.create.mock.calls[0][0].data;
    expect(audit).toMatchObject({ associationId: 7, userId: 3, action: 'SETTINGS_UPDATED' });
    expect(audit.newValues.changes).toEqual([{ key: 'enableLateFees', new: 'true' }]);
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
  });

  it('reads back old bare values and new JSON values the same way', async () => {
    prismaMock.settings.findMany.mockResolvedValue([
      { key: 'financial.defaultGracePeriodDays', value: '14' },
      { key: 'notifications.senderName', value: 'Plain text' },
      { key: 'notifications.emailEnabled', value: 'false' },
      { key: 'notifications.paymentReminderDays', value: '[7,3]' },
    ]);
    expect((await SettingsService.getSettings(7, 'financial')).defaultGracePeriodDays).toBe(14);
    const notifications = await SettingsService.getSettings(7, 'notifications');
    expect(notifications).toMatchObject({ senderName: 'Plain text', emailEnabled: false, paymentReminderDays: [7, 3] });
  });
});

describe('SettingsService association profile', () => {
  it('does not let a stored setting stand in for the name or logo', async () => {
    prismaMock.settings.findMany.mockResolvedValue([
      { key: 'association.name', value: '"Hijacked"' },
      { key: 'association.logo', value: '"/evil.png"' },
    ]);
    const profile = await SettingsService.getAssociationProfile(7);
    expect(profile.name).toBe('Opuogun Union');
    expect(profile.logo).toBe('/uploads/logos/logo-7-1.png');
  });

  it('never saves a logo from the profile, so it cannot choose which file is deleted next', async () => {
    await SettingsService.updateAssociationProfile(7, { name: 'New name', logo: '/../../secrets.txt' } as never, 3);
    expect(prismaMock.association.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { name: 'New name' } });
    expect(tx.settings.upsert).not.toHaveBeenCalled();
  });
});
