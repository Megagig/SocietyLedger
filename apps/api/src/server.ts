import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { tenantMiddleware } from './middleware/tenant.middleware';
import { contextMiddleware } from './middleware/context.middleware';
import { startSubscriptionJobs, stopSubscriptionJobs } from './jobs/subscription-jobs';
import { startMeetingJobs, stopMeetingJobs } from './jobs/meeting-jobs';
import { startPaymentReminderJobs, stopPaymentReminderJobs } from './jobs/payment-reminder-jobs';
import { startPushReceiptsJob, stopPushReceiptsJob } from './services/push.service';
// Phase 12: Caching & Performance
import { initializeRedis, closeRedisConnection } from './lib/redis';
import { ensureBucketExists } from './lib/storage';
import { standardRateLimit, authRateLimit, sessionRateLimit } from './middleware/rate-limit.middleware';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './modules/auth/auth.routes';
import associationRoutes from './modules/associations/associations.routes';
import adminRoutes from './modules/admin/admin.routes';
import subscriptionRoutes from './modules/subscription/subscription.routes';
import webhookHandlerRoutes from './modules/webhooks/webhooks.routes';
import webhookManagementRoutes from './modules/webhooks/webhooks-management.routes';
import memberRoutes from './modules/members/members.routes';
import financeRoutes from './modules/finance/finance.routes';
import cronRoutes from './modules/cron/cron.routes';
import paymentRoutes from './modules/payments/payments.routes';
import onboardingRoutes from './modules/onboarding/onboarding.routes';
import notificationsRoutes from './modules/notifications/notifications.routes';
import devicesRoutes from './modules/devices/devices.routes';
import mobileReturnRoutes from './modules/payments/mobile-return.routes';
import memberInviteRoutes from './modules/member-invites/member-invites.routes';
import reportsRoutes from './modules/reports/reports.routes';
import exportsRoutes from './modules/exports/exports.routes';
import advancedFinanceRoutes from './modules/finance/advanced/advanced.routes';
import accountingRoutes from './modules/accounting/accounting.routes';
import nigerianPaymentsRoutes from './modules/nigerian-payments/nigerian-payments.routes';
import cooperativesRoutes from './modules/cooperatives/cooperatives.routes';
import memberFinanceRoutes from './modules/member-finance/member-finance.routes';
import memberLedgerRoutes from './modules/member-finance/member-ledger.routes';
import meetingsRoutes from './modules/meetings/meetings.routes';
import welfareRoutes from './modules/welfare/welfare.routes';
import smsRoutes from './modules/sms/sms.routes';
import aiRoutes from './modules/ai/ai.routes';
import votingRoutes from './modules/voting/voting.routes';
import rbacRoutes from './modules/rbac/rbac.routes';
import settingsRoutes from './modules/settings/settings.routes';
import modulesRoutes from './modules/modules/modules.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import helpRoutes from './modules/help/help.routes';
import aiHelpRoutes from './modules/help/ai-help.routes';
import supportRoutes from './modules/support/support.routes';
import platformSupportRoutes from './modules/support/support-platform.routes';
import blogPublicRoutes from './modules/blog/blog-public.routes';
import blogAdminRoutes from './modules/blog/blog-admin.routes';
import documentationPublicRoutes from './modules/documentation/documentation-public.routes';
import documentationAdminRoutes from './modules/documentation/documentation-admin.routes';
import adminAuthRoutes from './modules/admin/admin-auth.routes';

const app: Express = express();
const PORT = process.env.PORT || 4000;

// Security middleware
app.use(helmet());

// CORS configuration - Allow subdomains for multi-tenancy
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) {
      return callback(null, true);
    }

    // List of allowed origins
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3002', // Admin console (dev)
      'https://www.societyledger.com.ng', // Main production frontend
      'https://societyledger.com.ng', // Production frontend without www
      'https://admin.societyledger.com.ng', // Admin console (production) — B8 explicit entry
      'https://admin-staging.societyledger.com.ng', // Admin console (staging) — B8 explicit entry
      process.env.FRONTEND_URL,
      process.env.ADMIN_URL,
    ].filter(Boolean);

    // Allow any subdomain of localhost:3000 (e.g., demo.localhost:3000)
    const localhostPattern = /^http:\/\/([a-z0-9-]+\.)?localhost:3000$/i;

    // DEV-ONLY: also allow any subdomain on any localhost port, so a second
    // local web instance on a non-default port (e.g. a separate docs
    // verification stack) still works with tenant subdomains. Never runs
    // outside development.
    const devLocalhostAnyPortPattern = /^http:\/\/([a-z0-9-]+\.)?localhost:\d+$/i;

    // Allow any subdomain of production domain (e.g., opuogunstate.societyledger.com.ng)
    // This pattern now also matches www.societyledger.com.ng
    const productionPattern = /^https:\/\/(www\.)?([a-z0-9-]+\.)?societyledger\.com\.ng$/i;

    // Check if origin is in allowed list or matches subdomain pattern
    if (
      allowedOrigins.includes(origin) ||
      localhostPattern.test(origin) ||
      (process.env.NODE_ENV === 'development' && devLocalhostAnyPortPattern.test(origin)) ||
      productionPattern.test(origin)
    ) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true, // CRITICAL: Enable credentials (cookies, authorization headers)
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant', 'X-Tenant-Id', 'X-Association-Id'],
  exposedHeaders: ['Set-Cookie'],
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 200, // Some legacy browsers choke on 204
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files from uploads directory with CORS headers
const uploadsPath = path.join(process.cwd(), 'uploads');
app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(uploadsPath));

