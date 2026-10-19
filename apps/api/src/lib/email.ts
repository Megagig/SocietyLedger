/**
 * Email Service - Production Grade
 * 
 * Handles sending transactional emails using Resend for:
 * - Trial expiry warnings
 * - Subscription renewal reminders
 * - Payment confirmations
 * - Account notifications
 */

import { Resend } from 'resend';

interface EmailOptions {
  to: string;
  subject: string;
  template: string;
  data: Record<string, any>;
  // R4.6/G53: Notification Settings' senderName was saved but never read —
  // swap in the association's chosen display name while keeping the one
  // verified sending address (Resend only requires the domain to be
  // verified, not the display name before it).
  fromName?: string;
}

// Lazy-load Resend client to ensure environment variables are loaded first
let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

// Lazy-load email configuration to ensure environment variables are available
function getEmailConfig() {
  return {
    FROM_EMAIL: process.env.EMAIL_FROM || 'SocietyLedger <admin@societyledger.com.ng>',
    REPLY_TO: process.env.EMAIL_REPLY_TO || 'admin@societyledger.com.ng',
    SUPPORT_EMAIL: process.env.EMAIL_REPLY_TO || 'admin@societyledger.com.ng',
    WEBSITE_URL: process.env.APP_URL || 'https://societyledger.com',
  };
}

/**
 * Helper function to retry operations with exponential backoff
 * Increased timeouts for slow/unstable networks
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 3000  // Increased from 2000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a network/timeout error worth retrying
      const isRetryableError = 
        error.message?.includes('fetch failed') ||
        error.message?.includes('ETIMEDOUT') ||
        error.message?.includes('ECONNRESET') ||
        error.message?.includes('ENOTFOUND') ||
        error.message?.includes('ECONNREFUSED') ||
        error.message?.includes('socket hang up') ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNRESET' ||
        error.code === 'UND_ERR_CONNECT_TIMEOUT';
      
      if (isRetryableError && attempt < maxRetries) {
        const delay = baseDelayMs * attempt;  // 3s, 6s, 9s
        console.log(`⏳ [EMAIL] Network error, retrying in ${delay/1000}s (attempt ${attempt}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError;
}

/**
 * Send email using Resend
 * Production-ready implementation with error handling, logging, and retry logic
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  const { to, subject, template, data, fromName } = options;

  try {
    // Get configuration
    const config = getEmailConfig();

    let from = config.FROM_EMAIL;
    if (fromName) {
      const addressMatch = config.FROM_EMAIL.match(/<(.+)>/);
      const address = addressMatch ? addressMatch[1] : config.FROM_EMAIL;
      from = `${fromName} <${address}>`;
    }

    // Get HTML content for template
    const htmlContent = getTemplateContent(template, data);

    // Log email attempt
    console.log(`📧 [EMAIL] Sending ${template} to ${to}`);

    // Send via Resend with retry logic for network failures
    const result = await withRetry(async () => {
      const resend = getResendClient();
      return resend.emails.send({
        from,
        to,
        subject,
        html: htmlContent,
        reply_to: config.REPLY_TO,
      });
    });

    if (result.error) {
      throw new Error(`Resend error: ${result.error.message}`);
    }

    console.log(`✅ [EMAIL] Sent successfully to ${to} (ID: ${result.data?.id})`);

    // In development, also show preview
    if (process.env.NODE_ENV === 'development') {
      console.log(`
╔════════════════════════════════════════════════════════╗
║                    EMAIL SENT                          ║
╠════════════════════════════════════════════════════════╣
║ To: ${to.padEnd(51)}║
║ Subject: ${subject.padEnd(47)}║
║ Template: ${template.padEnd(46)}║
║ Email ID: ${(result.data?.id || 'N/A').padEnd(45)}║
╚════════════════════════════════════════════════════════╝
      `);
    }
  } catch (error: any) {
    console.error(`❌ [EMAIL] Failed to send ${template} to ${to}:`, error.message || error);
    if (process.env.NODE_ENV === 'development') {
      console.error('Full error:', error);
    }
    
    // Re-throw the error so callers can handle it
    throw error;
  }
}

/**
 * Get email template HTML content
 * Professional email templates with proper styling
 */
