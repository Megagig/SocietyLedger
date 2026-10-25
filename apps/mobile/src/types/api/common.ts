/**
 * Shared primitives for API response DTOs. Not a generic envelope/pagination wrapper —
 * api-contract.md §10 confirms the real API has 4 incompatible pagination shapes, so each
 * endpoint's file types its own response shape exactly rather than sharing one generic type.
 */

/** Money fields serialise as strings (Prisma Decimal) on some endpoints, numbers on others — see api-contract.md. Converted to Decimal via `toDecimal()` at the api/endpoints layer (F1.7), never used raw. */
export type MoneyValue = string | number;

/** ISO 8601 datetime string, kept as a string through the api/endpoints layer and formatted only in UI (architecture.md §6.4). */
export type IsoDateString = string;

/** Every failed response the client can receive (architecture.md §6.2, api-contract.md). `code` is present wherever F0.5 added one; older/unmapped failures may omit it. */
export type ApiErrorResponse = {
  success: false;
  message: string;
  code?: string;
  error?: string;
  errors?: { path: (string | number)[]; message: string }[];
};
