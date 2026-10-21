import { client } from '../client';
import { unwrap } from '../envelope';
import type {
  RegisterDeviceRequestDTO,
  RegisterDeviceResponseDTO,
  UnregisterDeviceRequestDTO,
} from '@/types/api/devices';

/** `/api/devices/*` — verified against devices.routes.ts (api-contract.md §11). No `X-Tenant` needed. */
export const devicesApi = {
  /** POST /devices/register — upserts by `expoPushToken`; re-registration clears any `disabledAt`. */
  async register(payload: RegisterDeviceRequestDTO): Promise<RegisterDeviceResponseDTO> {
    return unwrap<RegisterDeviceResponseDTO>(client.post('/devices/register', payload));
  },

  /** POST /devices/unregister — idempotent; scoped to the caller's own tokens. */
  async unregister(payload: UnregisterDeviceRequestDTO): Promise<void> {
    await unwrap<undefined>(client.post('/devices/unregister', payload));
  },
};
