import { z } from 'zod';

import type { MeetingType } from '@/types/api/enums';
import type { AgendaItemPayload, MeetingFormPayload, MinutesPayload } from '@/types/api/meetingsManage';
import type { MeetingBaseDTO } from '@/types/api/meetings';

const LINK = /^https?:\/\/\S+$/i;

export const meetingFormSchema = z
  .object({
    title: z.string().trim().min(2, 'Give the meeting a title').max(200, 'Keep the title under 200 characters'),
    meetingType: z.string().min(1, 'Choose the kind of meeting'),
    startTime: z.string().min(1, 'Choose when it starts'),
    endTime: z.string(),
    location: z.string().trim().max(500, 'Keep the venue under 500 characters'),
    virtualLink: z.string().trim().refine((v) => v === '' || LINK.test(v), 'Enter a full link, starting with https://'),
    quorumRequired: z.string().trim().refine((v) => v === '' || /^\d+$/.test(v) && Number(v) > 0, 'Enter a whole number above 0, or leave it empty'),
    description: z.string().trim().max(2000, 'Keep the description under 2000 characters'),
  })
  .superRefine((v, ctx) => {
    if (v.endTime && v.startTime && new Date(v.endTime) <= new Date(v.startTime)) {
      ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'The end time must be after the start time' });
    }
  });

export type MeetingFormValues = z.infer<typeof meetingFormSchema>;

/** A new meeting starts tomorrow at 6pm, a common time for an association meeting — easy to change, never blank. */
export function emptyMeetingValues(now: Date = new Date()): MeetingFormValues {
  const start = new Date(now);
  start.setDate(start.getDate() + 1);
  start.setHours(18, 0, 0, 0);
  return { title: '', meetingType: 'REGULAR', startTime: start.toISOString(), endTime: '', location: '', virtualLink: '', quorumRequired: '', description: '' };
}

export function meetingToFormValues(meeting: MeetingBaseDTO): MeetingFormValues {
  return {
    title: meeting.title,
    meetingType: meeting.meetingType,
    startTime: meeting.startTime,
    endTime: meeting.endTime ?? '',
    location: meeting.location ?? '',
    virtualLink: meeting.virtualLink ?? '',
    quorumRequired: meeting.quorumRequired ? String(meeting.quorumRequired) : '',
    description: meeting.description ?? '',
  };
}

/** The API body: blanks become null so a cleared field is actually cleared. */
export function toMeetingPayload(values: MeetingFormValues): MeetingFormPayload {
  return {
    title: values.title.trim(),
    meetingType: values.meetingType as MeetingType,
    startTime: new Date(values.startTime).toISOString(),
    endTime: values.endTime ? new Date(values.endTime).toISOString() : null,
    location: values.location.trim() || null,
    virtualLink: values.virtualLink.trim() || null,
    quorumRequired: values.quorumRequired ? Number(values.quorumRequired) : null,
    description: values.description.trim() || null,
  };
}

// ---------------------------------------------------------------- agenda

export const agendaFormSchema = z.object({
  title: z.string().trim().min(1, 'Give the item a title').max(200, 'Keep the title under 200 characters'),
  presenter: z.string().trim().max(120, 'Keep the name under 120 characters'),
  duration: z.string().trim().refine((v) => v === '' || /^\d+$/.test(v) && Number(v) > 0, 'Enter minutes as a whole number, or leave it empty'),
  description: z.string().trim().max(1000, 'Keep the notes under 1000 characters'),
});

export type AgendaFormValues = z.infer<typeof agendaFormSchema>;

export const emptyAgendaValues = (): AgendaFormValues => ({ title: '', presenter: '', duration: '', description: '' });

export function toAgendaPayload(values: AgendaFormValues, orderNumber: number): AgendaItemPayload {
  return {
    orderNumber,
    title: values.title.trim(),
    presenter: values.presenter.trim() || null,
    duration: values.duration ? Number(values.duration) : null,
    description: values.description.trim() || null,
  };
}

/** Move one item up or down and return the whole agenda's new order (1, 2, 3…), or null when it can't move that way. */
export function reorderedAgenda(items: { id: number }[], id: number, direction: 'up' | 'down'): { id: number; orderNumber: number }[] | null {
  const index = items.findIndex((item) => item.id === id);
  const target = direction === 'up' ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= items.length) return null;
  const next = items.map((item) => item.id);
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next.map((itemId, i) => ({ id: itemId, orderNumber: i + 1 }));
}

// ---------------------------------------------------------------- minutes

export const minutesFormSchema = z.object({
  content: z.string().trim().min(10, 'Write what was discussed (at least a sentence)').max(20000, 'Keep the minutes under 20,000 characters'),
  decisions: z.string().trim().max(5000, 'Keep the decisions under 5000 characters'),
  actionItems: z.string().trim().max(5000, 'Keep the action items under 5000 characters'),
});

export type MinutesFormValues = z.infer<typeof minutesFormSchema>;

export const toMinutesPayload = (values: MinutesFormValues): MinutesPayload => ({
  content: values.content.trim(),
  decisions: values.decisions.trim() || null,
  actionItems: values.actionItems.trim() || null,
});
