import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { sendEmail } from '../lib/email';

/**
 * Cron Jobs for Meeting Management
 * 
 * Handles:
 * - Meeting reminder notifications (24 hours before)
 * - In-app notifications for meeting events
 * - Email notifications via Resend
 */

/**
 * Create in-app notifications for all active members of an association
 */
async function createMeetingNotifications(
  associationId: number,
  title: string,
  message: string,
  type: 'system' | 'announcement' = 'system'
) {
  try {
    // Get all active users in the association
    const users = await prisma.user.findMany({
      where: { associationId, isActive: true },
      select: { id: true },
    });

    if (users.length === 0) return 0;

    // Create notifications for all users
    const result = await prisma.notification.createMany({
      data: users.map(user => ({
        associationId,
        userId: user.id,
        title,
        message,
        type,
      })),
    });

    return result.count;
  } catch (error) {
    console.error('[MEETING-JOBS] Error creating notifications:', error);
    return 0;
  }
}

/**
 * Send meeting reminder emails to all active members
 */
async function sendMeetingReminderEmails(
  associationId: number,
  meeting: {
    id: number;
    title: string;
    startTime: Date;
    location: string | null;
    virtualLink: string | null;
    meetingType: string;
  },
  associationName: string
) {
  try {
    // Get all active users with emails
    const users = await prisma.user.findMany({
      where: { associationId, isActive: true, email: { not: '' } },
      select: { id: true, email: true },
    });

    let emailsSent = 0;

    for (const user of users) {
      if (user.email) {
        try {
          await sendEmail({
            to: user.email,
            subject: `📅 Meeting Reminder: ${meeting.title} - Tomorrow`,
            template: 'meeting-reminder',
            data: {
              associationName,
              meetingTitle: meeting.title,
              meetingDate: meeting.startTime.toLocaleDateString('en-NG', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              }),
              meetingTime: meeting.startTime.toLocaleTimeString('en-NG', {
                hour: '2-digit',
                minute: '2-digit',
              }),
              location: meeting.location || 'To be announced',
              virtualLink: meeting.virtualLink,
              meetingType: meeting.meetingType,
            },
          });
          emailsSent++;
        } catch (emailError) {
          console.error(`[MEETING-JOBS] Failed to send reminder to ${user.email}:`, emailError);
        }
      }
    }

    return emailsSent;
  } catch (error) {
    console.error('[MEETING-JOBS] Error sending reminder emails:', error);
    return 0;
  }
}

