/** `associations.routes.ts` — api-contract.md §2. */
import type { AssociationTier, AssociationStatus } from './enums';

/** GET /associations/check-subdomain?subdomain= — verified against associations.controller.ts (2026-10-19). Exactly these 7 fields (explicit Prisma `select`). */
export type CheckSubdomainResponseDTO = {
  id: number;
  name: string;
  slug: string;
  subdomain: string;
  tier: AssociationTier;
  status: AssociationStatus;
  logo: string | null;
  primaryColor: string | null;
};