function getTemplateContent(template: string, data: Record<string, any>): string {
  // Get config inside function to ensure environment variables are loaded
  const config = getEmailConfig();
  const { SUPPORT_EMAIL, WEBSITE_URL } = config;
  
  const baseStyle = `
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f5; }
      .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
      .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 40px 30px; text-align: center; }
      .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
      .content { padding: 40px 30px; }
      .content h2 { color: #1f2937; margin-top: 0; font-size: 24px; }
      .content p { color: #4b5563; margin: 16px 0; }
      .highlight-box { background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 24px 0; border-radius: 4px; }
      .highlight-box strong { color: #1e40af; }
      .button { display: inline-block; background: #3b82f6; color: white !important; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 24px 0; }
      .button:hover { background: #2563eb; }
      .footer { background: #f9fafb; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; }
      .footer a { color: #3b82f6; text-decoration: none; }
      .warning { color: #dc2626; font-weight: 600; }
      .success { color: #16a34a; font-weight: 600; }
    </style>
  `;

  const templates: Record<string, (data: any) => string> = {
    'trial-expiry-warning': (data) => `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8">${baseStyle}</head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Your Trial is Ending Soon</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.associationName}!</h2>
            <p>Your <strong>${data.daysLeft}-day free trial</strong> of SocietyLedger will expire in <span class="warning">${data.daysLeft} days</span>.</p>
            
            <p>To continue managing your association seamlessly, please subscribe to a plan before your trial ends.</p>
            
            <div class="highlight-box">
              <strong>Recommended Plan:</strong> ${data.planName}<br>
              <strong>Price:</strong> ₦${data.planPrice.toLocaleString()}/${data.billingCycle === 'ANNUAL' ? 'year' : 'month'}<br>
              ${data.billingCycle === 'ANNUAL' ? '<strong>Save 16.67%</strong> with annual billing!' : 'Switch to annual billing and save 16.67%!'}
            </div>
            
            <p><strong>What you'll get:</strong></p>
            <ul>
              <li>Complete member management system</li>
              <li>Financial tracking and reporting</li>
              <li>Payment collection via Paystack</li>
              <li>Automated notifications and reminders</li>
              <li>Secure data storage and backups</li>
            </ul>
            
            <center>
              <a href="${data.subscribeUrl}" class="button">Subscribe Now</a>
            </center>
            
            <p style="margin-top: 32px; color: #6b7280; font-size: 14px;">
              If you have any questions, reply to this email or contact our support team.
            </p>
          </div>
          <div class="footer">
            <p><strong>SocietyLedger</strong> - Simplifying Association Management</p>
            <p>
              <a href="${data.subscribeUrl}">View Plans</a> • 
              <a href="mailto:${SUPPORT_EMAIL}">Contact Support</a> • 
              <a href="${WEBSITE_URL}">Visit Website</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
    
    'trial-expired': (data) => `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8">${baseStyle}</head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Your Trial Has Ended</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.associationName},</h2>
            <p>Your free trial of SocietyLedger has ended. We hope you enjoyed exploring our platform!</p>
            
            <p>To continue managing your association with all the powerful features you've been using, please choose a subscription plan.</p>
            
            <div class="highlight-box">
              <p><strong>🎯 Ready to unlock full access?</strong></p>
              <p>Choose the plan that fits your association's size and needs.</p>
            </div>
            
            <center>
              <a href="${data.subscribeUrl}" class="button">View Plans & Subscribe</a>
            </center>
            
            <p style="margin-top: 24px;"><strong>Why subscribe?</strong></p>
            <ul>
              <li>✅ Never lose your member data</li>
              <li>✅ Continue collecting payments seamlessly</li>
              <li>✅ Access financial reports anytime</li>
              <li>✅ Keep your association organized</li>
            </ul>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
              Your data is safe and will be preserved for 30 days. Subscribe anytime to restore full access.
            </p>
          </div>
          <div class="footer">
            <p><strong>SocietyLedger</strong> - Simplifying Association Management</p>
            <p><a href="${data.subscribeUrl}">Subscribe Now</a> • <a href="mailto:${SUPPORT_EMAIL}">Contact Support</a></p>
          </div>
        </div>
      </body>
      </html>
    `,
    
    'renewal-reminder': (data) => `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8">${baseStyle}</head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔔 Subscription Renewal Coming Up</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.associationName}!</h2>
            <p>This is a friendly reminder that your SocietyLedger subscription will automatically renew in <strong>${data.daysLeft} days</strong>.</p>
            
            <div class="highlight-box">
              <strong>Plan:</strong> ${data.planName}<br>
              <strong>Renewal Date:</strong> ${data.renewalDate}<br>
              <strong>Amount:</strong> ₦${data.amount.toLocaleString()}<br>
              <strong>Billing Cycle:</strong> ${data.billingCycle === 'ANNUAL' ? 'Annual' : 'Monthly'}
            </div>
            
            <p><strong>Payment will be processed automatically</strong> on the renewal date via your saved payment method.</p>
            
            <p>Want to make changes? You can:</p>
            <ul>
              <li>Upgrade to a higher plan</li>
              <li>Downgrade to a lower plan</li>
              <li>Switch billing cycle (monthly ↔ annual)</li>
              <li>Update payment information</li>
              <li>Cancel your subscription</li>
            </ul>
            
            <center>
              <a href="${data.manageUrl}" class="button">Manage Subscription</a>
            </center>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
              No action needed if you want to continue with your current plan. Thank you for using SocietyLedger!
            </p>
          </div>
          <div class="footer">
            <p><strong>SocietyLedger</strong> - Simplifying Association Management</p>
            <p><a href="${data.manageUrl}">Manage Subscription</a> • <a href="mailto:${SUPPORT_EMAIL}">Contact Support</a></p>
          </div>
        </div>
      </body>
      </html>
    `,
    
    'subscription-expired': (data) => `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8">${baseStyle}</head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Subscription Expired</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.associationName},</h2>
            <p class="warning">Your SocietyLedger subscription has expired and your account access has been suspended.</p>
            
            <p>To restore full access to your association's data and continue operations, please renew your subscription.</p>
            
            <div class="highlight-box">
              <p><strong>🔒 What happens when your subscription expires?</strong></p>
              <ul style="margin: 8px 0; padding-left: 20px;">
                <li>Member data is preserved but not accessible</li>
                <li>Payment collection is paused</li>
                <li>Reports and exports are unavailable</li>
                <li>Automated notifications stop</li>
              </ul>
            </div>
            
            <p><strong>Good news:</strong> Your data is safe! Renew now to restore everything.</p>
            
            <center>
              <a href="${data.renewUrl}" class="button">Renew Subscription</a>
            </center>
            
            <p style="color: #dc2626; font-size: 14px; margin-top: 32px;">
              ⏰ <strong>Important:</strong> Your data will be permanently deleted after 30 days of inactivity. Please renew to avoid data loss.
            </p>
          </div>
          <div class="footer">
            <p><strong>SocietyLedger</strong> - Simplifying Association Management</p>
            <p><a href="${data.renewUrl}">Renew Now</a> • <a href="mailto:${SUPPORT_EMAIL}">Contact Support</a></p>
          </div>
        </div>
      </body>
      </html>
    `,

    'subscription-past-due': (data) => `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8">${baseStyle}</head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Payment Overdue</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.associationName},</h2>
            <p class="warning">Your SocietyLedger subscription payment is overdue. Your account is still active, but access will be suspended in <strong>3 days</strong> if payment isn't received.</p>

            <p>Please renew your subscription now to avoid any interruption.</p>

            <center>
              <a href="${data.renewUrl}" class="button">Renew Subscription</a>
            </center>

            <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
              No action needed if you've already renewed — this may cross with your payment.
            </p>
          </div>
          <div class="footer">
            <p><strong>SocietyLedger</strong> - Simplifying Association Management</p>
            <p><a href="${data.renewUrl}">Renew Now</a> • <a href="mailto:${SUPPORT_EMAIL}">Contact Support</a></p>
          </div>
        </div>
      </body>
      </html>
    `,

    'payment-successful': (data) => `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8">${baseStyle}</head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Payment Successful!</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.associationName}!</h2>
            <p class="success">Your payment has been processed successfully. Thank you for your subscription!</p>
            
            <div class="highlight-box">
              <strong>Transaction Details</strong><br><br>
              <strong>Amount Paid:</strong> ₦${data.amount.toLocaleString()}<br>
              <strong>Reference:</strong> ${data.reference}<br>
              <strong>Plan:</strong> ${data.planName}<br>
              <strong>Status:</strong> <span class="success">Confirmed</span><br>
              <strong>Date:</strong> ${new Date().toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            
            <p>Your subscription is now active and you have full access to all features.</p>
            
            <p><strong>What's included in your plan:</strong></p>
            <ul>
              <li>✅ Member management and tracking</li>
              <li>✅ Financial management and reporting</li>
              <li>✅ Payment collection via Paystack</li>
              <li>✅ Automated notifications and reminders</li>
              <li>✅ Data export and backup</li>
              <li>✅ Premium support</li>
            </ul>
            
            <center>
              <a href="${data.dashboardUrl || `${WEBSITE_URL}/dashboard`}" class="button">Go to Dashboard</a>
            </center>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
              Need a receipt? You can download your invoice from the subscription page in your dashboard.
            </p>
          </div>
          <div class="footer">
            <p><strong>SocietyLedger</strong> - Simplifying Association Management</p>
            <p><a href="mailto:${SUPPORT_EMAIL}">Contact Support</a> • <a href="${WEBSITE_URL}">Visit Website</a></p>
          </div>
        </div>
      </body>
      </html>
    `,

    'email-verification': (data) => `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8">${baseStyle}</head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📧 Verify Your Email</h1>
          </div>
          <div class="content">
            <h2>Welcome to ${data.associationName}!</h2>
            <p>Thank you for registering. Please use the verification code below to verify your email address:</p>
            
            <div style="text-align: center; margin: 32px 0;">
              <div style="display: inline-block; background: #f0f9ff; border: 2px dashed #3b82f6; border-radius: 8px; padding: 24px 48px;">
                <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1e40af;">${data.code}</span>
              </div>
            </div>
            
            <div class="highlight-box">
              <strong>⏰ This code expires in ${data.expiryMinutes} minutes</strong>
            </div>
            
            <p>Enter this code on the verification page to complete your registration.</p>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
              If you didn't create an account with ${data.associationName}, you can safely ignore this email.
            </p>
          </div>
          <div class="footer">
            <p><strong>SocietyLedger</strong> - Simplifying Association Management</p>
            <p><a href="mailto:${SUPPORT_EMAIL}">Contact Support</a> • <a href="${WEBSITE_URL}">Visit Website</a></p>
          </div>
        </div>
      </body>
      </html>
    `,

    'password-reset': (data) => `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8">${baseStyle}</head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Reset Your Password</h1>
          </div>
          <div class="content">
            <h2>Password Reset Request</h2>
            <p>We received a request to reset your password for your ${data.associationName} account.</p>
            
            <p>Click the button below to create a new password:</p>
            
            <center>
              <a href="${data.resetUrl}" class="button">Reset Password</a>
            </center>
            
            <div class="highlight-box">
              <strong>⏰ This link expires in ${data.expiryMinutes} minutes</strong>
            </div>
            
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #3b82f6; font-size: 14px;">${data.resetUrl}</p>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
              If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
            </p>
          </div>
          <div class="footer">
            <p><strong>SocietyLedger</strong> - Simplifying Association Management</p>
            <p><a href="mailto:${SUPPORT_EMAIL}">Contact Support</a> • <a href="${WEBSITE_URL}">Visit Website</a></p>
          </div>
        </div>
      </body>
      </html>
    `,

    'account-approved': (data) => `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8">${baseStyle}</head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Account Approved!</h1>
          </div>
          <div class="content">
            <h2>Welcome to ${data.associationName}!</h2>
            <p class="success">Great news! Your account has been approved by an administrator.</p>
            
            <p>You can now log in and access all the features available to you.</p>
            
            <center>
              <a href="${data.loginUrl}" class="button">Log In Now</a>
            </center>
            
            <p><strong>What you can do:</strong></p>
            <ul>
              <li>✅ View your membership details</li>
              <li>✅ Track your dues and payments</li>
              <li>✅ Receive important notifications</li>
              <li>✅ Access association resources</li>
            </ul>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
              If you have any questions, please contact your association administrator.
            </p>
          </div>
          <div class="footer">
            <p><strong>SocietyLedger</strong> - Simplifying Association Management</p>
            <p><a href="mailto:${SUPPORT_EMAIL}">Contact Support</a> • <a href="${WEBSITE_URL}">Visit Website</a></p>
          </div>
        </div>
      </body>
      </html>
    `,

    'account-rejected': (data) => `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8">${baseStyle}</head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Account Registration Update</h1>
          </div>
          <div class="content">
            <h2>Hello,</h2>
            <p>We regret to inform you that your registration request for ${data.associationName} was not approved.</p>
            
            ${data.rejectionReason ? `
            <div class="highlight-box">
              <strong>Reason:</strong><br>
              ${data.rejectionReason}
            </div>
            ` : ''}
            
            <p>If you believe this was a mistake or have questions, please contact the association administrator.</p>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
              You may try registering again or reach out to support for assistance.
            </p>
          </div>
          <div class="footer">
            <p><strong>SocietyLedger</strong> - Simplifying Association Management</p>
            <p><a href="mailto:${SUPPORT_EMAIL}">Contact Support</a> • <a href="${WEBSITE_URL}">Visit Website</a></p>
          </div>
        </div>
      </body>
      </html>
    `,

    'notification': (data) => `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8">${baseStyle}</head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔔 ${data.title}</h1>
          </div>
          <div class="content">
            <p>${data.message}</p>
            
            <center>
              <a href="${WEBSITE_URL}/dashboard" class="button">View in Dashboard</a>
            </center>
          </div>
          <div class="footer">
            <p><strong>SocietyLedger</strong> - Simplifying Association Management</p>
            <p><a href="mailto:${SUPPORT_EMAIL}">Contact Support</a> • <a href="${WEBSITE_URL}">Visit Website</a></p>
          </div>
        </div>
      </body>
      </html>
    `,

    'announcement': (data) => `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8">${baseStyle}</head>
      <body>
        <div class="container">
          <div class="header" style="${data.priority === 'urgent' ? 'background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);' : data.priority === 'warning' ? 'background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);' : ''}">
            <h1>📢 ${data.title}</h1>
          </div>
          <div class="content">
            <h2>Announcement from ${data.associationName}</h2>
            
            ${data.priority === 'urgent' ? '<p class="warning"><strong>⚠️ This is an urgent announcement</strong></p>' : ''}
            
            <div class="highlight-box">
              ${data.message}
            </div>
            
            <center>
              <a href="${WEBSITE_URL}/dashboard" class="button">View in Dashboard</a>
            </center>
          </div>
          <div class="footer">
            <p><strong>SocietyLedger</strong> - Simplifying Association Management</p>
            <p><a href="mailto:${SUPPORT_EMAIL}">Contact Support</a> • <a href="${WEBSITE_URL}">Visit Website</a></p>
          </div>
        </div>
      </body>
      </html>
    `,

    'payment-reminder': (data) => `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8">${baseStyle}</head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💳 Payment Reminder</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.memberName}!</h2>
            <p>This is a friendly reminder about your upcoming payment for <strong>${data.associationName}</strong>.</p>
            
            <div class="highlight-box">
              <strong>Payment Details</strong><br><br>
              <strong>Category:</strong> ${data.categoryName}<br>
              <strong>Amount Due:</strong> ₦${data.amount.toLocaleString()}<br>
              <strong>Due Date:</strong> ${data.dueDate}<br>
              ${data.daysUntilDue > 0 
                ? `<strong>Days Remaining:</strong> ${data.daysUntilDue} days`
                : `<span class="warning"><strong>Status:</strong> Overdue by ${Math.abs(data.daysUntilDue)} days</span>`
              }
            </div>
            
            <p>Please make your payment before the due date to avoid any late fees.</p>
            
            <center>
              <a href="${data.paymentUrl || WEBSITE_URL + '/dashboard/payments'}" class="button">Make Payment</a>
            </center>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
              If you have already made this payment, please disregard this reminder.
            </p>
          </div>
          <div class="footer">
            <p><strong>SocietyLedger</strong> - Simplifying Association Management</p>
            <p><a href="mailto:${SUPPORT_EMAIL}">Contact Support</a> • <a href="${WEBSITE_URL}">Visit Website</a></p>
          </div>
        </div>
      </body>
      </html>
    `,

    'payment-overdue': (data) => `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8">${baseStyle}</head>
      <body>
        <div class="container">
          <div class="header" style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);">
            <h1>⚠️ Payment Overdue</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.memberName},</h2>
            <p class="warning">Your payment for <strong>${data.associationName}</strong> is now overdue.</p>
            
            <div class="highlight-box">
              <strong>Overdue Payment Details</strong><br><br>
              <strong>Category:</strong> ${data.categoryName}<br>
              <strong>Amount Due:</strong> ₦${data.amount.toLocaleString()}<br>
              <strong>Original Due Date:</strong> ${data.dueDate}<br>
              <strong>Days Overdue:</strong> <span class="warning">${data.daysOverdue} days</span>
            </div>
            
            <p>Please make your payment as soon as possible to avoid additional penalties.</p>
            
            <center>
              <a href="${data.paymentUrl || WEBSITE_URL + '/dashboard/payments'}" class="button">Pay Now</a>
            </center>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
              If you're experiencing difficulties, please contact your association administrator.
            </p>
          </div>
          <div class="footer">
            <p><strong>SocietyLedger</strong> - Simplifying Association Management</p>
            <p><a href="mailto:${SUPPORT_EMAIL}">Contact Support</a> • <a href="${WEBSITE_URL}">Visit Website</a></p>
          </div>
        </div>
      </body>
      </html>
    `,

    'payment-receipt': (data) => `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8">${baseStyle}</head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🧾 Payment Receipt</h1>
          </div>
          <div class="content">
            <h2>Thank you, ${data.memberName}!</h2>
            <p class="success">Your payment has been received and confirmed.</p>
            
            <div class="highlight-box">
              <strong>Receipt Details</strong><br><br>
              <strong>Receipt Number:</strong> ${data.receiptNumber}<br>
              <strong>Amount Paid:</strong> ₦${data.amount.toLocaleString()}<br>
              <strong>Category:</strong> ${data.categoryName}<br>
              <strong>Payment Method:</strong> ${data.paymentMethod}<br>
              <strong>Date:</strong> ${data.paymentDate}<br>
              <strong>Association:</strong> ${data.associationName}
            </div>
            
            <p>This email serves as your official receipt. Please keep it for your records.</p>
            
            <center>
              <a href="${WEBSITE_URL}/dashboard/transactions" class="button">View Transaction History</a>
            </center>
          </div>
          <div class="footer">
            <p><strong>SocietyLedger</strong> - Simplifying Association Management</p>
            <p><a href="mailto:${SUPPORT_EMAIL}">Contact Support</a> • <a href="${WEBSITE_URL}">Visit Website</a></p>
          </div>
        </div>
      </body>
      </html>
    `,

    'member-invite': (data) => `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8">${baseStyle}</head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 You're Invited!</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.memberName}!</h2>
            <p>You've been invited to activate your login account for <strong>${data.associationName}</strong> on SocietyLedger.</p>
            
            <p>With your account, you'll be able to:</p>
            <ul>
              <li>✅ View your membership details</li>
              <li>✅ Track your dues and payments</li>
              <li>✅ Receive important notifications</li>
              <li>✅ Access association resources</li>
            </ul>
            
            <center>
              <a href="${data.activateUrl}" class="button">Activate Your Account</a>
            </center>
            
            <div class="highlight-box">
              <strong>⏰ This invitation expires in ${data.expiryHours} hours</strong>
            </div>
            
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #3b82f6; font-size: 14px;">${data.activateUrl}</p>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
              If you didn't expect this invitation or have questions, please contact your association administrator.
            </p>
          </div>
          <div class="footer">
            <p><strong>SocietyLedger</strong> - Simplifying Association Management</p>
            <p><a href="mailto:${SUPPORT_EMAIL}">Contact Support</a> • <a href="${WEBSITE_URL}">Visit Website</a></p>
          </div>
        </div>
      </body>
      </html>
    `,

    'meeting-reminder': (data) => `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8">${baseStyle}</head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📅 Meeting Reminder</h1>
          </div>
          <div class="content">
            <h2>Hello!</h2>
            <p>This is a friendly reminder about an upcoming meeting for <strong>${data.associationName}</strong>.</p>
            
            <div class="highlight-box">
              <strong>Meeting Details</strong><br><br>
              <strong>Title:</strong> ${data.meetingTitle}<br>
              <strong>Date:</strong> ${data.meetingDate}<br>
              <strong>Time:</strong> ${data.meetingTime}<br>
              <strong>Type:</strong> ${data.meetingType}<br>
              <strong>Location:</strong> ${data.location}
              ${data.virtualLink ? `<br><strong>Virtual Link:</strong> <a href="${data.virtualLink}" style="color: #3b82f6;">${data.virtualLink}</a>` : ''}
            </div>
            
            <p>Please make sure to attend on time. Your participation is important!</p>
            
            <center>
              <a href="${WEBSITE_URL}/dashboard/governance/meetings" class="button">View Meeting Details</a>
            </center>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
              If you cannot attend, please inform the meeting organizer in advance.
            </p>
          </div>
          <div class="footer">
            <p><strong>SocietyLedger</strong> - Simplifying Association Management</p>
            <p><a href="mailto:${SUPPORT_EMAIL}">Contact Support</a> • <a href="${WEBSITE_URL}">Visit Website</a></p>
          </div>
        </div>
      </body>
      </html>
    `,

    'meeting-cancelled': (data) => `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8">${baseStyle}</head>
      <body>
        <div class="container">
          <div class="header" style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);">
            <h1>❌ Meeting Cancelled</h1>
          </div>
          <div class="content">
            <h2>Hello!</h2>
            <p>We regret to inform you that the following meeting for <strong>${data.associationName}</strong> has been cancelled.</p>
            
            <div class="highlight-box">
              <strong>Cancelled Meeting Details</strong><br><br>
              <strong>Title:</strong> ${data.meetingTitle}<br>
              <strong>Originally Scheduled:</strong> ${data.meetingDate}<br>
              <strong>Reason:</strong> ${data.cancellationReason}
            </div>
            
            <p>We apologize for any inconvenience this may cause. A new meeting may be scheduled soon.</p>
            
            <center>
              <a href="${WEBSITE_URL}/dashboard/governance/meetings" class="button">View Upcoming Meetings</a>
            </center>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
              If you have any questions, please contact your association administrator.
            </p>
          </div>
          <div class="footer">
            <p><strong>SocietyLedger</strong> - Simplifying Association Management</p>
            <p><a href="mailto:${SUPPORT_EMAIL}">Contact Support</a> • <a href="${WEBSITE_URL}">Visit Website</a></p>
          </div>
        </div>
      </body>
      </html>
    `,

    'meeting-scheduled': (data) => `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8">${baseStyle}</head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📅 New Meeting Scheduled</h1>
          </div>
          <div class="content">
            <h2>Hello!</h2>
            <p>A new meeting has been scheduled for <strong>${data.associationName}</strong>.</p>
            
            <div class="highlight-box">
              <strong>Meeting Details</strong><br><br>
              <strong>Title:</strong> ${data.meetingTitle}<br>
              <strong>Date:</strong> ${data.meetingDate}<br>
              <strong>Time:</strong> ${data.meetingTime}<br>
              <strong>Type:</strong> ${data.meetingType}<br>
              <strong>Location:</strong> ${data.location}
              ${data.virtualLink ? `<br><strong>Virtual Link:</strong> <a href="${data.virtualLink}" style="color: #3b82f6;">${data.virtualLink}</a>` : ''}
            </div>
            
            <p>Please mark your calendar and plan to attend. Your participation is valued!</p>
            
            <center>
              <a href="${WEBSITE_URL}/dashboard/governance/meetings" class="button">View Meeting Details</a>
            </center>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
              You will receive a reminder 24 hours before the meeting.
            </p>
          </div>
          <div class="footer">
            <p><strong>SocietyLedger</strong> - Simplifying Association Management</p>
            <p><a href="mailto:${SUPPORT_EMAIL}">Contact Support</a> • <a href="${WEBSITE_URL}">Visit Website</a></p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  const templateFn = templates[template];
  if (!templateFn) {
    // Fallback template
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8">${baseStyle}</head>
      <body>
        <div class="container">
          <div class="header">
            <h1>SocietyLedger Notification</h1>
          </div>
          <div class="content">
            <p>Template "${template}" not found. Please contact support.</p>
          </div>
          <div class="footer">
            <p><strong>SocietyLedger</strong></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
  
  return templateFn(data);
}

/**
 * Send bulk emails (for announcements)
 */
export async function sendBulkEmail(
  recipients: string[],
  subject: string,
  template: string,
  data: Record<string, any>
): Promise<void> {
  // Send emails in batches to avoid rate limits
  const batchSize = 100;
  
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    
    await Promise.all(
      batch.map(to => sendEmail({ to, subject, template, data }))
    );
    
    // Wait between batches
    if (i + batchSize < recipients.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`✓ Sent ${recipients.length} emails`);
}
