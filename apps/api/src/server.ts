import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { tenantMiddleware } from './middleware/tenant.middleware';
import { startSubscriptionJobs, stopSubscriptionJobs } from './jobs/subscription-jobs';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './modules/auth/auth.routes';
import associationRoutes from './modules/associations/associations.routes';
import adminRoutes from './modules/admin/admin.routes';
import subscriptionRoutes from './modules/subscription/subscription.routes';
import webhookRoutes from './modules/webhooks/webhooks.routes';
import memberRoutes from './modules/members/members.routes';
import financeRoutes from './modules/finance/finance.routes';
import cronRoutes from './modules/cron/cron.routes';
import paymentRoutes from './modules/payments/payments.routes';
import onboardingRoutes from './modules/onboarding/onboarding.routes';
import notificationsRoutes from './modules/notifications/notifications.routes';
import memberInviteRoutes from './modules/member-invites/member-invites.routes';
import reportsRoutes from './modules/reports/reports.routes';
import exportsRoutes from './modules/exports/exports.routes';
import advancedFinanceRoutes from './modules/finance/advanced/advanced.routes';
import accountingRoutes from './modules/accounting/accounting.routes';
import nigerianPaymentsRoutes from './modules/nigerian-payments/nigerian-payments.routes';
import cooperativesRoutes from './modules/cooperatives/cooperatives.routes';
import memberFinanceRoutes from './modules/member-finance/member-finance.routes';
import memberLedgerRoutes from './modules/member-finance/member-ledger.routes';

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
      process.env.FRONTEND_URL,
    ].filter(Boolean);

    // Allow any subdomain of localhost:3000 (e.g., demo.localhost:3000)
    const localhostPattern = /^http:\/\/([a-z0-9-]+\.)?localhost:3000$/i;
    
    // Check if origin is in allowed list or matches subdomain pattern
    if (allowedOrigins.includes(origin) || localhostPattern.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true, // CRITICAL: Enable credentials (cookies, authorization headers)
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant', 'X-Tenant-Id'],
  exposedHeaders: ['Set-Cookie'],
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 200, // Some legacy browsers choke on 204
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Webhook routes (must be before tenantMiddleware for raw body access)
app.use('/api/webhooks', webhookRoutes);

// Tenant middleware for all other routes
app.use(tenantMiddleware);

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

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/associations', associationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/cron', cronRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/member-invites', memberInviteRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/exports', exportsRoutes);
app.use('/api/finance/advanced', advancedFinanceRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/payments/nigerian', nigerianPaymentsRoutes);
app.use('/api/cooperatives', cooperativesRoutes);
app.use('/api/members/me', memberFinanceRoutes);
app.use('/api/member-ledger', memberLedgerRoutes);

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
  app.listen(PORT, () => {
    console.log(`🚀 SocietyLedger API Server running on http://localhost:${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
    
    // Start cron jobs
    startSubscriptionJobs();
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    stopSubscriptionJobs();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    stopSubscriptionJobs();
    process.exit(0);
  });
}

export default app;
