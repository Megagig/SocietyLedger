'use client';

import { Button, Container } from '@mantine/core';
import { 
  IconUsers, 
  IconCurrencyNaira, 
  IconChartBar, 
  IconBell, 
  IconShieldCheck, 
  IconHeart,
  IconBuilding,
  IconUsersGroup,
  IconPray,
  IconTrophy,
  IconBriefcase,
  IconSchool,
  IconCheck,
  IconArrowRight,
  IconLogin
} from '@tabler/icons-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AppDownloadButton } from '@/components/home/AppDownloadButton';
import Footer from '@/components/layout/Footer';
import Header from '@/components/layout/Header';

interface HomeContentProps {
  /** The plans section, rendered on the server from the pricing API so its prices are never hardcoded here. */
  pricingSlot: ReactNode;
  /** One line for the structured data, built from the real plans (for example a free-trial lead-in followed by the lowest monthly price). */
  offerDescription: string;
  /** The short reassurances under the main buttons, from the onboarding policy (empty when nothing free is offered). */
  startBadges: string[];
}

export function HomeContent({ pricingSlot, offerDescription, startBadges }: HomeContentProps) {
  // SoftwareApplication Schema for SEO
  const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'SocietyLedger',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web, iOS, Android',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'NGN',
      description: offerDescription,
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '150',
      bestRating: '5',
      worstRating: '1',
    },
    description: 'Comprehensive association management software for cooperatives, clubs, and community organizations across Africa.',
    url: 'https://societyledger.com.ng',
    featureList: [
      'Member Management',
      'Financial Tracking',
      'Dues and Levies',
      'Welfare Funds',
      'SMS Notifications',
      'Reports and Analytics',
    ],
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-teal-50/30 to-green-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* JSON-LD Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      
      {/* Navigation */}
      <Header />

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <Container size="xl">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8 text-sm font-medium text-teal-600 dark:text-teal-400">
              <IconShieldCheck size={18} />
              <span>Trusted by 500+ Associations Across Nigeria</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              <span className="bg-gradient-to-r from-gray-900 via-teal-800 to-green-800 dark:from-white dark:via-teal-200 dark:to-green-200 bg-clip-text text-transparent">
                Modern Management for
              </span>
              <br />
              <span className="bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent">
                Your Association
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed">
              Digitize your operations, track finances, manage members, and grow your community with 
              the leading SaaS platform built for African associations.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Button 
                component={Link}
                href="/signup"
                size="xl"
                className="bg-gradient-to-r from-teal-500 to-green-500 hover:from-teal-600 hover:to-green-600 text-white px-8"
                rightSection={<IconArrowRight size={20} />}
              >
                Create Your Association
              </Button>
              <Button 
                component={Link}
                href="/auth/login"
                size="xl"
                variant="outline"
                className="border-2 border-teal-500 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20"
              >
                Sign In
              </Button>
              <AppDownloadButton />
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-gray-500 dark:text-gray-400">
              {startBadges.map((badge) => (
                <div key={badge} className="flex items-center gap-2">
                  <IconCheck size={18} className="text-teal-500" />
                  <span>{badge}</span>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <IconCheck size={18} className="text-teal-500" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Key Features Section */}
      <section className="py-20 px-4">
        <Container size="xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
              Everything You Need to Manage Your Association
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Powerful features designed for Nigerian associations, clubs, and cooperative societies
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: <IconUsers className="text-teal-500" size={32} />,
                title: 'Member Management',
                description: 'Digital member profiles, status tracking, bulk operations, and automated onboarding workflows'
              },
              {
                icon: <IconCurrencyNaira className="text-green-500" size={32} />,
                title: 'Dues & Levies Tracking',
                description: 'Automated billing, payment reminders, balance tracking, and penalty calculations'
              },
              {
                icon: <IconChartBar className="text-blue-500" size={32} />,
                title: 'Accounting & Reports',
                description: 'Real-time financial reports, income/expense tracking, and audit trails for transparency'
              },
              {
                icon: <IconHeart className="text-rose-500" size={32} />,
                title: 'Fundraising & Donations',
                description: 'Campaign management, donor tracking, and transparent fund allocation reports'
              },
              {
                icon: <IconBell className="text-amber-500" size={32} />,
                title: 'SMS & Email Notifications',
                description: 'Automated reminders, announcements, and custom messaging to keep members informed'
              },
              {
                icon: <IconShieldCheck className="text-indigo-500" size={32} />,
                title: 'Role-Based Access Control',
                description: 'Secure permissions for admin, treasurer, secretary, and members with audit logs'
              }
            ].map((feature, idx) => (
              <div 
                key={idx}
                className="glass p-8 rounded-2xl hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-gray-200/50 dark:border-gray-700/50"
              >
                <div className="mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Who It's For Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-teal-50/50 to-green-50/30 dark:from-gray-800/50 dark:to-gray-900/50">
        <Container size="xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
              Built for Your Community
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Trusted by diverse organizations across Nigeria and Africa
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {[
              { icon: <IconBuilding size={40} />, label: 'Town Unions' },
              { icon: <IconUsersGroup size={40} />, label: 'Cooperatives' },
              { icon: <IconPray size={40} />, label: 'Religious Bodies' },
              { icon: <IconTrophy size={40} />, label: 'Social Clubs' },
              { icon: <IconBriefcase size={40} />, label: 'Professional Groups' },
              { icon: <IconSchool size={40} />, label: 'Alumni Bodies' }
            ].map((org, idx) => (
              <div 
                key={idx}
                className="glass-strong p-6 rounded-xl text-center hover:scale-105 transition-transform duration-300 border border-gray-200/50 dark:border-gray-700/50"
              >
                <div className="text-teal-500 dark:text-teal-400 mb-3 flex justify-center">
                  {org.icon}
                </div>
                <p className="font-semibold text-gray-700 dark:text-gray-200">
                  {org.label}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Pricing Preview Section */}
      <section className="py-20 px-4">
        <Container size="xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Choose a plan that fits your association&apos;s size and needs
            </p>
          </div>

          <div className="max-w-6xl mx-auto">{pricingSlot}</div>
        </Container>
      </section>

      {/* Trust & Professionalism Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-gray-900 to-gray-800 dark:from-gray-950 dark:to-gray-900 text-white">
        <Container size="xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Built on Trust & Security
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Your data is safe with enterprise-grade security and transparent operations
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: <IconShieldCheck size={48} />,
                title: 'Secure & Encrypted',
                description: 'Bank-level encryption and security protocols protect your sensitive association data'
              },
              {
                icon: <IconUsers size={48} />,
                title: 'Role-Based Access',
                description: 'Granular permissions ensure members only see what they need to see'
              },
              {
                icon: <IconChartBar size={48} />,
                title: 'Transparent Accounting',
                description: 'Complete audit trails and real-time reports keep everyone accountable'
              }
            ].map((trust, idx) => (
              <div key={idx} className="text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-500/20 to-green-500/20 border border-teal-500/30 mb-6 text-teal-400">
                  {trust.icon}
                </div>
                <h3 className="text-2xl font-bold mb-3">
                  {trust.title}
                </h3>
                <p className="text-gray-300 leading-relaxed">
                  {trust.description}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}