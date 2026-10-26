'use client';

import { Container, Button } from '@mantine/core';
import { 
  IconUsers, 
  IconCurrencyNaira, 
  IconChartBar, 
  IconBell, 
  IconShieldCheck, 
  IconHeart,
  IconFileText,
  IconCalendar,
  IconCheckbox,
  IconMessage,
  IconCloud,
  IconDeviceMobile,
  IconArrowRight
} from '@tabler/icons-react';
import Link from 'next/link';
import Footer from '@/components/layout/Footer';
import Header from '@/components/layout/Header';

export default function FeaturesPage() {
  const features = [
    {
      icon: <IconUsers size={32} />,
      title: 'Member Management',
      description: 'Comprehensive member profiles with status tracking, bulk operations, automated onboarding, and member directory with search and filters.',
      benefits: ['Digital member profiles', 'Status tracking', 'Bulk import/export', 'Member categories']
    },
    {
      icon: <IconCurrencyNaira size={32} />,
      title: 'Dues & Levies Tracking',
      description: 'Automated billing cycles, payment tracking, balance management, penalty calculations, and payment history for complete financial transparency.',
      benefits: ['Automated billing', 'Payment reminders', 'Balance tracking', 'Penalty management']
    },
    {
      icon: <IconChartBar size={32} />,
      title: 'Financial Reports',
      description: 'Real-time financial dashboards, income and expense tracking, balance sheets, cash flow reports, and audit trails for accountability.',
      benefits: ['Real-time dashboards', 'Income/expense tracking', 'Audit trails', 'Export to Excel']
    },
    {
      icon: <IconHeart size={32} />,
      title: 'Welfare Funds',
      description: 'Create multiple welfare funds, track contributions, manage payout requests, set eligibility rules, and generate fund reports.',
      benefits: ['Multiple funds', 'Contribution tracking', 'Payout management', 'Eligibility rules']
    },
    {
      icon: <IconBell size={32} />,
      title: 'SMS & Email Notifications',
      description: 'Send bulk SMS and emails, automated payment reminders, announcements, custom messages, and scheduled notifications to keep members informed.',
      benefits: ['Bulk messaging', 'Auto reminders', 'Custom templates', 'Scheduled sends']
    },
    {
      icon: <IconShieldCheck size={32} />,
      title: 'Role-Based Access Control',
      description: 'Secure permissions for admin, treasurer, secretary, and members. Granular access control with complete audit logs for all actions.',
      benefits: ['Custom roles', 'Permission management', 'Audit logs', 'Secure access']
    },
    {
      icon: <IconFileText size={32} />,
      title: 'Document Management',
      description: 'Store and organize association documents, meeting minutes, constitutions, bylaws, and policies in a secure cloud storage.',
      benefits: ['Cloud storage', 'Document categories', 'Version control', 'Secure access']
    },
    {
      icon: <IconCalendar size={32} />,
      title: 'Meeting Management',
      description: 'Schedule meetings, send invitations, track attendance, record minutes, and manage action items all in one place.',
      benefits: ['Meeting scheduler', 'Attendance tracking', 'Minutes recording', 'Action items']
    },
    {
      icon: <IconCheckbox size={32} />,
      title: 'Elections & Voting',
      description: 'Conduct secure online elections, create ballots, manage candidates, track votes, and generate election reports with transparency.',
      benefits: ['Online voting', 'Ballot creation', 'Real-time results', 'Transparent process']
    },
    {
      icon: <IconMessage size={32} />,
      title: 'Communication Hub',
      description: 'Internal messaging, announcements board, discussion forums, and notification center for seamless member communication.',
      benefits: ['Internal messaging', 'Announcements', 'Discussion forums', 'Notification center']
    },
    {
      icon: <IconCloud size={32} />,
      title: 'Cloud-Based & Secure',
      description: 'Access from anywhere, automatic backups, bank-level encryption, 99.9% uptime, and enterprise-grade security for your data.',
      benefits: ['Cloud access', 'Auto backups', 'SSL encryption', '99.9% uptime']
    },
    {
      icon: <IconDeviceMobile size={32} />,
      title: 'Mobile Responsive',
      description: 'Works perfectly on all devices - desktop, tablet, and mobile. Progressive Web App that can be installed like a native app.',
      benefits: ['Mobile friendly', 'PWA support', 'Offline mode', 'Cross-platform']
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-teal-50/30 to-green-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <Header />

      <section className="pt-32 pb-12 px-4">
        <Container size="lg">
          <div className="text-center mb-12">
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent">
                Everything You Need
              </span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Powerful features designed specifically for African associations, cooperatives, and community organizations.
            </p>
          </div>
        </Container>
      </section>

      <section className="pb-20 px-4">
        <Container size="xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, idx) => (
              <div 
                key={idx}
                className="glass-strong p-8 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500/20 to-green-500/20 border border-teal-500/30 flex items-center justify-center mb-6 text-teal-500">
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                  {feature.description}
                </p>
                <ul className="space-y-2">
                  {feature.benefits.map((benefit, bIdx) => (
                    <li key={bIdx} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <div className="w-1.5 h-1.5 rounded-full bg-teal-500"></div>
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-16 glass-strong p-10 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Ready to Transform Your Association?
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
              Create your association today and see how SocietyLedger fits the way you run it. See the pricing page for how new associations get started.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button 
                component={Link}
                href="/signup"
                size="lg"
                className="bg-gradient-to-r from-teal-500 to-green-500 hover:from-teal-600 hover:to-green-600"
                rightSection={<IconArrowRight size={20} />}
              >
                Start Free Trial
              </Button>
              <Button 
                component={Link}
                href="/pricing"
                size="lg"
                variant="outline"
                className="border-2 border-teal-500 text-teal-600 dark:text-teal-400"
              >
                View Pricing
              </Button>
            </div>
          </div>
        </Container>
      </section>

      <Footer />
    </div>
  );
}