// Check for meetings needing reminders - Runs every hour
export const checkMeetingReminders = cron.schedule('0 * * * *', async () => {
  console.log('[CRON] Running meeting reminder check...');
  
  try {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Find meetings starting in the next 24 hours that haven't had reminders sent
    const meetingsNeedingReminders = await prisma.meeting.findMany({
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

    console.log(`[CRON] Found ${meetingsNeedingReminders.length} meetings needing reminders`);

    for (const meeting of meetingsNeedingReminders) {
      try {
        const hoursUntilMeeting = Math.round(
          (meeting.startTime.getTime() - now.getTime()) / (1000 * 60 * 60)
        );

        // Create in-app notifications
        const notificationTitle = `📅 Meeting Reminder: ${meeting.title}`;
        const notificationMessage = `Reminder: "${meeting.title}" is scheduled for ${meeting.startTime.toLocaleDateString('en-NG', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        })} at ${meeting.startTime.toLocaleTimeString('en-NG', {
          hour: '2-digit',
          minute: '2-digit',
        })}. ${meeting.location ? `Location: ${meeting.location}` : ''}`;

        const notificationsCreated = await createMeetingNotifications(
          meeting.associationId,
          notificationTitle,
          notificationMessage,
          'announcement'
        );

        // Send email reminders
        const emailsSent = await sendMeetingReminderEmails(
          meeting.associationId,
          {
            id: meeting.id,
            title: meeting.title,
            startTime: meeting.startTime,
            location: meeting.location,
            virtualLink: meeting.virtualLink,
            meetingType: meeting.meetingType,
          },
          meeting.association.name
        );

        // Mark reminder as sent
        await prisma.meeting.update({
          where: { id: meeting.id },
          data: { reminderSent: true },
        });

        console.log(
          `[CRON] Sent reminders for meeting "${meeting.title}" (ID: ${meeting.id}): ` +
          `${notificationsCreated} notifications, ${emailsSent} emails`
        );
      } catch (meetingError) {
        console.error(`[CRON] Error processing meeting ${meeting.id}:`, meetingError);
      }
    }

    console.log(`[CRON] Meeting reminder check complete. Processed: ${meetingsNeedingReminders.length}`);
  } catch (error) {
    console.error('[CRON] Error checking meeting reminders:', error);
  }
});

/**
 * Send notification when a meeting is scheduled
 */
export async function notifyMeetingScheduled(
  associationId: number,
  meeting: {
    id: number;
    title: string;
    startTime: Date;
    location: string | null;
    virtualLink: string | null;
    meetingType: string;
  }
) {
  try {
    const association = await prisma.association.findUnique({
      where: { id: associationId },
      select: { name: true },
    });

    const notificationTitle = `📅 New Meeting Scheduled: ${meeting.title}`;
    const notificationMessage = `A new ${meeting.meetingType.toLowerCase()} meeting "${meeting.title}" has been scheduled for ${meeting.startTime.toLocaleDateString('en-NG', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })} at ${meeting.startTime.toLocaleTimeString('en-NG', {
      hour: '2-digit',
      minute: '2-digit',
    })}. ${meeting.location ? `Location: ${meeting.location}` : ''}`;

    const notificationsCreated = await createMeetingNotifications(
      associationId,
      notificationTitle,
      notificationMessage,
      'announcement'
    );

    console.log(`[MEETING-JOBS] Meeting scheduled notification sent: ${notificationsCreated} users`);
    return notificationsCreated;
  } catch (error) {
    console.error('[MEETING-JOBS] Error sending meeting scheduled notification:', error);
    return 0;
  }
}

/**
 * Send notification when a meeting is cancelled
 */
export async function notifyMeetingCancelled(
  associationId: number,
  meeting: {
    id: number;
    title: string;
    startTime: Date;
    cancellationReason: string | null;
  }
) {
  try {
    const association = await prisma.association.findUnique({
      where: { id: associationId },
      select: { name: true },
    });

    const notificationTitle = `❌ Meeting Cancelled: ${meeting.title}`;
    const notificationMessage = `The meeting "${meeting.title}" scheduled for ${meeting.startTime.toLocaleDateString('en-NG', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    })} has been cancelled.${meeting.cancellationReason ? ` Reason: ${meeting.cancellationReason}` : ''}`;

    // Create in-app notifications
    const notificationsCreated = await createMeetingNotifications(
      associationId,
      notificationTitle,
      notificationMessage,
      'announcement'
    );

    // Send cancellation emails
    const users = await prisma.user.findMany({
      where: { associationId, isActive: true, email: { not: '' } },
      select: { email: true },
    });

    let emailsSent = 0;
    for (const user of users) {
      if (user.email) {
        try {
          await sendEmail({
            to: user.email,
            subject: `❌ Meeting Cancelled: ${meeting.title}`,
            template: 'meeting-cancelled',
            data: {
              associationName: association?.name || 'Your Association',
              meetingTitle: meeting.title,
              meetingDate: meeting.startTime.toLocaleDateString('en-NG', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              }),
              cancellationReason: meeting.cancellationReason || 'No reason provided',
            },
          });
          emailsSent++;
        } catch (emailError) {
          console.error(`[MEETING-JOBS] Failed to send cancellation email:`, emailError);
        }
      }
    }

    console.log(`[MEETING-JOBS] Meeting cancelled notification sent: ${notificationsCreated} notifications, ${emailsSent} emails`);
    return { notificationsCreated, emailsSent };
  } catch (error) {
    console.error('[MEETING-JOBS] Error sending meeting cancelled notification:', error);
    return { notificationsCreated: 0, emailsSent: 0 };
  }
}

/**
 * Send notification when attendance is marked
 */
export async function notifyAttendanceMarked(
  userId: number,
  associationId: number,
  meeting: {
    id: number;
    title: string;
  },
  status: string
) {
  try {
    const statusText = status === 'PRESENT' ? 'present' : 
                       status === 'ABSENT' ? 'absent' :
                       status === 'LATE' ? 'late' :
                       status === 'APOLOGY' ? 'excused (apology)' : status.toLowerCase();

    await prisma.notification.create({
      data: {
        associationId,
        userId,
        title: `✅ Attendance Recorded`,
        message: `Your attendance for "${meeting.title}" has been marked as ${statusText}.`,
        type: 'system',
      },
    });

    console.log(`[MEETING-JOBS] Attendance notification sent to user ${userId}`);
    return true;
  } catch (error) {
    console.error('[MEETING-JOBS] Error sending attendance notification:', error);
    return false;
  }
}

// Start all meeting cron jobs
export function startMeetingJobs() {
  console.log('Starting meeting cron jobs...');
  checkMeetingReminders.start();
  console.log('✓ Meeting reminder job started (runs every hour)');
}

// Stop all meeting cron jobs (for graceful shutdown)
export function stopMeetingJobs() {
  console.log('Stopping meeting cron jobs...');
  checkMeetingReminders.stop();
  console.log('✓ Meeting cron jobs stopped');
}
