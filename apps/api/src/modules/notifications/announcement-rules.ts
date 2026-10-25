// ============================================
// ANNOUNCEMENT RULES
// Pure helpers for composing and costing an announcement, so they can be tested without a database.
// ============================================

import { RuleError } from '../finance/rule-error';
import { smsSegments, assertMessageUsable } from '../sms/sms-rules';
import type { AudienceType } from '../sms/sms-audience';

export type AnnouncementAudienceKind = 'ALL' | 'CATEGORY' | 'SELECTED';

export interface AnnouncementAudienceInput {
  audience: AnnouncementAudienceKind;
  categories?: string[];
  memberIds?: number[];
}

/** An announcement's audience is worked out by the same code as an SMS campaign's, so "who it reaches" is the same everywhere. */
export function audienceTypeFor(kind: AnnouncementAudienceKind): AudienceType {
  return kind === 'CATEGORY' ? 'MEMBER_CATEGORY' : kind === 'SELECTED' ? 'SELECTED_MEMBERS' : 'ALL_MEMBERS';
}

/** An audience that names nobody (no categories ticked, nobody picked) is a mistake, not "everyone". */
export function assertAudienceNamed(input: AnnouncementAudienceInput): void {
  if (input.audience === 'CATEGORY' && !(input.categories?.length)) throw new RuleError('Choose at least one kind of member.', 400, 'AUDIENCE_EMPTY');
  if (input.audience === 'SELECTED' && !(input.memberIds?.length)) throw new RuleError('Choose at least one member.', 400, 'AUDIENCE_EMPTY');
}

/** The text sent when the officer doesn't write a separate one: who it is from, then the announcement itself. */
export function defaultSmsText(associationName: string, title: string, message: string): string {
  return `${associationName} - ${title}: ${message}`.replace(/\s+/g, ' ').trim();
}

export interface Reach {
  members: number;
  /** Members with a login: they see it in the app feed and get a push. */
  withLogin: number;
  /** Members with no login: they are reached only by SMS or email, if those are ticked. */
  noLogin: number;
  withEmail: number;
  willText: number;
  noPhone: number;
  optedOut: number;
}

/** What an SMS announcement would cost, and whether the balance covers it. */
export function smsCost(reach: Pick<Reach, 'willText'>, smsText: string, balance: number) {
  const segments = assertMessageUsable(smsText);
  const credits = reach.willText * segments;
  return { segments, credits, balance, enough: balance + 0.0001 >= credits, shortBy: Math.max(0, Math.ceil(credits - balance)) };
}

export { smsSegments };
