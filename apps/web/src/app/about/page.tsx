'use client';

import { Button, Container } from '@mantine/core';
import { 
  IconUsers, 
  IconTarget, 
  IconHeart, 
  IconShieldCheck,
  IconTrendingUp,
  IconAward,
  IconArrowRight
} from '@tabler/icons-react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import Footer from '@/components/layout/Footer';
import Header from '@/components/layout/Header';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-teal-50/30 to-green-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* Navigation */}
      <Header />

      {/* Hero Section */}
      <section className="pt-32 pb-12 px-4">
        <Container size="lg">
          <div className="text-center mb-12">
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent">
                About SocietyLedger
              </span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
              We're on a mission to empower African associations, cooperatives, and community organizations 
              with modern financial management tools that promote transparency, accountability, and growth.
            </p>
          </div>
        </Container>
      </section>

      {/* Mission & Vision */}
      <section className="pb-20 px-4">
        <Container size="lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
            <div className="glass-strong p-8 rounded-2xl border border-gray-200/50 dark:border-gray-700/50">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500/20 to-green-500/20 border border-teal-500/30 flex items-center justify-center mb-6">
                <IconTarget className="text-teal-500" size={32} />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Our Mission</h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
                To digitize and modernize association management across Africa, making financial transparency 
                and member engagement accessible to organizations of all sizes.
              </p>
            </div>

            <div className="glass-strong p-8 rounded-2xl border border-gray-200/50 dark:border-gray-700/50">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500/20 to-green-500/20 border border-teal-500/30 flex items-center justify-center mb-6">
                <IconHeart className="text-teal-500" size={32} />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Our Vision</h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
                To become the leading association management platform in Africa, trusted by thousands of 
                communities to manage their finances, members, and operations with confidence.
              </p>
            </div>
          </div>

          {/* Our Story */}
          <div className="glass-strong p-10 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 mb-20">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Our Story</h2>
            <div className="space-y-4 text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
              <p>
                SocietyLedger was born from a simple observation: African associations, cooperatives, and 
                community organizations were struggling with manual record-keeping, lack of transparency, 
                and inefficient financial management.
              </p>
              <p>
                We saw treasurers maintaining Excel spreadsheets, secretaries sending countless WhatsApp 
                messages, and members losing trust due to poor financial visibility. We knew there had to 
                be a better way.
              </p>
              <p>
                Today, SocietyLedger serves hundreds of associations across Nigeria and beyond, helping them 
                manage millions in dues, levies, and welfare funds with complete transparency and accountability.
              </p>
            </div>
          </div>

          {/* Core Values */}
          <div className="mb-20">
            <h2 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-12">
              Our Core Values
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  icon: <IconShieldCheck size={32} />,
                  title: 'Transparency',
                  description: 'We believe in complete financial transparency. Every transaction is tracked, every report is accessible, and every member can see where their money goes.'
                },
                {
                  icon: <IconUsers size={32} />,
                  title: 'Community First',
                  description: 'We build for the community. Our features are designed based on real needs from real associations across Africa.'
                },
                {
                  icon: <IconTrendingUp size={32} />,
                  title: 'Continuous Innovation',
                  description: 'We never stop improving. We listen to feedback, adapt to changing needs, and constantly add features that matter.'
                }
              ].map((value, idx) => (
                <div key={idx} className="glass-strong p-8 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500/20 to-green-500/20 border border-teal-500/30 mb-6 text-teal-500">
                    {value.icon}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                    {value.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                    {value.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Statistics */}
          <div className="glass-strong p-10 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 mb-20">
            <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
              Our Impact
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {[
                { number: '500+', label: 'Active Associations' },
                { number: '50,000+', label: 'Members Managed' },
                { number: '₦2B+', label: 'Funds Tracked' },
                { number: '99.9%', label: 'Uptime' }
              ].map((stat, idx) => (
                <div key={idx} className="text-center">
                  <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
                    {stat.number}
                  </div>
                  <div className="text-gray-600 dark:text-gray-300 font-medium">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Who We Serve */}
          <div className="mb-20">
            <h2 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-6">
              Who We Serve
            </h2>
            <p className="text-xl text-center text-gray-600 dark:text-gray-300 mb-12 max-w-3xl mx-auto">
              SocietyLedger is built for diverse organizations across Africa
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              {[
                'Cooperative Societies',
                'Homeowners Associations (HOAs)',
                'Town Unions',
                'Religious Organizations',
                'Social Clubs',
                'Professional Associations',
                'Alumni Groups',
                'Community Development Associations',
                'Investment Clubs'
              ].map((org, idx) => (
                <div key={idx} className="glass-strong p-6 rounded-xl border border-gray-200/50 dark:border-gray-700/50 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <IconAward className="text-teal-500" size={20} />
                    <span className="font-semibold text-gray-700 dark:text-gray-200">
                      {org}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA Section */}
          <div className="glass-strong p-10 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Ready to Transform Your Association?
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
              Join hundreds of associations already using SocietyLedger to manage their operations with transparency and efficiency.
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
                href="/contact"
                size="lg"
                variant="outline"
                className="border-2 border-teal-500 text-teal-600 dark:text-teal-400"
              >
                Contact Us
              </Button>
            </div>
          </div>
        </Container>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
