import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePlatformRole } from '../../middleware/rbac';
import { PlatformRole } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { sendEmail } from '../../lib/email';
import { processLateFees, updateOverdueStatus } from './late-fees.cron';

const router: Router = Router();

// Apply auth middleware and require Super Admin platform role for all routes
router.use(authMiddleware, requirePlatformRole([PlatformRole.SUPER_ADMIN]));

// In-memory job execution logs (in production, this should be stored in database)
interface JobExecutionLog {
  id: number;
  jobId: string;
  jobName: string;
  status: 'success' | 'failed' | 'running';
  timestamp: string;
  duration: number;
  output?: string;
  errorMessage?: string;
}

let jobLogs: JobExecutionLog[] = [];
let logIdCounter = 1;

// Helper function to add log entry
const addJobLog = (jobId: string, jobName: string, status: 'success' | 'failed' | 'running', duration: number = 0, output?: string, errorMessage?: string) => {
  const log: JobExecutionLog = {
    id: logIdCounter++,
    jobId,
    jobName,
    status,
    timestamp: new Date().toISOString(),
    duration,
    output,
    errorMessage,
  };
  
  jobLogs.unshift(log); // Add to beginning
  
  // Keep only last 1000 logs to prevent memory issues
  if (jobLogs.length > 1000) {
    jobLogs = jobLogs.slice(0, 1000);
  }
  
  return log;
};

// Apply auth middleware and require Super Admin platform role for all routes
router.use(authMiddleware, requirePlatformRole([PlatformRole.SUPER_ADMIN]));

/**
 * Manual trigger for trial expiry check
 * For testing and admin purposes
 */
router.post('/trial-expiry', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const jobId = 'trial-expiry';
  const jobName = 'Trial Expiry Check';
  
  // Add running log
  const runningLog = addJobLog(jobId, jobName, 'running');
  
  try {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    
    // Find trials expiring soon
    const expiringTrials = await prisma.subscription.findMany({
      where: {
        status: 'TRIALING',
        trialEndsAt: {
          gte: now,
          lte: threeDaysFromNow,
        },
      },
      include: {
        association: {
          include: {
            users: {
              where: { role: 'admin' },
              take: 1,
            },
          },
        },
        plan: true,
      },
    });

    // Find expired trials
    const expiredTrials = await prisma.subscription.findMany({
      where: {
        status: 'TRIALING',
        trialEndsAt: {
          lt: now,
        },
      },
    });

    // Update expired trials
    if (expiredTrials.length > 0) {
      await prisma.subscription.updateMany({
        where: { id: { in: expiredTrials.map(s => s.id) } },
        data: { status: 'EXPIRED' },
      });
    }

    const duration = (Date.now() - startTime) / 1000;
    const result = {
      expiringSoon: expiringTrials.length,
      expired: expiredTrials.length,
    };

    // Update log to success
    runningLog.status = 'success';
    runningLog.duration = duration;
    runningLog.output = JSON.stringify(result, null, 2);

    return res.status(200).json({
      success: true,
      message: 'Trial expiry check completed',
      data: result,
    });
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    console.error('Error in trial expiry check:', error);
    
    // Update log to failed
    runningLog.status = 'failed';
    runningLog.duration = duration;
    runningLog.errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return res.status(500).json({
      success: false,
      message: 'Failed to check trial expiry',
    });
  }
});

/**
 * Manual trigger for renewal reminders
 */
router.post('/renewal-reminders', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const jobId = 'renewal-reminders';
  const jobName = 'Renewal Reminders';
  
  // Add running log
  const runningLog = addJobLog(jobId, jobName, 'running');
  
  try {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    // Find subscriptions expiring soon
    const expiringSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        currentPeriodEnd: {
          gte: now,
          lte: sevenDaysFromNow,
        },
      },
      include: {
        association: {
          include: {
            users: {
              where: { role: 'admin' },
              take: 1,
            },
          },
        },
        plan: true,
      },
    });

    // Find expired subscriptions
    const expiredSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        currentPeriodEnd: {
          lt: now,
        },
      },
    });

    // Update expired subscriptions
    if (expiredSubscriptions.length > 0) {
      await prisma.subscription.updateMany({
        where: { id: { in: expiredSubscriptions.map(s => s.id) } },
        data: { status: 'EXPIRED' },
      });
    }

    const duration = (Date.now() - startTime) / 1000;
    const result = {
      expiringSoon: expiringSubscriptions.length,
      expired: expiredSubscriptions.length,
    };

    // Update log to success
    runningLog.status = 'success';
    runningLog.duration = duration;
    runningLog.output = JSON.stringify(result, null, 2);

    return res.status(200).json({
      success: true,
      message: 'Renewal check completed',
      data: result,
    });
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    console.error('Error in renewal check:', error);
    
    // Update log to failed
    runningLog.status = 'failed';
    runningLog.duration = duration;
    runningLog.errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return res.status(500).json({
      success: false,
      message: 'Failed to check renewals',
    });
  }
});

/**
 * Get cron job status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    // Get subscription statistics
    const stats = await prisma.subscription.groupBy({
      by: ['status'],
      _count: true,
    });

    const statusCounts = stats.reduce((acc, item) => {
      acc[item.status] = item._count;
      return acc;
    }, {} as Record<string, number>);

    return res.status(200).json({
      success: true,
      data: {
        jobsRunning: true,
        subscriptionStats: statusCounts,
        lastChecked: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching cron status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch status',
    });
  }
});

/**
 * Manual trigger for late fees processing
 * For testing and admin purposes
 */
