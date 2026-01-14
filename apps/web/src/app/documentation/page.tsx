'use client';

import { Container, Button } from '@mantine/core';
import { IconUsers, IconBook, IconRocket, IconSettings, IconChartBar, IconArrowRight } from '@tabler/icons-react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function DocumentationPage() {
  const docSections = [
    {
      icon: <IconRocket size={32} />,
      title: 'Getting Started',
      description: 'Quick start guide to set up your association',
      topics: ['Create Account', 'Association Setup', 'Add Members', 'Configure Settings']
    },
    {
      icon: <IconUsers size={32} />,
      title: 'Member Management',
      description: 'Learn how to manage your members effectively',
      topics: ['Add Members', 'Member Profiles', 'Bulk Operations', 'Member Status']
    },
    {
      icon: <IconChartBar size={32} />,
      title: 'Financial Management',
      description: 'Track finances, dues, and levies',
      topics: ['Dues Setup', 'Payment Tracking', 'Financial Reports', 'Welfare Funds']
    },
    {
      icon: <IconSettings size={32} />,
      title: 'Advanced Features',
      description: 'Explore advanced capabilities',
      topics: ['SMS Notifications', 'Role Permissions', 'Elections', 'API Access']
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-teal-50/30 to-green-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <nav className="glass-strong fixed top-0 left-0 right-0 z-50 border-b border-gray-200/50 dark:border-gray-700/50">
        <Container size="xl" className="py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-green-500 flex items-center justify-center">
                <IconUsers className="text-white" size={24} />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent">
                SocietyLedger
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <Button component={Link} href="/" variant="subtle">Back to Home</Button>
            </div>
          </div>
        </Container>
      </nav>

      <section className="pt-32 pb-12 px-4">
        <Container size="lg">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-500/20 to-green-500/20 border border-teal-500/30 mb-6">
              <IconBook className="text-teal-500" size={40} />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent">
                Documentation
              </span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Everything you need to know about using SocietyLedger. From setup to advanced features.
            </p>
          </div>
        </Container>
      </section>

      <section className="pb-20 px-4">
        <Container size="lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {docSections.map((section, idx) => (
              <div key={idx} className="glass-strong p-8 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 hover:shadow-xl transition-all">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500/20 to-green-500/20 border border-teal-500/30 flex items-center justify-center mb-6 text-teal-500">
                  {section.icon}
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                  {section.title}
                </h2>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  {section.description}
                </p>
                <ul className="space-y-2">
                  {section.topics.map((topic, tIdx) => (
                    <li key={tIdx} className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                      <div className="w-1.5 h-1.5 rounded-full bg-teal-500"></div>
                      {topic}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="glass-strong p-10 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Need More Help?
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
              Can't find what you're looking for? Check our FAQ or contact our support team.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button 
                component={Link}
                href="/faq"
                size="lg"
                className="bg-gradient-to-r from-teal-500 to-green-500 hover:from-teal-600 hover:to-green-600"
                rightSection={<IconArrowRight size={20} />}
              >
                View FAQ
              </Button>
              <Button 
                component={Link}
                href="/contact"
                size="lg"
                variant="outline"
                className="border-2 border-teal-500 text-teal-600 dark:text-teal-400"
              >
                Contact Support
              </Button>
            </div>
          </div>
        </Container>
      </section>

      <footer className="py-12 px-4 border-t border-gray-200 dark:border-gray-800">
        <Container size="xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-green-500 flex items-center justify-center">
                <IconUsers className="text-white" size={20} />
              </div>
              <span className="font-bold text-gray-900 dark:text-white">SocietyLedger</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">© {new Date().getFullYear()} SocietyLedger</p>
          </div>
        </Container>
      </footer>
    </div>
  );
}