// Webhook handler routes (must be before tenantMiddleware for raw body access)
app.use('/api/webhooks', webhookHandlerRoutes);

// Webhooks management routes (for admin UI)
app.use('/api/webhooks', webhookManagementRoutes);

// Cron routes (Super Admin only, must be before tenantMiddleware)
app.use('/api/cron', cronRoutes);
app.use('/api/admin/cron', cronRoutes); // alias for admin console BFF

// Blog & Documentation routes (Platform-level, must be before tenantMiddleware)
// Public routes - no auth required
app.use('/api/blog', blogPublicRoutes);
app.use('/api/docs', documentationPublicRoutes);
// Admin routes - Super Admin only
app.use('/api/admin/blog', blogAdminRoutes);
app.use('/api/admin/docs', documentationAdminRoutes);
app.use('/api/admin/documentation', documentationAdminRoutes); // alias for admin console BFF
// Tier 2 support tickets — SUPPORT_AGENT as well as SUPER_ADMIN, so it must be mounted before the SUPER_ADMIN-only /api/admin router
app.use('/api/admin/support', platformSupportRoutes);

// Platform auth routes — must be before tenantMiddleware (no tenant context needed)
app.use('/api/admin/auth', adminAuthRoutes);

// F0.4 — mobile Paystack return bridge, must be before tenantMiddleware (public, no tenant context)
app.use('/api/payments/mobile-return', mobileReturnRoutes);

// Tenant middleware for all other routes
app.use(tenantMiddleware);

// Phase 22: Context middleware for Hybrid Super Admin Architecture
// Must be after tenant middleware, attaches execution context to requests
app.use(contextMiddleware);

// Logging middleware
app.use(morgan('dev'));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    message: 'SocietyLedger API is running',
    timestamp: new Date().toISOString()
  });
});

// Phase 12: Apply rate limiting to API routes
// Session check endpoints (high frequency) - 200 req/min
app.use('/api/auth/me', sessionRateLimit);
app.use('/api/auth/refresh', sessionRateLimit); // F0.3
// Sensitive auth endpoints (login, register, password reset) - 10 req/min
app.use('/api/auth/login', authRateLimit);
app.use('/api/auth/register', authRateLimit);
app.use('/api/admin/auth/login', authRateLimit);
app.use('/api/auth/forgot-password', authRateLimit);
app.use('/api/auth/reset-password', authRateLimit);
// Standard rate limit for all other API routes - 100 req/min
app.use('/api', standardRateLimit);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/associations', associationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
// IMPORTANT: /api/members/me must come BEFORE /api/members to avoid /:id matching 'me'
app.use('/api/members/me', memberFinanceRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/devices', devicesRoutes);
app.use('/api/member-invites', memberInviteRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/exports', exportsRoutes);
app.use('/api/finance/advanced', advancedFinanceRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/payments/nigerian', nigerianPaymentsRoutes);
app.use('/api/cooperatives', cooperativesRoutes);
app.use('/api/member-ledger', memberLedgerRoutes);
app.use('/api/meetings', meetingsRoutes);
app.use('/api/welfare', welfareRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/voting', votingRoutes);
app.use('/api/rbac', rbacRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/modules', modulesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/help', helpRoutes);
app.use('/api/help/ai', aiHelpRoutes);
app.use('/api/support', supportRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.url} not found`,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// Start server unless running under test
if (process.env.NODE_ENV !== 'test') {
  // Phase 12: Initialize Redis before starting server
  initializeRedis()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`🚀 SocietyLedger API Server running on http://localhost:${PORT}`);
        console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
        
        // Ensure MinIO bucket exists (no-op if already created)
        ensureBucketExists().catch((err) => console.warn('[storage] MinIO bucket init failed:', err));

        // Start cron jobs
        startSubscriptionJobs();
        startMeetingJobs();
        startPaymentReminderJobs();
        startPushReceiptsJob();
      });
    })
    .catch((err) => {
      console.error('Failed to initialize Redis:', err);
      // Start server anyway - Redis is optional
      app.listen(PORT, () => {
        console.log(`🚀 SocietyLedger API Server running on http://localhost:${PORT} (without Redis)`);
      });
    });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    stopSubscriptionJobs();
    stopMeetingJobs();
    stopPaymentReminderJobs();
    stopPushReceiptsJob();
    await closeRedisConnection();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully...');
    stopSubscriptionJobs();
    stopMeetingJobs();
    stopPaymentReminderJobs();
    stopPushReceiptsJob();
    await closeRedisConnection();
    process.exit(0);
  });
}

export default app;
