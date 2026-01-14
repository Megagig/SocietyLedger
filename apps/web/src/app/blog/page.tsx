'use client';

import { Container, Button } from '@mantine/core';
import { IconUsers, IconArticle, IconArrowRight, IconCalendar, IconClock } from '@tabler/icons-react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function BlogPage() {
  const blogPosts = [
    {
      title: 'How to Manage Cooperative Finances in Nigeria',
      excerpt: 'A comprehensive guide to managing cooperative society finances, tracking contributions, and maintaining transparency with your members.',
      date: 'January 10, 2026',
      readTime: '8 min read',
      category: 'Finance',
      slug: 'manage-cooperative-finances-nigeria'
    },
    {
      title: '5 Best Practices for HOA Management',
      excerpt: 'Learn the essential practices that successful homeowners associations use to maintain harmony, collect dues, and manage community resources.',
      date: 'January 8, 2026',
      readTime: '6 min read',
      category: 'Management',
      slug: 'hoa-management-best-practices'
    },
    {
      title: 'Digital Transformation for Town Unions',
      excerpt: 'Discover how town unions across Nigeria are embracing digital tools to improve member engagement, financial transparency, and operational efficiency.',
      date: 'January 5, 2026',
      readTime: '7 min read',
      category: 'Technology',
      slug: 'digital-transformation-town-unions'
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
              <IconArticle className="text-teal-500" size={40} />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent">
                Blog
              </span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Tips, guides, and insights on association management, cooperative finance, and community leadership.
            </p>
          </div>
        </Container>
      </section>

      <section className="pb-20 px-4">
        <Container size="lg">
          <div className="space-y-8">
            {blogPosts.map((post, idx) => (
              <div key={idx} className="glass-strong p-8 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 hover:shadow-xl transition-all">
                <div className="flex items-center gap-4 mb-4">
                  <span className="px-3 py-1 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 text-sm font-medium">
                    {post.category}
                  </span>
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <IconCalendar size={16} />
                    {post.date}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <IconClock size={16} />
                    {post.readTime}
                  </div>
                </div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                  {post.title}
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                  {post.excerpt}
                </p>
                <Button 
                  variant="subtle"
                  className="text-teal-600 dark:text-teal-400"
                  rightSection={<IconArrowRight size={18} />}
                >
                  Read More
                </Button>
              </div>
            ))}
          </div>

          <div className="mt-12 glass-strong p-10 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Stay Updated
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
              More articles coming soon! Follow us on social media for the latest updates.
            </p>
            <Button 
              component={Link}
              href="/signup"
              size="lg"
              className="bg-gradient-to-r from-teal-500 to-green-500 hover:from-teal-600 hover:to-green-600"
              rightSection={<IconArrowRight size={20} />}
            >
              Start Free Trial
            </Button>
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
