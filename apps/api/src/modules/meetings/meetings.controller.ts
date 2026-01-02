import { Request, Response } from 'express';
import { z } from 'zod';
import { meetingsService } from './meetings.service';
import {
  createMeetingSchema,
  updateMeetingSchema,
  cancelMeetingSchema,
  createAgendaItemSchema,
  updateAgendaItemSchema,
  markAttendanceSchema,
  bulkMarkAttendanceSchema,
  createMinutesSchema,
  updateMinutesSchema,
  meetingQuerySchema,
} from './meetings.validation';
import { prisma } from '../../lib/prisma';
import { notifyMeetingScheduled, notifyMeetingCancelled, notifyAttendanceMarked } from '../../jobs/meeting-jobs';

export const meetingsController = {
  // ==================== MEETING CRUD ====================

  async createMeeting(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID and User ID are required',
        });
      }

      const validatedData = createMeetingSchema.parse(req.body);

      const meeting = await meetingsService.createMeeting(
        associationId,
        userId,
        {
          ...validatedData,
          startTime: new Date(validatedData.startTime),
          endTime: validatedData.endTime ? new Date(validatedData.endTime) : undefined,
        }
      );

      // Create audit log
      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'CREATE',
          tableName: 'meetings',
          recordId: meeting.id,
          newValues: meeting,
        },
      });

      // Send notifications to all members about the new meeting
      notifyMeetingScheduled(associationId, {
        id: meeting.id,
        title: meeting.title,
        startTime: meeting.startTime,
        location: meeting.location,
        virtualLink: meeting.virtualLink,
        meetingType: meeting.meetingType,
      }).catch(err => console.error('Failed to send meeting scheduled notification:', err));

      return res.status(201).json({
        success: true,
        message: 'Meeting created successfully',
        data: meeting,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }
      console.error('Error creating meeting:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create meeting',
      });
    }
  },

  async getMeetings(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID is required',
        });
      }

      const queryParams = meetingQuerySchema.parse(req.query);
      const result = await meetingsService.getMeetings(associationId, {
        page: parseInt(queryParams.page),
        limit: parseInt(queryParams.limit),
        status: queryParams.status,
        meetingType: queryParams.meetingType,
        startDate: queryParams.startDate ? new Date(queryParams.startDate) : undefined,
        endDate: queryParams.endDate ? new Date(queryParams.endDate) : undefined,
        search: queryParams.search,
        sortBy: queryParams.sortBy,
        sortOrder: queryParams.sortOrder,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }
      console.error('Error fetching meetings:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch meetings',
      });
    }
  },

  async getMeetingById(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const meetingId = parseInt(req.params.id);

      if (!associationId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID is required',
        });
      }

      const meeting = await meetingsService.getMeetingById(associationId, meetingId);

      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found',
        });
      }

      // Get attendance stats
      const attendanceStats = await meetingsService.getAttendanceStats(meetingId);

      return res.status(200).json({
        success: true,
        data: { ...meeting, attendanceStats },
      });
    } catch (error) {
      console.error('Error fetching meeting:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch meeting',
      });
    }
  },

  async updateMeeting(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      const meetingId = parseInt(req.params.id);

      if (!associationId || !userId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID and User ID are required',
        });
      }

      const validatedData = updateMeetingSchema.parse(req.body);

      const existingMeeting = await meetingsService.getMeetingById(associationId, meetingId);
      if (!existingMeeting) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found',
        });
      }

      const meeting = await meetingsService.updateMeeting(associationId, meetingId, validatedData);

      // Create audit log
      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'UPDATE',
          tableName: 'meetings',
          recordId: meetingId,
          oldValues: existingMeeting,
          newValues: meeting || undefined,
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Meeting updated successfully',
        data: meeting,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }
      console.error('Error updating meeting:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update meeting',
      });
    }
  },

  async cancelMeeting(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      const meetingId = parseInt(req.params.id);

      if (!associationId || !userId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID and User ID are required',
        });
      }

      const { reason } = cancelMeetingSchema.parse(req.body);

      const meeting = await meetingsService.cancelMeeting(
        associationId,
        meetingId,
        userId,
        reason
      );

      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found',
        });
      }

      // Create audit log
      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'CANCEL',
          tableName: 'meetings',
          recordId: meetingId,
          newValues: { status: 'CANCELLED', reason },
        },
      });

      // Send cancellation notifications to all members
      notifyMeetingCancelled(associationId, {
        id: meeting.id,
        title: meeting.title,
        startTime: meeting.startTime,
        cancellationReason: meeting.cancellationReason,
      }).catch(err => console.error('Failed to send meeting cancelled notification:', err));

      return res.status(200).json({
        success: true,
        message: 'Meeting cancelled successfully',
        data: meeting,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }
      console.error('Error cancelling meeting:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to cancel meeting',
      });
    }
  },

  async deleteMeeting(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      const meetingId = parseInt(req.params.id);

      if (!associationId || !userId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID and User ID are required',
        });
      }

      const meeting = await meetingsService.deleteMeeting(associationId, meetingId);

      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found',
        });
      }

      // Create audit log
      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'DELETE',
          tableName: 'meetings',
          recordId: meetingId,
          oldValues: meeting,
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Meeting deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting meeting:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete meeting',
      });
    }
  },


  // ==================== AGENDA ITEMS ====================

  async addAgendaItem(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const meetingId = parseInt(req.params.id);

      if (!associationId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID is required',
        });
      }

      // Verify meeting exists
      const meeting = await meetingsService.getMeetingById(associationId, meetingId);
      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found',
        });
      }

      const validatedData = createAgendaItemSchema.parse(req.body);
      const agendaItem = await meetingsService.addAgendaItem(meetingId, validatedData);

      return res.status(201).json({
        success: true,
        message: 'Agenda item added successfully',
        data: agendaItem,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }
      console.error('Error adding agenda item:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to add agenda item',
      });
    }
  },

  async updateAgendaItem(req: Request, res: Response) {
    try {
      const agendaId = parseInt(req.params.agendaId);

      const validatedData = updateAgendaItemSchema.parse(req.body);
      const agendaItem = await meetingsService.updateAgendaItem(agendaId, validatedData);

      return res.status(200).json({
        success: true,
        message: 'Agenda item updated successfully',
        data: agendaItem,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }
      console.error('Error updating agenda item:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update agenda item',
      });
    }
  },

  async deleteAgendaItem(req: Request, res: Response) {
    try {
      const agendaId = parseInt(req.params.agendaId);

      await meetingsService.deleteAgendaItem(agendaId);

      return res.status(200).json({
        success: true,
        message: 'Agenda item deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting agenda item:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete agenda item',
      });
    }
  },

  // ==================== ATTENDANCE ====================

  async initializeAttendance(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const meetingId = parseInt(req.params.id);

      if (!associationId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID is required',
        });
      }

      // Verify meeting exists
      const meeting = await meetingsService.getMeetingById(associationId, meetingId);
      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found',
        });
      }

      const result = await meetingsService.initializeAttendance(associationId, meetingId);

      return res.status(200).json({
        success: true,
        message: `Attendance initialized for ${result.created} members`,
        data: result,
      });
    } catch (error) {
      console.error('Error initializing attendance:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to initialize attendance',
      });
    }
  },

  async markAttendance(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      const meetingId = parseInt(req.params.id);

      if (!associationId || !userId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID and User ID are required',
        });
      }

      // Verify meeting exists
      const meeting = await meetingsService.getMeetingById(associationId, meetingId);
      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found',
        });
      }

      const validatedData = markAttendanceSchema.parse(req.body);
      const attendance = await meetingsService.markAttendance(meetingId, userId, validatedData);

      // Get member's user ID to send notification
      const member = await prisma.member.findUnique({
        where: { id: validatedData.memberId },
        select: { userId: true },
      });

      if (member?.userId) {
        notifyAttendanceMarked(
          member.userId,
          associationId,
          { id: meetingId, title: meeting.title },
          validatedData.status
        ).catch(err => console.error('Failed to send attendance notification:', err));
      }

      return res.status(200).json({
        success: true,
        message: 'Attendance marked successfully',
        data: attendance,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }
      console.error('Error marking attendance:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to mark attendance',
      });
    }
  },

  async bulkMarkAttendance(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      const meetingId = parseInt(req.params.id);

      if (!associationId || !userId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID and User ID are required',
        });
      }

      // Verify meeting exists
      const meeting = await meetingsService.getMeetingById(associationId, meetingId);
      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found',
        });
      }

      const { attendances } = bulkMarkAttendanceSchema.parse(req.body);
      const results = await meetingsService.bulkMarkAttendance(meetingId, userId, attendances);

      return res.status(200).json({
        success: true,
        message: `Attendance marked for ${results.length} members`,
        data: results,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }
      console.error('Error bulk marking attendance:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to mark attendance',
      });
    }
  },

  async getAttendance(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const meetingId = parseInt(req.params.id);

      if (!associationId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID is required',
        });
      }

      // Verify meeting exists
      const meeting = await meetingsService.getMeetingById(associationId, meetingId);
      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found',
        });
      }

      const [attendance, stats] = await Promise.all([
        meetingsService.getMeetingAttendance(meetingId),
        meetingsService.getAttendanceStats(meetingId),
      ]);

      return res.status(200).json({
        success: true,
        data: { attendance, stats },
      });
    } catch (error) {
      console.error('Error fetching attendance:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch attendance',
      });
    }
  },


  // ==================== MINUTES ====================

  async createMinutes(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      const meetingId = parseInt(req.params.id);

      if (!associationId || !userId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID and User ID are required',
        });
      }

      // Verify meeting exists
      const meeting = await meetingsService.getMeetingById(associationId, meetingId);
      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found',
        });
      }

      // Check if minutes already exist
      const existingMinutes = await meetingsService.getMinutes(meetingId);
      if (existingMinutes) {
        return res.status(400).json({
          success: false,
          message: 'Minutes already exist for this meeting. Use update instead.',
        });
      }

      const validatedData = createMinutesSchema.parse(req.body);
      const minutes = await meetingsService.createMinutes(meetingId, userId, validatedData);

      return res.status(201).json({
        success: true,
        message: 'Minutes created successfully',
        data: minutes,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }
      console.error('Error creating minutes:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create minutes',
      });
    }
  },

  async updateMinutes(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const meetingId = parseInt(req.params.id);

      if (!associationId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID is required',
        });
      }

      // Verify meeting exists
      const meeting = await meetingsService.getMeetingById(associationId, meetingId);
      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found',
        });
      }

      // Get existing minutes
      const existingMinutes = await meetingsService.getMinutes(meetingId);
      if (!existingMinutes) {
        return res.status(404).json({
          success: false,
          message: 'Minutes not found for this meeting',
        });
      }

      const validatedData = updateMinutesSchema.parse(req.body);
      const minutes = await meetingsService.updateMinutes(existingMinutes.id, validatedData);

      return res.status(200).json({
        success: true,
        message: 'Minutes updated successfully',
        data: minutes,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }
      console.error('Error updating minutes:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update minutes',
      });
    }
  },

  async approveMinutes(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      const meetingId = parseInt(req.params.id);

      if (!associationId || !userId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID and User ID are required',
        });
      }

      // Verify meeting exists
      const meeting = await meetingsService.getMeetingById(associationId, meetingId);
      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found',
        });
      }

      // Get existing minutes
      const existingMinutes = await meetingsService.getMinutes(meetingId);
      if (!existingMinutes) {
        return res.status(404).json({
          success: false,
          message: 'Minutes not found for this meeting',
        });
      }

      if (existingMinutes.approvedAt) {
        return res.status(400).json({
          success: false,
          message: 'Minutes have already been approved',
        });
      }

      const minutes = await meetingsService.approveMinutes(existingMinutes.id, userId);

      return res.status(200).json({
        success: true,
        message: 'Minutes approved successfully',
        data: minutes,
      });
    } catch (error) {
      console.error('Error approving minutes:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to approve minutes',
      });
    }
  },

  async getMinutes(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const meetingId = parseInt(req.params.id);

      if (!associationId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID is required',
        });
      }

      // Verify meeting exists
      const meeting = await meetingsService.getMeetingById(associationId, meetingId);
      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found',
        });
      }

      const minutes = await meetingsService.getMinutes(meetingId);

      return res.status(200).json({
        success: true,
        data: minutes,
      });
    } catch (error) {
      console.error('Error fetching minutes:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch minutes',
      });
    }
  },

  // ==================== ANALYTICS & DASHBOARD ====================

  async getStats(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID is required',
        });
      }

      const stats = await meetingsService.getMeetingStats(associationId);

      return res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('Error fetching meeting stats:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch meeting statistics',
      });
    }
  },

  async getUpcoming(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const limit = parseInt(req.query.limit as string) || 5;
      console.log('🔍 [Meetings] getUpcoming - req.user:', req.user);
      console.log('🔍 [Meetings] getUpcoming - associationId:', associationId);
      console.log('🔍 [Meetings] getUpcoming - tenantId:', (req as any).tenantId);
      if (!associationId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID is required',
        });
      }

      const meetings = await meetingsService.getUpcomingMeetings(associationId, limit);

      return res.status(200).json({
        success: true,
        data: meetings,
      });
    } catch (error) {
      console.error('Error fetching upcoming meetings:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch upcoming meetings',
      });
    }
  },

  async getRecent(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const limit = parseInt(req.query.limit as string) || 5;

      if (!associationId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID is required',
        });
      }

      const meetings = await meetingsService.getRecentMeetings(associationId, limit);

      return res.status(200).json({
        success: true,
        data: meetings,
      });
    } catch (error) {
      console.error('Error fetching recent meetings:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch recent meetings',
      });
    }
  },

  async getMemberAttendanceHistory(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const memberId = req.query.memberId ? parseInt(req.query.memberId as string) : undefined;

      if (!associationId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID is required',
        });
      }

      const history = await meetingsService.getMemberAttendanceHistory(associationId, memberId);

      return res.status(200).json({
        success: true,
        data: history,
      });
    } catch (error) {
      console.error('Error fetching attendance history:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch attendance history',
      });
    }
  },
};
