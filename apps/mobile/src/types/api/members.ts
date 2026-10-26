/** `members.routes.ts` (self-service endpoints only) — api-contract.md §3. */
import type { IsoDateString } from './common';

/**
 * GET /members/me, PATCH /members/me — verified against members.controller.ts (2026-10-19).
 * Both return the raw Member row (all columns) — fields below match architecture.md §10's
 * "key fields used by mobile" list plus the id/audit columns every row carries.
 *
 * `status`, `category`, `gender`, `loginStatus` are free-form `String` columns in schema.prisma
 * (NOT Prisma enums — not in enums.ts), so they are typed `string` here rather than a
 * hand-typed literal union. Narrow at the call site once a feature needs to branch on real values.
 */
export type MemberSelfDTO = {
  id: number;
  associationId: number;
  userId: number | null;
  memberId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  gender: string;
  dateOfBirth: IsoDateString | null;
  occupation: string | null;
  category: string;
  status: string;
  loginStatus: string;
  joinDate: IsoDateString | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelationship: string | null;
  notes: string | null;
  /** Signed links to the profile photo (full size and list thumbnail); null when the member has no photo. */
  photoUrl?: string | null;
  thumbUrl?: string | null;
  photoUpdatedAt?: IsoDateString | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

/** What the photo endpoints answer with: the member and their new links (both null after a removal). */
export type MemberPhotoDTO = { id: number; photoUrl: string | null; thumbUrl: string | null; photoUpdatedAt: IsoDateString | null };

/** A picked picture ready to upload. */
export type PhotoFile = { uri: string; name: string; type: string };
