/**
 * Builds the statuses reference table from `schema.prisma`'s enums.
 *
 * Not every `*Status` enum belongs on a public reference page: a few are
 * platform/CMS-internal and must never appear on the tenant-facing docs
 * site (architecture.md rule #3, §9.9's "platform/Super Admin" and
 * "developer/API reference" out-of-scope items). Everything else that
 * genuinely represents a lifecycle state a tenant user encounters is
 * included — non-`Status` enums (categorisations like `AccountType` or
 * `MeetingType`) are left out entirely, not just filtered.
 */
import path from 'node:path';
import { parsePrismaEnums } from './parse-prisma-enums';

const EXCLUDED_ENUMS = new Set([
  'WebhookEventStatus', // platform ops-internal (webhook delivery retries)
  'PostStatus', // blog CMS — platform-internal, out of scope
  'CommentStatus', // blog CMS — platform-internal, out of scope
  'DocStatus', // docs CMS — platform-internal, out of scope
]);

export interface StatusGroup {
  name: string;
  values: string[];
}

export function buildStatuses(): StatusGroup[] {
  const schemaPath = path.join(__dirname, '..', '..', '..', 'api', 'prisma', 'schema.prisma');
  return parsePrismaEnums(schemaPath)
    .filter((prismaEnum) => prismaEnum.name.endsWith('Status') && !EXCLUDED_ENUMS.has(prismaEnum.name))
    .map((prismaEnum) => ({ name: prismaEnum.name, values: prismaEnum.values }));
}
