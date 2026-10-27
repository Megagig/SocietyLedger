/**
 * When a request is refused because of who the person is or what their association has paid for (not because something broke), the
 * apps say so plainly and the same way everywhere, instead of a generic "couldn't load this" or the server's raw wording.
 *
 * One place for two decisions, used by the API clients on web and mobile:
 *   1. is this refusal an access problem at all, and which kind, and
 *   2. what do we tell the person.
 *
 * Only refusals with a known code count. A 403 that carries its own meaning ("This is your own loan", "Only the officer who recorded this
 * can change it") is a business rule with its own good message and is left exactly as the server wrote it.
 *
 * No prices and no purchase wording: the mobile apps may not sell subscriptions, so the copy always points to an administrator and the website.
 */

export type AccessProblemKind =
  | 'permission' // their role does not include this
  | 'plan' // the module or feature is not part of their association's plan
  | 'subscription' // the association's trial or subscription has ended
  | 'suspended' // the association's account is paused
  | 'cancelled' // the association's account is closed
  | 'limit' // the plan's member limit is reached
  | 'association'; // they are signed in to a different association

/** The modules a plan can include, by the code the API uses, in plain words. */
const MODULE_NAMES: Record<string, string> = {
  members: 'Member management',
  ledger: 'The financial ledger',
  payments: 'Payment processing',
  notifications: 'Notifications',
  reports: 'Reports',
  audit: 'The audit trail',
  welfare: 'Welfare funds',
  voting: 'Voting and elections',
  meetings: 'Meetings',
  sms: 'SMS messaging',
  accounting: 'Accounting',
  cooperatives: 'Cooperatives and loans',
  ai: 'The AI assistant',
};

export function moduleDisplayName(code?: string | null): string | undefined {
  if (!code) return undefined;
  return MODULE_NAMES[code.toLowerCase()];
}

export interface AccessErrorInput {
  status?: number | null;
  /** The error's `code` field. */
  code?: string | null;
  /** Older refusals put the same tag in an `error` field (module and feature checks). */
  error?: string | null;
  /** The server's own words, only used to recognise the two generic permission messages that predate error codes. */
  message?: string | null;
}

const BY_TAG: Record<string, AccessProblemKind> = {
  MODULE_DISABLED: 'plan',
  FEATURE_DISABLED: 'plan',
  MODULES_DISABLED: 'plan',
  NO_MODULE_AVAILABLE: 'plan',
  INSUFFICIENT_PERMISSIONS: 'permission',
  SUBSCRIPTION_INACTIVE: 'subscription',
  ASSOCIATION_SUSPENDED: 'suspended',
  ASSOCIATION_CANCELLED: 'cancelled',
  MEMBER_LIMIT_REACHED: 'limit',
  TENANT_MISMATCH: 'association',
};

const GENERIC_PERMISSION_MESSAGES = new Set(['permission denied', 'insufficient permissions', 'access denied']);

export function classifyAccessError(input: AccessErrorInput): AccessProblemKind | null {
  for (const tag of [input.code, input.error]) {
    const kind = tag ? BY_TAG[tag.toUpperCase()] : undefined;
    if (kind) return kind;
  }
  // The few permission checks written before error codes existed answer a bare 403 with one of these stock sentences.
  if (input.status === 403 && !input.code && !input.error && input.message && GENERIC_PERMISSION_MESSAGES.has(input.message.trim().toLowerCase())) {
    return 'permission';
  }
  return null;
}

export interface AccessCopy {
  /** The heading of a full state. */
  title: string;
  /** One or two plain sentences under it. */
  description: string;
  /** One sentence, for a toast or an inline message. */
  short: string;
}

export function accessCopy(kind: AccessProblemKind, options: { moduleName?: string | null; surface?: 'app' | 'web' } = {}): AccessCopy {
  // The mobile app never sells or renews a plan, so it points to the website; on the website the page is right there.
  const subscriptionPage = options.surface === 'web' ? 'the Subscription page' : 'the Subscription page on the website';
  switch (kind) {
    case 'plan': {
      const name = options.moduleName?.trim() || 'This feature';
      return {
        title: `${name} isn't part of your association's plan`,
        description: `Your association's administrator can add it from ${subscriptionPage}.`,
        short: `${name} isn't part of your association's plan. Ask your administrator to add it.`,
      };
    }
    case 'subscription':
      return {
        title: "Your association's subscription has ended",
        description: `An administrator can renew it from ${subscriptionPage}. Until then, access is paused.`,
        short: "Your association's subscription has ended. Ask your administrator to renew it.",
      };
    case 'suspended':
      return {
        title: 'This association is currently unavailable',
        description: 'Its account has been paused. Please contact SocietyLedger support.',
        short: 'This association is currently unavailable. Please contact SocietyLedger support.',
      };
    case 'cancelled':
      return {
        title: "This association's account has been closed",
        description: 'Please contact SocietyLedger support if you think this is a mistake.',
        short: "This association's account has been closed. Please contact SocietyLedger support.",
      };
    case 'limit':
      return {
        title: 'Member limit reached',
        description: `Your plan has reached its member limit. An administrator can raise it from ${subscriptionPage}.`,
        short: 'Your plan has reached its member limit. Ask your administrator to raise it.',
      };
    case 'association':
      return {
        title: "This isn't your association",
        description: "You're signed in to a different association. Switch association and try again.",
        short: "You're signed in to a different association. Switch association and try again.",
      };
    case 'permission':
    default:
      return {
        title: "You don't have access to this",
        description: "Your role doesn't include this part of SocietyLedger. If you need it, ask your association administrator.",
        short: "You don't have permission to do this. Ask your association administrator if you need access.",
      };
  }
}
