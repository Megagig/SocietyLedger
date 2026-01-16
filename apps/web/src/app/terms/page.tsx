'use client';

import { Container, Button } from '@mantine/core';
import Footer from '@/components/layout/Footer';
import Header from '@/components/layout/Header';
import { IconUsers, IconFileText } from '@tabler/icons-react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-teal-50/30 to-green-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <Header />

      <section className="pt-32 pb-12 px-4">
        <Container size="md">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-500/20 to-green-500/20 border border-teal-500/30 mb-6">
              <IconFileText className="text-teal-500" size={40} />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent">
                Terms of Service
              </span>
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              Last Updated: January 14, 2026
            </p>
          </div>
        </Container>
      </section>

      <section className="pb-20 px-4">
        <Container size="md">
          <div className="glass-strong p-10 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 prose prose-lg dark:prose-invert max-w-none">
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing and using SocietyLedger, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to these terms, please do not use our service.
            </p>

            <h2>2. Description of Service</h2>
            <p>
              SocietyLedger provides a cloud-based association management platform that enables organizations to manage members, track finances, collect dues, manage welfare funds, and communicate with members.
            </p>

            <h2>3. User Accounts and Registration</h2>
            <p>To use our service, you must:</p>
            <ul>
              <li>Provide accurate and complete registration information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Be at least 18 years old or have parental consent</li>
              <li>Notify us immediately of any unauthorized use</li>
            </ul>

            <h2>4. User Responsibilities</h2>
            <p>You agree to:</p>
            <ul>
              <li>Use the service only for lawful purposes</li>
              <li>Not interfere with or disrupt the service</li>
              <li>Not attempt to gain unauthorized access</li>
              <li>Comply with all applicable laws and regulations</li>
              <li>Maintain accurate member data</li>
            </ul>

            <h2>5. Payment Terms</h2>
            <p>
              Subscription fees are billed in advance on a monthly or annual basis. You authorize us to charge your payment method for all fees. Fees are non-refundable except as required by law.
            </p>

            <h2>6. Intellectual Property</h2>
            <p>
              The service and its original content, features, and functionality are owned by SocietyLedger and are protected by international copyright, trademark, and other intellectual property laws.
            </p>

            <h2>7. User Data</h2>
            <p>
              You retain all rights to the data you upload to the service. We do not claim ownership of your data. You grant us a license to use your data solely to provide the service.
            </p>

            <h2>8. Limitation of Liability</h2>
            <p>
              SocietyLedger shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use or inability to use the service.
            </p>

            <h2>9. Service Availability</h2>
            <p>
              We strive for 99.9% uptime but do not guarantee uninterrupted access. We may suspend service for maintenance, updates, or other reasons with reasonable notice.
            </p>

            <h2>10. Termination</h2>
            <p>
              We may terminate or suspend your account immediately, without prior notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties.
            </p>

            <h2>11. Changes to Terms</h2>
            <p>
              We reserve the right to modify these terms at any time. We will notify users of any material changes. Continued use of the service after changes constitutes acceptance.
            </p>

            <h2>12. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of Nigeria, without regard to its conflict of law provisions.
            </p>

            <h2>13. Contact Information</h2>
            <p>
              For questions about these Terms, contact us at:
              <br />
              Email: legal@societyledger.com.ng
              <br />
              Address: Lagos, Nigeria
            </p>
          </div>

          <div className="mt-8 text-center">
            <Button 
              component={Link}
              href="/privacy"
              size="lg"
              variant="outline"
              className="border-2 border-teal-500 text-teal-600 dark:text-teal-400"
            >
              View Privacy Policy
            </Button>
          </div>
        </Container>
      </section>

      <Footer />
    </div>
  );
}
