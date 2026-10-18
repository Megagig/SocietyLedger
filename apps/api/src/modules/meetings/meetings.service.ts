import { prisma } from '../../lib/prisma';
import { Prisma } from '@prisma/client';
import {
  CreateMeetingInput,
  UpdateMeetingInput,
  MarkAttendanceInput,
  CreateMinutesInput,
  UpdateMinutesInput,
  MeetingQueryParams,
  AttendanceStats,
  MemberAttendanceHistory,
  CreateAgendaItemInput,
  UpdateAgendaItemInput,
} from './meetings.types';

export const meetingsService = {
  // ==================== MEETING CRUD ====================

  async createMeeting(
    associationId: number,
    userId: number,
    data: CreateMeetingInput
  ) {
    const { agendaItems, ...meetingData } = data;

    const meeting = await prisma.meeting.create({
      data: {
        associationId,
        createdBy: userId,
        title: meetingData.title,
        description: meetingData.description,
        meetingType: meetingData.meetingType || 'REGULAR',
        location: meetingData.location,
        virtualLink: meetingData.virtualLink,
        startTime: new Date(meetingData.startTime),
        endTime: meetingData.endTime ? new Date(meetingData.endTime) : null,
        quorumRequired: meetingData.quorumRequired,
        agendaItems: agendaItems?.length
          ? {
              create: agendaItems.map((item) => ({
                orderNumber: item.orderNumber,
                title: item.title,
                description: item.description,
                duration: item.duration,
                presenter: item.presenter,
              })),
            }
          : undefined,
      },
      include: {
        agendaItems: { orderBy: { orderNumber: 'asc' } },
        creator: { select: { id: true, email: true } },
      },
    });

    return meeting;
  },

  async getMeetings(associationId: number, params: MeetingQueryParams) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.MeetingWhereInput = { associationId };

    if (params.status) {
      where.status = params.status;
    }

    if (params.meetingType) {
      where.meetingType = params.meetingType;
    }

    if (params.startDate || params.endDate) {
      where.startTime = {};
      if (params.startDate) {
        where.startTime.gte = new Date(params.startDate);
      }
      if (params.endDate) {
        where.startTime.lte = new Date(params.endDate);
      }
    }

    if (params.search) {
      where.OR = [
        { title: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
        { location: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [meetings, totalCount] = await Promise.all([
      prisma.meeting.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [params.sortBy || 'startTime']: params.sortOrder || 'desc' },
        include: {
          creator: { select: { id: true, email: true } },
          agendaItems: { orderBy: { orderNumber: 'asc' } },
          _count: { select: { attendances: true } },
        },
      }),
      prisma.meeting.count({ where }),
    ]);

    return {
      meetings,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + meetings.length < totalCount,
      },
    };
  },

  async getMeetingById(associationId: number, meetingId: number) {
    return prisma.meeting.findFirst({
      where: { id: meetingId, associationId },
      include: {
        creator: { select: { id: true, email: true } },
        canceller: { select: { id: true, email: true } },
        agendaItems: { orderBy: { orderNumber: 'asc' } },
        attendances: {
          include: {
            member: { select: { id: true, firstName: true, lastName: true, memberId: true } },
            marker: { select: { id: true, email: true } },
          },
        },
        minutes: {
          include: {
            recorder: { select: { id: true, email: true } },
            approver: { select: { id: true, email: true } },
          },
        },
      },
    });
  },

  async updateMeeting(
    associationId: number,
    meetingId: number,
    data: UpdateMeetingInput
  ) {
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, associationId },
    });

    if (!meeting) {
      return null;
    }

    return prisma.meeting.update({
      where: { id: meetingId },
      data: {
        title: data.title,
        description: data.description,
        meetingType: data.meetingType,
        location: data.location,
        virtualLink: data.virtualLink,
        startTime: data.startTime ? new Date(data.startTime) : undefined,
        endTime: data.endTime ? new Date(data.endTime) : undefined,
        status: data.status,
        quorumRequired: data.quorumRequired,
      },
      include: {
        agendaItems: { orderBy: { orderNumber: 'asc' } },
        creator: { select: { id: true, email: true } },
      },
    });
  },

  async cancelMeeting(
    associationId: number,
    meetingId: number,
    userId: number,
    reason: string
  ) {
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, associationId },
    });

    if (!meeting) {
      return null;
    }

    return prisma.meeting.update({
      where: { id: meetingId },
      data: {
        status: 'CANCELLED',
        cancelledBy: userId,
        cancelledAt: new Date(),
        cancellationReason: reason,
      },
      include: {
        creator: { select: { id: true, email: true } },
        canceller: { select: { id: true, email: true } },
      },
    });
  },

  async deleteMeeting(associationId: number, meetingId: number) {
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, associationId },
    });

    if (!meeting) {
      return null;
    }

    await prisma.meeting.delete({ where: { id: meetingId } });
    return meeting;
  },


  // ==================== AGENDA ITEMS ====================

  // G77 (found at R2.4, 2026-10-15): none of this module's agenda/attendance
  // methods verified associationId at all — any authenticated officer could
  // read/write ANY association's meeting sub-resources by guessing/iterating
  // meetingId/agendaId, a cross-tenant gap in the same class as G25/G26.
  // Fixed here for agenda items (what R2.4 builds UI for); markAttendance/
  // bulkMarkAttendance/getAttendanceStats/getMeetingAttendance still need the
  // same fix — see G77's full note in progress-tracker.md.
  async assertMeetingInAssociation(associationId: number, meetingId: number) {
    const meeting = await prisma.meeting.findFirst({ where: { id: meetingId, associationId } });
    if (!meeting) {
      throw new Error('Meeting not found');
    }
  },

  async addAgendaItem(associationId: number, meetingId: number, data: CreateAgendaItemInput) {
    await this.assertMeetingInAssociation(associationId, meetingId);
    return prisma.meetingAgenda.create({
      data: {
        meetingId,
        orderNumber: data.orderNumber,
        title: data.title,
        description: data.description,
        duration: data.duration,
        presenter: data.presenter,
      },
    });
  },

  async updateAgendaItem(associationId: number, meetingId: number, agendaId: number, data: UpdateAgendaItemInput) {
    await this.assertMeetingInAssociation(associationId, meetingId);
    const agendaItem = await prisma.meetingAgenda.findFirst({ where: { id: agendaId, meetingId } });
    if (!agendaItem) {
      throw new Error('Agenda item not found');
    }
    return prisma.meetingAgenda.update({
      where: { id: agendaId },
      data: {
        orderNumber: data.orderNumber,
        title: data.title,
        description: data.description,
        duration: data.duration,
        presenter: data.presenter,
      },
    });
  },

  async deleteAgendaItem(associationId: number, meetingId: number, agendaId: number) {
    await this.assertMeetingInAssociation(associationId, meetingId);
    const agendaItem = await prisma.meetingAgenda.findFirst({ where: { id: agendaId, meetingId } });
    if (!agendaItem) {
      throw new Error('Agenda item not found');
    }
    return prisma.meetingAgenda.delete({ where: { id: agendaId } });
  },

  async reorderAgendaItems(associationId: number, meetingId: number, items: { id: number; orderNumber: number }[]) {
    await this.assertMeetingInAssociation(associationId, meetingId);
    const ids = items.map((i) => i.id);
    const owned = await prisma.meetingAgenda.findMany({ where: { id: { in: ids }, meetingId } });
    if (owned.length !== ids.length) {
      throw new Error('One or more agenda items not found on this meeting');
    }
    const updates = items.map((item) =>
      prisma.meetingAgenda.update({
        where: { id: item.id },
        data: { orderNumber: item.orderNumber },
      })
    );
    return prisma.$transaction(updates);
  },

  // ==================== ATTENDANCE ====================

  async initializeAttendance(associationId: number, meetingId: number) {
    await this.assertMeetingInAssociation(associationId, meetingId);

    // Get all active members
    const members = await prisma.member.findMany({
      where: { associationId, status: 'active' },
      select: { id: true },
    });

    // Create attendance records for all members
    const attendanceRecords = members.map((member) => ({
      meetingId,
      memberId: member.id,
      status: 'PENDING' as const,
    }));

    await prisma.meetingAttendance.createMany({
      data: attendanceRecords,
      skipDuplicates: true,
    });

    return { created: attendanceRecords.length };
  },

  async markAttendance(
    associationId: number,
    meetingId: number,
    userId: number,
    data: MarkAttendanceInput
  ) {
    await this.assertMeetingInAssociation(associationId, meetingId);
    return prisma.meetingAttendance.upsert({
      where: {
        meetingId_memberId: {
          meetingId,
          memberId: data.memberId,
        },
      },
      create: {
        meetingId,
        memberId: data.memberId,
        status: data.status,
        checkInTime: data.checkInTime ? new Date(data.checkInTime) : null,
        checkOutTime: data.checkOutTime ? new Date(data.checkOutTime) : null,
        apologyReason: data.apologyReason,
        notes: data.notes,
        markedBy: userId,
        markedAt: new Date(),
      },
      update: {
        status: data.status,
        checkInTime: data.checkInTime ? new Date(data.checkInTime) : undefined,
        checkOutTime: data.checkOutTime ? new Date(data.checkOutTime) : undefined,
        apologyReason: data.apologyReason,
        notes: data.notes,
        markedBy: userId,
        markedAt: new Date(),
      },
      include: {
        member: { select: { id: true, firstName: true, lastName: true, memberId: true } },
      },
    });
  },

  async bulkMarkAttendance(
    associationId: number,
    meetingId: number,
    userId: number,
    attendances: MarkAttendanceInput[]
  ) {
    await this.assertMeetingInAssociation(associationId, meetingId);
    const results = await Promise.all(
      attendances.map((attendance) =>
        this.markAttendance(associationId, meetingId, userId, attendance)
      )
    );
    return results;
  },

  async getAttendanceStats(associationId: number, meetingId: number): Promise<AttendanceStats> {
    await this.assertMeetingInAssociation(associationId, meetingId);
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { quorumRequired: true },
    });

    const attendances = await prisma.meetingAttendance.groupBy({
      by: ['status'],
      where: { meetingId },
      _count: { id: true },
    });

    const stats: AttendanceStats = {
      totalMembers: 0,
      present: 0,
      absent: 0,
      apology: 0,
      late: 0,
      pending: 0,
      quorumMet: false,
    };

    attendances.forEach((a) => {
      const count = a._count.id;
      stats.totalMembers += count;
      switch (a.status) {
        case 'PRESENT':
          stats.present = count;
          break;
        case 'ABSENT':
          stats.absent = count;
          break;
        case 'APOLOGY':
          stats.apology = count;
          break;
        case 'LATE':
          stats.late = count;
          break;
        case 'PENDING':
          stats.pending = count;
          break;
      }
    });

    // Late counts as present for quorum
    const actualAttendees = stats.present + stats.late;
    stats.quorumMet = meeting?.quorumRequired
      ? actualAttendees >= meeting.quorumRequired
      : true;

    return stats;
  },

  async getMeetingAttendance(associationId: number, meetingId: number) {
    await this.assertMeetingInAssociation(associationId, meetingId);
    return prisma.meetingAttendance.findMany({
      where: { meetingId },
      include: {
        member: { select: { id: true, firstName: true, lastName: true, memberId: true, email: true } },
        marker: { select: { id: true, email: true } },
      },
      orderBy: { member: { lastName: 'asc' } },
    });
  },


  // ==================== MINUTES ====================

  async createMinutes(
    meetingId: number,
    userId: number,
    data: CreateMinutesInput
  ) {
    return prisma.meetingMinutes.create({
      data: {
        meetingId,
        recordedBy: userId,
        content: data.content,
        decisions: data.decisions,
        actionItems: data.actionItems,
        nextMeetingDate: data.nextMeetingDate ? new Date(data.nextMeetingDate) : null,
      },
      include: {
        recorder: { select: { id: true, email: true } },
      },
    });
  },

  async updateMinutes(minutesId: number, data: UpdateMinutesInput) {
    return prisma.meetingMinutes.update({
      where: { id: minutesId },
      data: {
        content: data.content,
        decisions: data.decisions,
        actionItems: data.actionItems,
        nextMeetingDate: data.nextMeetingDate ? new Date(data.nextMeetingDate) : undefined,
      },
      include: {
        recorder: { select: { id: true, email: true } },
        approver: { select: { id: true, email: true } },
      },
    });
  },

  async approveMinutes(minutesId: number, userId: number) {
    return prisma.meetingMinutes.update({
      where: { id: minutesId },
      data: {
        approvedBy: userId,
        approvedAt: new Date(),
      },
      include: {
        recorder: { select: { id: true, email: true } },
        approver: { select: { id: true, email: true } },
      },
    });
  },

  async getMinutes(meetingId: number) {
    return prisma.meetingMinutes.findUnique({
      where: { meetingId },
      include: {
        recorder: { select: { id: true, email: true } },
        approver: { select: { id: true, email: true } },
        meeting: { select: { id: true, title: true, startTime: true } },
      },
    });
  },

  // ==================== ANALYTICS ====================

  async getMemberAttendanceHistory(
    associationId: number,
    memberId?: number
  ): Promise<MemberAttendanceHistory[]> {
    const where: Prisma.MeetingAttendanceWhereInput = {
      meeting: { associationId },
    };

    if (memberId) {
      where.memberId = memberId;
    }

    const attendances = await prisma.meetingAttendance.findMany({
      where,
      include: {
        member: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Group by member
    const memberStats = new Map<number, MemberAttendanceHistory>();

    attendances.forEach((a) => {
      const existing = memberStats.get(a.memberId) || {
        memberId: a.memberId,
        memberName: `${a.member.firstName} ${a.member.lastName}`,
        totalMeetings: 0,
        attended: 0,
        absent: 0,
        apologies: 0,
        late: 0,
        attendanceRate: 0,
      };

      existing.totalMeetings++;
      switch (a.status) {
        case 'PRESENT':
          existing.attended++;
          break;
        case 'ABSENT':
          existing.absent++;
          break;
        case 'APOLOGY':
          existing.apologies++;
          break;
        case 'LATE':
          existing.late++;
          existing.attended++; // Late counts as attended
          break;
      }

      memberStats.set(a.memberId, existing);
    });

    // Calculate attendance rates
    const results = Array.from(memberStats.values()).map((stats) => ({
      ...stats,
      attendanceRate:
        stats.totalMeetings > 0
          ? Math.round((stats.attended / stats.totalMeetings) * 100)
          : 0,
    }));

    return results.sort((a, b) => b.attendanceRate - a.attendanceRate);
  },

  async getUpcomingMeetings(associationId: number, limit = 5) {
    return prisma.meeting.findMany({
      where: {
        associationId,
        status: 'SCHEDULED',
        startTime: { gte: new Date() },
      },
      orderBy: { startTime: 'asc' },
      take: limit,
      include: {
        creator: { select: { id: true, email: true } },
        _count: { select: { agendaItems: true } },
      },
    });
  },

  async getRecentMeetings(associationId: number, limit = 5) {
    return prisma.meeting.findMany({
      where: {
        associationId,
        status: 'COMPLETED',
      },
      orderBy: { startTime: 'desc' },
      take: limit,
      include: {
        creator: { select: { id: true, email: true } },
        _count: { select: { attendances: true } },
      },
    });
  },

  async getMeetingStats(associationId: number) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [
      totalMeetings,
      scheduledMeetings,
      completedMeetings,
      cancelledMeetings,
      meetingsThisMonth,
      meetingsThisYear,
    ] = await Promise.all([
      prisma.meeting.count({ where: { associationId } }),
      prisma.meeting.count({ where: { associationId, status: 'SCHEDULED' } }),
      prisma.meeting.count({ where: { associationId, status: 'COMPLETED' } }),
      prisma.meeting.count({ where: { associationId, status: 'CANCELLED' } }),
      prisma.meeting.count({
        where: { associationId, startTime: { gte: startOfMonth } },
      }),
      prisma.meeting.count({
        where: { associationId, startTime: { gte: startOfYear } },
      }),
    ]);

    return {
      totalMeetings,
      scheduledMeetings,
      completedMeetings,
      cancelledMeetings,
      meetingsThisMonth,
      meetingsThisYear,
    };
  },

  // ==================== MEETING REMINDERS ====================

  async getMeetingsNeedingReminders() {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    return prisma.meeting.findMany({
      where: {
        status: 'SCHEDULED',
        reminderSent: false,
        startTime: {
          gte: now,
          lte: tomorrow,
        },
      },
      include: {
        association: { select: { id: true, name: true } },
      },
    });
  },

  async markReminderSent(meetingId: number) {
    return prisma.meeting.update({
      where: { id: meetingId },
      data: { reminderSent: true },
    });
  },
};