router.post('/late-fees', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const jobId = 'late-fees';
  const jobName = 'Late Fees Processing';
  
  // Add running log
  const runningLog = addJobLog(jobId, jobName, 'running');
  
  try {
    const result = await processLateFees();

    const duration = (Date.now() - startTime) / 1000;

    // Update log to success
    runningLog.status = 'success';
    runningLog.duration = duration;
    runningLog.output = JSON.stringify(result, null, 2);

    return res.status(200).json({
      success: true,
      message: 'Late fees processing completed',
      data: result,
    });
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    console.error('Error processing late fees:', error);
    
    // Update log to failed
    runningLog.status = 'failed';
    runningLog.duration = duration;
    runningLog.errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return res.status(500).json({
      success: false,
      message: 'Failed to process late fees',
    });
  }
});

/**
 * Manual trigger for overdue status update
 */
router.post('/update-overdue', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const jobId = 'update-overdue';
  const jobName = 'Update Overdue Status';
  
  // Add running log
  const runningLog = addJobLog(jobId, jobName, 'running');
  
  try {
    const result = await updateOverdueStatus();

    const duration = (Date.now() - startTime) / 1000;

    // Update log to success
    runningLog.status = 'success';
    runningLog.duration = duration;
    runningLog.output = JSON.stringify(result, null, 2);

    return res.status(200).json({
      success: true,
      message: 'Overdue status update completed',
      data: result,
    });
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    console.error('Error updating overdue status:', error);
    
    // Update log to failed
    runningLog.status = 'failed';
    runningLog.duration = duration;
    runningLog.errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return res.status(500).json({
      success: false,
      message: 'Failed to update overdue status',
    });
  }
});

/**
 * Get job execution logs with filtering and pagination
 */
router.get('/logs', async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      jobId,
      status,
      startDate,
      endDate,
    } = req.query;

    let filteredLogs = [...jobLogs];

    // Apply filters
    if (jobId && typeof jobId === 'string') {
      filteredLogs = filteredLogs.filter(log => log.jobId === jobId);
    }

    if (status && typeof status === 'string') {
      filteredLogs = filteredLogs.filter(log => log.status === status);
    }

    if (startDate && typeof startDate === 'string') {
      const start = new Date(startDate);
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= start);
    }

    if (endDate && typeof endDate === 'string') {
      const end = new Date(endDate);
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) <= end);
    }

    // Pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;

    const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

    return res.status(200).json({
      success: true,
      data: {
        logs: paginatedLogs,
        total: filteredLogs.length,
        page: pageNum,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error('Error fetching cron logs:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch logs',
    });
  }
});

/**
 * Get single job execution log by ID
 */
router.get('/logs/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const logId = parseInt(id, 10);

    const log = jobLogs.find(l => l.id === logId);

    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Log not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: log,
    });
  } catch (error) {
    console.error('Error fetching cron log:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch log',
    });
  }
});

/**
 * Get job configuration (placeholder for future implementation)
 */
router.get('/jobs/:jobId/config', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    // Default configurations for each job
    const defaultConfigs = {
      'trial-expiry': {
        jobId,
        schedule: '0 0 * * *', // Daily at midnight
        enabled: true,
        parameters: {
          daysBeforeExpiry: 3,
          notifyUsers: true,
          batchSize: 100,
        },
      },
      'renewal-reminders': {
        jobId,
        schedule: '0 9 * * *', // Daily at 9 AM
        enabled: true,
        parameters: {
          daysBeforeRenewal: 7,
          reminderCount: 3,
          batchSize: 50,
        },
      },
      'late-fees': {
        jobId,
        schedule: '0 1 * * *', // Daily at 1 AM
        enabled: true,
        parameters: {
          gracePeriodDays: 5,
          feePercentage: 10,
          maxFeeAmount: 1000,
        },
      },
      'update-overdue': {
        jobId,
        schedule: '0 */6 * * *', // Every 6 hours
        enabled: true,
        parameters: {
          overdueDays: 30,
          batchSize: 200,
        },
      },
    };

    const config = defaultConfigs[jobId as keyof typeof defaultConfigs];

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Job configuration not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Error fetching job config:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch job configuration',
    });
  }
});

/**
 * Update job configuration (placeholder for future implementation)
 */
router.put('/jobs/:jobId/config', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const config = req.body;

    // In a real implementation, this would save to database
    console.log(`Updating config for job ${jobId}:`, config);

    return res.status(200).json({
      success: true,
      message: 'Job configuration updated successfully',
    });
  } catch (error) {
    console.error('Error updating job config:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update job configuration',
    });
  }
});

/**
 * Enable/disable job (placeholder for future implementation)
 */
router.patch('/jobs/:jobId/toggle', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const { enabled } = req.body;

    // In a real implementation, this would update the job scheduler
    console.log(`${enabled ? 'Enabling' : 'Disabling'} job ${jobId}`);

    return res.status(200).json({
      success: true,
      message: `Job ${enabled ? 'enabled' : 'disabled'} successfully`,
    });
  } catch (error) {
    console.error('Error toggling job:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to toggle job',
    });
  }
});

export default router;
