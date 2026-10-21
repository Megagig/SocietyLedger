/** `/api/devices/*` (F0.2) — no `X-Tenant` needed — api-contract.md §11. */

export type DevicePlatform = 'ios' | 'android';

/** POST /devices/register — verified 2026-10-19. Upserts by `expoPushToken` (unique) — re-registering reassigns the token to the current caller and clears any prior `disabledAt`. */
export type RegisterDeviceRequestDTO = {
  expoPushToken: string;
  platform: DevicePlatform;
  deviceName?: string;
  appVersion?: string;
};

export type RegisterDeviceResponseDTO = {
  id: number;
};

/** POST /devices/unregister — verified 2026-10-19. Scoped to the caller's own tokens; idempotent. */
export type UnregisterDeviceRequestDTO = {
  expoPushToken: string;
};
