'use client';

import { Container, Button } from '@mantine/core';
import Footer from '@/components/layout/Footer';
import Header from '@/components/layout/Header';
import { IconUsers, IconShieldCheck } from '@tabler/icons-react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-teal-50/30 to-green-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <Header />

      <section className="pt-32 pb-12 px-4">
        <Container size="md">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-500/20 to-green-500/20 border border-teal-500/30 mb-6">
              <IconShieldCheck className="text-teal-500" size={40} />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent">
                Privacy Policy
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
            <h2>1. Introduction</h2>
            <p>
              SocietyLedger (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our association management platform.
            </p>

            <h2>2. Information We Collect</h2>
            <h3>Personal Information</h3>
            <p>We collect information that you provide directly to us, including:</p>
            <ul>
              <li>Name, email address, and phone number</li>
              <li>Association/organization details</li>
              <li>Payment information (processed securely through third-party providers)</li>
              <li>Member data you upload to the platform</li>
            </ul>

            <h3>Automatically Collected Information</h3>
            <p>When you use our service, we automatically collect:</p>
            <ul>
              <li>Log data (IP address, browser type, pages visited)</li>
              <li>Device information</li>
              <li>Usage data and analytics</li>
            </ul>

            <h2>3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul>
              <li>Provide, maintain, and improve our services</li>
              <li>Process transactions and send related information</li>
              <li>Send administrative information, updates, and security alerts</li>
              <li>Respond to your comments and questions</li>
              <li>Monitor and analyze trends, usage, and activities</li>
              <li>Detect, prevent, and address technical issues and fraud</li>
            </ul>

            <h2>4. Data Storage and Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction. Your data is encrypted in transit and at rest using industry-standard encryption protocols.
            </p>

            <h2>5. Data Sharing and Disclosure</h2>
            <p>We do not sell your personal information. We may share your information with:</p>
            <ul>
              <li>Service providers who assist in our operations (payment processors, SMS providers)</li>
              <li>Law enforcement when required by law</li>
              <li>Other parties with your consent</li>
            </ul>

            <h2>6. Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Export your data</li>
              <li>Opt-out of marketing communications</li>
            </ul>

            <h2>7. Data Retention</h2>
            <p>
              We retain your information for as long as your account is active or as needed to provide services. We will retain and use your information as necessary to comply with legal obligations, resolve disputes, and enforce our agreements.
            </p>

            <h2>8. Cookies and Tracking</h2>
            <p>
              We use cookies and similar tracking technologies to track activity on our service and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.
            </p>

            <h2>9. Children&apos;s Privacy</h2>
            <p>
              Our service is not intended for children under 13. We do not knowingly collect personal information from children under 13. If you become aware that a child has provided us with personal information, please contact us.
            </p>

            <h2>10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the &quot;Last Updated&quot; date.
            </p>

            <h2>11. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy, please contact us at:
              <br />
              Email: privacy@societyledger.com.ng
              <br />
              Address: Lagos, Nigeria
            </p>
          </div>

          <div className="mt-8 text-center">
            <Button 
              component={Link}
              href="/terms"
              size="lg"
              variant="outline"
              className="border-2 border-teal-500 text-teal-600 dark:text-teal-400"
            >
              View Terms of Service
            </Button>
          </div>
        </Container>
      </section>

      <Footer />
    </div>
  );
}
