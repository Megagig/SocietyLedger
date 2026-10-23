/** A meeting with no end time is treated as over this long after it starts. */
export const DEFAULT_MEETING_HOURS = 3;

type Timing = { startTime: Date; endTime: Date | null };

/** When a meeting is considered over: its end time, or `DEFAULT_MEETING_HOURS` after it started when none was set. */
export function meetingEndsAt(meeting: Timing): Date {
  return meeting.endTime ?? new Date(meeting.startTime.getTime() + DEFAULT_MEETING_HOURS * 3_600_000);
}

export function hasMeetingEnded(meeting: Timing, now: Date = new Date()): boolean {
  return meetingEndsAt(meeting).getTime() < now.getTime();
}

/** Prisma `where` for scheduled / in-progress meetings that are over by `now` — what the automatic "completed" step picks up. */
export function pastMeetingsWhere(now: Date = new Date()) {
  return {
    status: { in: ['SCHEDULED', 'IN_PROGRESS'] as ('SCHEDULED' | 'IN_PROGRESS')[] },
    OR: [{ endTime: { lt: now } }, { endTime: null, startTime: { lt: new Date(now.getTime() - DEFAULT_MEETING_HOURS * 3_600_000) } }],
  };
}

export type MeetingRuleCode = 'MEETING_CANCELLED' | 'MEETING_COMPLETED' | 'ALREADY_CANCELLED' | 'USE_CANCEL';

/** Why attendance can't be taken for a meeting in this status, or null when it can. A cancelled meeting never took place. */
export function attendanceBlockedReason(status: string): string | null {
  return status === 'CANCELLED' ? 'This meeting was cancelled, so attendance can’t be taken.' : null;
}

/** Why a meeting can't be cancelled, or null when it can: a cancelled one is already done, and a completed one has been held. */
export function cancelBlockedReason(status: string): string | null {
  if (status === 'CANCELLED') return 'This meeting is already cancelled.';
  if (status === 'COMPLETED') return 'This meeting has already been held, so it can’t be cancelled.';
  return null;
}
