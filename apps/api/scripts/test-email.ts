/**
 * Email Service Test Script
 * 
 * Tests the Resend email integration with all templates
 * Run: npx tsx scripts/test-email.ts
 */

// IMPORTANT: Load environment variables FIRST before any other imports
import dotenv from 'dotenv';
dotenv.config();

// Now import modules that depend on environment variables
import { sendEmail } from '../src/lib/email';

async function testEmailService() {
  console.log('🧪 Testing Resend Email Service...\n');
  console.log(`📧 Using API Key: ${process.env.RESEND_API_KEY?.substring(0, 10)}...`);
  console.log(`📤 From: ${process.env.EMAIL_FROM}\n`);

  // Test email address (use your own)
  const testEmail = process.env.TEST_EMAIL || 'test@example.com';
  
  console.log(`🎯 Sending test email to: ${testEmail}\n`);
  console.log('─'.repeat(60));

  try {
    // Test 1: Trial Expiry Warning
    console.log('\n1️⃣ Testing Trial Expiry Warning Email...');
    await sendEmail({
      to: testEmail,
      subject: 'Your trial expires in 3 days',
      template: 'trial-expiry-warning',
      data: {
        associationName: 'Demo Association',
        daysLeft: 3,
        planName: 'Professional',
        planPrice: 15000,
        billingCycle: 'MONTHLY',
        subscribeUrl: 'http://localhost:3000/dashboard/subscription/plans',
      },
    });
    console.log('✅ Trial expiry warning sent successfully!\n');
    
    // Wait between emails
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 2: Trial Expired
    console.log('2️⃣ Testing Trial Expired Email...');
    await sendEmail({
      to: testEmail,
      subject: 'Your trial has expired',
      template: 'trial-expired',
      data: {
        associationName: 'Demo Association',
        subscribeUrl: 'http://localhost:3000/dashboard/subscription/plans',
      },
    });
    console.log('✅ Trial expired email sent successfully!\n');
    
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 3: Renewal Reminder
    console.log('3️⃣ Testing Renewal Reminder Email...');
    await sendEmail({
      to: testEmail,
      subject: 'Subscription renewal in 7 days',
      template: 'renewal-reminder',
      data: {
        associationName: 'Demo Association',
        daysLeft: 7,
        planName: 'Professional',
        amount: 15000,
        billingCycle: 'MONTHLY',
        renewalDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        manageUrl: 'http://localhost:3000/dashboard/subscription',
      },
    });
    console.log('✅ Renewal reminder sent successfully!\n');
    
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 4: Subscription Expired
    console.log('4️⃣ Testing Subscription Expired Email...');
    await sendEmail({
      to: testEmail,
      subject: 'Your subscription has expired',
      template: 'subscription-expired',
      data: {
        associationName: 'Demo Association',
        renewUrl: 'http://localhost:3000/dashboard/subscription/plans',
      },
    });
    console.log('✅ Subscription expired email sent successfully!\n');
    
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 5: Payment Successful
    console.log('5️⃣ Testing Payment Success Email...');
    await sendEmail({
      to: testEmail,
      subject: 'Payment confirmation',
      template: 'payment-successful',
      data: {
        associationName: 'Demo Association',
        amount: 15000,
        reference: 'SUB-123-1234567890',
        planName: 'Professional',
        dashboardUrl: 'http://localhost:3000/dashboard',
      },
    });
    console.log('✅ Payment success email sent successfully!\n');

    console.log('─'.repeat(60));
    console.log('\n🎉 All email templates tested successfully!');
    console.log(`\n📬 Check your inbox at ${testEmail} to view the emails.`);
    console.log('\n💡 Tips:');
    console.log('   - Check spam/junk folder if emails don\'t appear');
    console.log('   - Resend dashboard: https://resend.com/emails');
    console.log('   - View email logs in Resend for delivery status\n');

  } catch (error: any) {
    console.error('\n❌ Email test failed:', error.message);
    console.error('\n🔍 Troubleshooting:');
    console.error('   1. Check RESEND_API_KEY is correct in .env');
    console.error('   2. Verify EMAIL_FROM domain is verified in Resend');
    console.error('   3. Check Resend dashboard for error details');
    console.error('   4. Ensure you have active Resend subscription\n');
    process.exit(1);
  }
}

// Run tests
testEmailService()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
