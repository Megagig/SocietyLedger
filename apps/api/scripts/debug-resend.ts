/**
 * Debug Resend API - Send a simple test email
 */

import dotenv from 'dotenv';
dotenv.config();

import { Resend } from 'resend';

async function debugResend() {
  console.log('🔍 Debugging Resend API...\n');
  console.log(`API Key: ${process.env.RESEND_API_KEY?.substring(0, 15)}...`);
  console.log(`From: ${process.env.EMAIL_FROM}\n`);

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    // Send ultra-simple email with no custom content
    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: 'megagigdev@gmail.com',
      subject: 'Test Email',
      html: '<h1>Hello World!</h1><p>This is a test email.</p>',
    });

    console.log('✅ Success!');
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error('❌ Error:', error);
    console.error('\nError details:', error.message);
    if (error.response) {
      console.error('Response:', error.response);
    }
  }
}

debugResend();
