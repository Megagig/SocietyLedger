/** A charge that was reminded within this many hours is skipped, so tapping Send twice (or two officers doing it) doesn't spam a member. */
export const REMINDER_COOLDOWN_HOURS = 24;

export function wasRemindedRecently(lastReminderSentAt: Date | null | undefined, now: Date = new Date(), hours: number = REMINDER_COOLDOWN_HOURS): boolean {
  if (!lastReminderSentAt) return false;
  return now.getTime() - lastReminderSentAt.getTime() < hours * 3_600_000;
}

/** Splits charges into those that can be reminded now and those reminded too recently. */
export function splitByCooldown<T extends { lastReminderSentAt?: Date | null }>(charges: T[], now: Date = new Date()): { fresh: T[]; recent: T[] } {
  const fresh: T[] = [];
  const recent: T[] = [];
  for (const charge of charges) (wasRemindedRecently(charge.lastReminderSentAt, now) ? recent : fresh).push(charge);
  return { fresh, recent };
}

/** The in-app / push text for one member: what they owe, in a line they can act on. */
export function reminderText(args: { count: number; total: number; overdue: boolean; associationName?: string | null; custom?: string | null }): { title: string; message: string } {
  const amount = args.total.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const things = args.count === 1 ? '1 payment' : `${args.count} payments`;
  const base = args.overdue ? `You have ${things} overdue, ₦${amount} in total.` : `You have ${things} waiting, ₦${amount} in total.`;
  const message = args.custom?.trim() ? `${base} ${args.custom.trim()}` : `${base} Please pay when you can.`;
  return { title: args.overdue ? 'Payment overdue' : 'Payment reminder', message };
}
