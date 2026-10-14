'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button, Container } from '@mantine/core';
import { IconUsers, IconLogin, IconMenu2, IconX } from '@tabler/icons-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAnalytics } from '@/hooks/useAnalytics';
import { docsUrl } from '@/lib/docs';

const navItems = [
  { label: 'Features', href: '/features' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'About', href: '/about' },
  { label: 'Blog', href: '/blog' },
  { label: 'Docs', href: docsUrl('/docs', 'web_header'), external: true },
  { label: 'Contact', href: '/contact' },
];

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { trackSignUpClick, trackLoginClick } = useAnalytics();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <nav className="glass-strong fixed top-0 left-0 right-0 z-50 border-b border-gray-200/50 dark:border-gray-700/50">
      <Container size="xl" className="py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0 no-underline">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-green-500 flex items-center justify-center">
              <IconUsers className="text-white" size={24} />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent">
              SocietyLedger
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                target={item.external ? '_blank' : undefined}
                rel={item.external ? 'noopener noreferrer' : undefined}
                className={`px-4 py-2.5 rounded-lg text-[15px] font-semibold transition-all duration-200 no-underline ${
                  !item.external && isActive(item.href)
                    ? 'bg-teal-500/15 text-teal-600 dark:text-teal-400'
                    : 'text-gray-700 dark:text-gray-200 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-gray-100/80 dark:hover:bg-gray-800/80'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-3 shrink-0">
            <ThemeToggle />
            
            {/* Desktop Auth Buttons */}
            <Button
              component={Link}
              href="/auth/login"
              variant="subtle"
              size="md"
              leftSection={<IconLogin size={18} />}
              className="hidden md:flex font-semibold"
              onClick={() => trackLoginClick('Header')}
            >
              Login
            </Button>
            <Button
              component={Link}
              href="/signup"
              size="md"
              className="hidden sm:flex bg-gradient-to-r from-teal-500 to-green-500 hover:from-teal-600 hover:to-green-600 font-semibold"
              onClick={() => trackSignUpClick('Header')}
            >
              Get Started
            </Button>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <IconX size={24} /> : <IconMenu2 size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden mt-4 pb-4 border-t border-gray-200/50 dark:border-gray-700/50 pt-4">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  target={item.external ? '_blank' : undefined}
                  rel={item.external ? 'noopener noreferrer' : undefined}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-3.5 rounded-lg text-base font-semibold transition-colors no-underline ${
                    !item.external && isActive(item.href)
                      ? 'bg-teal-500/15 text-teal-600 dark:text-teal-400'
                      : 'text-gray-700 dark:text-gray-200 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              
              {/* Mobile Auth Buttons */}
              <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50 sm:hidden">
                <Button
                  component={Link}
                  href="/auth/login"
                  variant="outline"
                  size="md"
                  leftSection={<IconLogin size={18} />}
                  fullWidth
                  onClick={() => {
                    trackLoginClick('Mobile Menu');
                    setMobileMenuOpen(false);
                  }}
                >
                  Login
                </Button>
                <Button
                  component={Link}
                  href="/signup"
                  size="md"
                  fullWidth
                  className="bg-gradient-to-r from-teal-500 to-green-500 hover:from-teal-600 hover:to-green-600"
                  onClick={() => {
                    trackSignUpClick('Mobile Menu');
                    setMobileMenuOpen(false);
                  }}
                >
                  Get Started
                </Button>
              </div>
            </div>
          </div>
        )}
      </Container>
    </nav>
  );
}
