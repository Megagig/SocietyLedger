import { z } from 'zod';

// Meeting type enum
const meetingTypeEnum = z.enum(['REGULAR', 'EMERGENCY', 'AGM', 'EGM', 'COMMITTEE', 'SPECIAL']);

// Meeting status enum
const meetingStatusEnum = z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'POSTPONED']);

// Attendance status enum
const attendanceStatusEnum = z.enum(['PENDING', 'PRESENT', 'ABSENT', 'APOLOGY', 'LATE']);

// Agenda item schema
const agendaItemSchema = z.object({
  orderNumber: z.number().int().positive(),
  title: z.string().min(1, 'Agenda item title is required'),
  description: z.string().optional().nullable(),
  duration: z.number().int().positive().optional().nullable(),
  presenter: z.string().optional().nullable(),
});

// Create meeting schema
export const createMeetingSchema = z.object({
  title: z.string().min(1, 'Meeting title is required').max(200),
  description: z.string().max(2000).optional().nullable(),
  meetingType: meetingTypeEnum.default('REGULAR'),
  location: z.string().max(500).optional().nullable(),
  virtualLink: z.string().url('Invalid virtual meeting link').optional().nullable(),
  startTime: z.string().datetime('Invalid start time'),
  endTime: z.string().datetime('Invalid end time').optional().nullable(),
  quorumRequired: z.number().int().positive().optional().nullable(),
  agendaItems: z.array(agendaItemSchema).optional(),
}).refine((m) => !m.endTime || new Date(m.endTime) > new Date(m.startTime), { message: 'The end time must be after the start time', path: ['endTime'] });

// Update meeting schema
export const updateMeetingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  meetingType: meetingTypeEnum.optional(),
  location: z.string().max(500).optional().nullable(),
  virtualLink: z.string().url('Invalid virtual meeting link').optional().nullable(),
  startTime: z.string().datetime('Invalid start time').optional(),
  endTime: z.string().datetime('Invalid end time').optional().nullable(),
  status: meetingStatusEnum.optional(),
  quorumRequired: z.number().int().positive().optional().nullable(),
}).refine((m) => !m.startTime || !m.endTime || new Date(m.endTime) > new Date(m.startTime), { message: 'The end time must be after the start time', path: ['endTime'] });

// Cancel meeting schema
export const cancelMeetingSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required').max(500),
});

// Create/update agenda item schema
export const createAgendaItemSchema = agendaItemSchema;

export const updateAgendaItemSchema = z.object({
  orderNumber: z.number().int().positive().optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  duration: z.number().int().positive().optional().nullable(),
  presenter: z.string().optional().nullable(),
});

// Mark attendance schema
export const markAttendanceSchema = z.object({
  memberId: z.number().int().positive(),
  status: attendanceStatusEnum,
  checkInTime: z.string().datetime().optional().nullable(),
  checkOutTime: z.string().datetime().optional().nullable(),
  apologyReason: z.string().max(500).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

// Bulk mark attendance schema
export const bulkMarkAttendanceSchema = z.object({
  attendances: z.array(markAttendanceSchema).min(1, 'At least one attendance record is required'),
});

// Create minutes schema
export const createMinutesSchema = z.object({
  content: z.string().min(1, 'Minutes content is required'),
  decisions: z.string().optional().nullable(),
  actionItems: z.string().optional().nullable(),
  nextMeetingDate: z.string().datetime().optional().nullable(),
});

// Update minutes schema
export const updateMinutesSchema = z.object({
  content: z.string().min(1).optional(),
  decisions: z.string().optional().nullable(),
  actionItems: z.string().optional().nullable(),
  nextMeetingDate: z.string().datetime().optional().nullable(),
});

// Query params schema
export const meetingQuerySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('10'),
  status: meetingStatusEnum.optional(),
  meetingType: meetingTypeEnum.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['startTime', 'createdAt', 'title']).optional().default('startTime'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});
