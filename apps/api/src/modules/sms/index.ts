/**
 * SMS Module
 * Phase 6.5: SMS & Bulk Communication
 * 
 * Provides SMS functionality using Termii API:
 * - Quick SMS sending
 * - Bulk SMS campaigns
 * - SMS templates
 * - Credit management
 * - Message tracking
 */

export { SMSService } from './sms.service';
export { smsController } from './sms.controller';
export { default as smsRoutes } from './sms.routes';
export * from './sms.types';
export * from './sms.validation';
