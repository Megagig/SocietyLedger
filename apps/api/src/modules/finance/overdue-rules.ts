/**
 * "Overdue" means: still owed (unpaid or part paid), not voided, and past its due date. It is decided from the date, not from the
 * stored status — the status is only changed when the overdue job or an officer runs it, so a charge could be days late and still
 * be stored as "pending". Using the date keeps every officer screen right without waiting for that job.
 */
export const OPEN_STATUSES = ['pending', 'partial', 'overdue'] as const;

/** A Prisma `where` fragment for charges that are overdue as of `now`. */
export function overdueWhere(now: Date = new Date()) {
  return { isVoided: false, status: { in: [...OPEN_STATUSES] }, dueDate: { lt: now } };
}

/** Whether one already-loaded charge is overdue as of `now`. */
export function isOverdue(charge: { isVoided?: boolean; status: string; dueDate: Date | null }, now: Date = new Date()): boolean {
  if (charge.isVoided) return false;
  if (!(OPEN_STATUSES as readonly string[]).includes(charge.status)) return false;
  return charge.dueDate !== null && charge.dueDate.getTime() < now.getTime();
}
