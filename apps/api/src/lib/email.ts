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
    FROM_EMAIL: process.env.EMAIL_FROM || 'SocietyLedger <noreply@societyledger.com>',
    REPLY_TO: process.env.EMAIL_REPLY_TO || 'support@societyledger.com',
    SUPPORT_EMAIL: process.env.EMAIL_REPLY_TO || 'support@societyledger.com',
    WEBSITE_URL: process.env.APP_URL || 'https://societyledger.com',
  };
}

/**
 * Send email using Resend
 * Production-ready implementation with error handling and logging
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  const { to, subject, template, data } = options;

  try {
    // Get configuration
    const config = getEmailConfig();
    
    // Get HTML content for template
    const htmlContent = getTemplateContent(template, data);

    // Log email attempt
    console.log(`📧 [EMAIL] Sending ${template} to ${to}`);

    // Send via Resend (use lazy-loaded client)
    const resend = getResendClient();
    const result = await resend.emails.send({
      from: config.FROM_EMAIL,
      to,
      subject,
      html: htmlContent,
      reply_to: config.REPLY_TO,
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
    
    // In production, you might want to:
    // - Log to error tracking service (Sentry, etc.)
    // - Store failed emails in database for retry
    // - Alert monitoring system
    
    // Don't throw error to prevent cron job failures
    // Emails are important but shouldn't break the system
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
