const mockDevice: { modelName: string | null; brand: string | null; deviceName: string | null } = { modelName: 'Pixel 8', brand: 'Google', deviceName: 'My phone' };
jest.mock('expo-device', () => mockDevice);

describe('deviceHeaders', () => {
  beforeEach(() => jest.resetModules());

  it('names the phone by brand and model, and reports the platform', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { deviceHeaders } = require('./device');
    expect(deviceHeaders()).toEqual({ name: 'Google Pixel 8', platform: expect.stringMatching(/android|ios/) });
  });

  it('does not repeat the brand when the model already starts with it', () => {
    mockDevice.modelName = 'Samsung Galaxy S24';
    mockDevice.brand = 'samsung';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(require('./device').deviceHeaders().name).toBe('Samsung Galaxy S24');
  });

  it('falls back to the device name the owner chose', () => {
    mockDevice.modelName = null;
    mockDevice.deviceName = 'Ada phone';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(require('./device').deviceHeaders().name).toBe('Ada phone');
  });
});
