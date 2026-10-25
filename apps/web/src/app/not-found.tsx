'use client';

import { Container, Button, TextInput } from '@mantine/core';
import { BrandMark } from '@/components/brand/BrandLogo';
import { IconSearch, IconHome, IconArrowLeft, IconMail } from '@tabler/icons-react';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NotFound() {
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  const popularPages = [
    { name: 'Home', href: '/', icon: <IconHome size={20} /> },
    { name: 'Features', href: '/features', icon: <IconSearch size={20} /> },
    { name: 'Pricing', href: '/pricing', icon: <IconSearch size={20} /> },
    { name: 'Contact Us', href: '/contact', icon: <IconMail size={20} /> },
    { name: 'FAQ', href: '/faq', icon: <IconSearch size={20} /> },
    { name: 'Documentation', href: '/documentation', icon: <IconSearch size={20} /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-teal-50/30 to-green-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex items-center justify-center px-4">
      <Container size="md">
        <div className="text-center">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Link href="/" className="flex items-center gap-2">
              <BrandMark size={64} />
            </Link>
          </div>

          {/* 404 Message */}
          <div className="mb-8">
            <h1 className="text-9xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-4">
              404
            </h1>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Page Not Found
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Oops! The page you are looking for does not exist. It might have been moved or deleted.
            </p>
          </div>

          {/* Search Bar */}
          <div className="glass-strong p-6 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Search for what you need
            </h3>
            <form onSubmit={handleSearch} className="flex gap-2">
              <TextInput
                placeholder="Search SocietyLedger..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                size="lg"
                className="flex-1"
                leftSection={<IconSearch size={20} />}
              />
              <Button 
                type="submit"
                size="lg"
                className="bg-gradient-to-r from-teal-500 to-green-500 hover:from-teal-600 hover:to-green-600"
              >
                Search
              </Button>
            </form>
          </div>

          {/* Popular Pages */}
          <div className="glass-strong p-6 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Popular Pages
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {popularPages.map((page) => (
                <Link
                  key={page.href}
                  href={page.href}
                  className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors text-gray-700 dark:text-gray-300 hover:text-teal-600 dark:hover:text-teal-400"
                >
                  {page.icon}
                  <span className="font-medium">{page.name}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Button
              component={Link}
              href="/"
              size="lg"
              leftSection={<IconHome size={20} />}
              className="bg-gradient-to-r from-teal-500 to-green-500 hover:from-teal-600 hover:to-green-600"
            >
              Go to Homepage
            </Button>
            <Button
              onClick={() => router.back()}
              size="lg"
              variant="outline"
              leftSection={<IconArrowLeft size={20} />}
              className="border-2 border-teal-500 text-teal-600 dark:text-teal-400"
            >
              Go Back
            </Button>
          </div>

          {/* Report Broken Link */}
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Think this is a mistake?
            </p>
            <Link
              href="/contact"
              className="text-teal-600 dark:text-teal-400 hover:underline font-medium"
            >
              Report a broken link
            </Link>
          </div>
        </div>
      </Container>
    </div>
  );
}
