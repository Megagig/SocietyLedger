export type DatePart = 'date' | 'time';

/** Merges a picked date or time into an existing value, so changing the day keeps the time of day and the other way round. */
export function mergeDateTime(current: Date | undefined, picked: Date, part: DatePart): Date {
  const next = current ? new Date(current) : new Date();
  if (part === 'date') next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
  else next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
  return next;
}
