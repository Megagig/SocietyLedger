/** `associations.routes.ts` — api-contract.md §2. */
import type { AssociationTier, AssociationStatus } from './enums';

/** POST /associations/signup — verified against associations.controller.ts signup (2026-11-03). */
export type SignupResponseDTO = {
  association: { id: number; name: string; subdomain: string };
  user: { id: number; email: string; emailVerified: boolean };
  /** False when the platform has switched email verification off: go straight to sign-in. */
  requiresVerification: boolean;
  /** True while the SaaS owner has still to approve the founding admin. */
  pendingApproval: boolean;
  verificationEmailSent: boolean;
};

/** The body POST /associations/signup takes (packages/shared `associationSignupSchema`). */
export type SignupPayload = {
  association: { name: string; subdomain: string; type: string; customType?: string };
  admin: { firstName: string; lastName: string; email: string; phone: string; password: string };
};

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
