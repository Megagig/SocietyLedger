/** Association settings (project-overview.md §6.9 ST1–ST6, ST10). Shapes verified against settings.service.ts and settings.schema.ts. */
import type { AssociationTypeKey } from '@societyledger/shared';

// The same list signup and the web use (packages/shared/src/association-signup.ts), so the three never drift apart.
export type AssociationType = AssociationTypeKey;
export type PaymentChannel = 'bank_transfer' | 'cash' | 'card' | 'mobile_money' | 'cheque';
export type DefaultRole = 'member' | 'financial_secretary' | 'treasurer';
export type LateFeeType = 'fixed' | 'percentage';
export type ReminderFrequency = 'daily' | 'weekly' | 'monthly' | 'none';

/** GET /settings/association/profile — a field never filled in is missing or null. */
export type AssociationProfileDTO = {
  name: string;
  logo?: string | null;
  primaryColor?: string | null;
  associationType?: AssociationType;
  /** What they call it themselves, when the type is "other". */
  customAssociationType?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
};

export type AssociationProfilePayload = {
  name: string;
  primaryColor: string | null;
  associationType: AssociationType;
  customAssociationType: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
};

/** GET /settings/financial — only the settings something actually reads. */
export type FinancialSettingsDTO = {
  enableLateFees: boolean;
  lateFeeType: LateFeeType;
  lateFeeAmount: number;
  defaultGracePeriodDays: number;
  enablePartialPayments: boolean;
  /** Spending above this needs its receipt attached; at or below it a reason is enough. */
  receiptRequiredAbove: number;
};

export type PaymentsSettingsDTO = {
  enabledChannels: PaymentChannel[];
  enablePartialPayments: boolean;
  receiptAutoGenerate: boolean;
  cashLodgmentDueDays: number;
};

export type NotificationsSettingsDTO = {
  emailEnabled: boolean;
  paymentReminderDays: number[];
  overdueReminderFrequency: ReminderFrequency;
  senderName: string;
};

export type MembersAccessSettingsDTO = {
  selfSignupEnabled: boolean;
  defaultRole: DefaultRole;
  inviteExpiryHours: number;
  allowMultipleRoles: boolean;
  memberIdAutoGenerate: boolean;
  memberIdPrefix?: string | null;
};

/** GET /settings/integrations — public identifiers only; secret keys are never stored here. */
export type IntegrationsSettingsDTO = {
  paystackEnabled: boolean;
  nombaEnabled: boolean;
  smsProvider: 'termii' | 'none';
};

export type SubscriptionStatus = 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';

/** GET /subscriptions/current (needs settings.view or settings.billing) — the plan's price and payment history are left unread on purpose. */
export type SubscriptionDTO = {
  status: SubscriptionStatus;
  billingCycle: 'MONTHLY' | 'ANNUAL';
  trialEndsAt: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  renewalDate: string | null;
  cancelAtPeriodEnd: boolean;
  plan: { name: string; memberLimit: number | null };
  pendingPlan: { name: string } | null;
};

/** GET /modules/mine */
export type ModuleStatusDTO = { code: string; name: string; isEnabled: boolean };
export type MyModulesDTO = { modules: ModuleStatusDTO[] };
