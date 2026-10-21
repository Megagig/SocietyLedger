import { z } from 'zod';
import { RESERVED_SUBDOMAINS } from '@societyledger/shared';

/** architecture.md §16.5 / build-plan.md F2.2's note — the Association Code screen rejects
 * reserved subdomains client-side (the server also rejects them, `409 SUBDOMAIN_RESERVED`, but
 * there's no reason to round-trip for an obviously-reserved word). */
export const associationCodeSchema = z.object({
  subdomain: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Enter at least 3 characters')
    .regex(/^[a-z0-9-]+$/, 'Use only lowercase letters, numbers and hyphens')
    .refine((value) => !(RESERVED_SUBDOMAINS as readonly string[]).includes(value), {
      message: "That address is reserved and isn't a real association.",
    }),
});

export type AssociationCodeFormValues = z.infer<typeof associationCodeSchema>;
