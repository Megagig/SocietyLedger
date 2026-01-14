'use client';

import { Container, Button } from '@mantine/core';
import { IconUsers, IconStar, IconArrowRight } from '@tabler/icons-react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function TestimonialsPage() {
  const testimonials = [
    {
      name: 'Chidi Okafor',
      role: 'Treasurer',
      organization: 'Igbo Town Union Lagos',
      type: 'Town Union',
      location: 'Lagos, Nigeria',
      rating: 5,
      quote: 'SocietyLedger has transformed how we manage our town union finances. Everything is transparent, and members can see exactly where their money goes. No more Excel spreadsheets!',
      image: null
    },
    {
      name: 'Amina Mohammed',
      role: 'Secretary',
      organization: 'Kaduna Women Cooperative',
      type: 'Cooperative Society',
      location: 'Kaduna, Nigeria',
      rating: 5,
      quote: 'The welfare fund feature is amazing! We can now track contributions and process payout requests efficiently. Our members love the SMS notifications.',
      image: null
    },
    {
      name: 'Pastor David Adeyemi',
      role: 'Administrator',
      organization: 'Grace Chapel',
      type: 'Religious Organization',
      location: 'Ibadan, Nigeria',
      rating: 5,
      quote: 'Managing our church finances has never been easier. The reporting features help us maintain transparency with our congregation. Highly recommended!',
      image: null
    },
    {
      name: 'Mrs. Ngozi Eze',
      role: 'Chairman',
      organization: 'Lekki Gardens Estate',
      type: 'HOA',
      location: 'Lagos, Nigeria',
      rating: 5,
      quote: 'As an HOA chairman, I needed a system that could handle dues, levies, and service charges. SocietyLedger does all this and more. The support team is also very responsive.',
      image: null
    },
    {
      name: 'Alhaji Musa Ibrahim',
      role: 'President',
      organization: 'Kano Traders Association',
      type: 'Professional Association',
      location: 'Kano, Nigeria',
      rating: 5,
      quote: 'We manage over 300 members and SocietyLedger makes it effortless. The bulk SMS feature helps us communicate important updates instantly.',
      image: null
    },
    {
      name: 'Dr. Funmi Adebayo',
      role: 'Coordinator',
      organization: 'UI Alumni Association',
      type: 'Alumni Group',
      location: 'Ibadan, Nigeria',
      rating: 5,
      quote: 'Perfect for alumni associations! We can track member contributions, organize events, and keep everyone informed. The platform is intuitive and easy to use.',
      image: null
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
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent">
                What Our Customers Say
              </span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Trusted by hundreds of associations across Nigeria. Here's what they have to say about SocietyLedger.
            </p>
          </div>
        </Container>
      </section>

      <section className="pb-20 px-4">
        <Container size="lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {testimonials.map((testimonial, idx) => (
              <div key={idx} className="glass-strong p-8 rounded-2xl border border-gray-200/50 dark:border-gray-700/50">
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <IconStar key={i} size={20} className="text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-lg text-gray-700 dark:text-gray-300 mb-6 leading-relaxed italic">
                  "{testimonial.quote}"
                </p>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-500 to-green-500 flex items-center justify-center text-white font-bold text-lg">
                    {testimonial.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 dark:text-white">{testimonial.name}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">{testimonial.role}</div>
                    <div className="text-sm text-teal-600 dark:text-teal-400">{testimonial.organization}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {testimonial.type} • {testimonial.location}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="pb-20 px-4">
        <Container size="lg">
          <div className="glass-strong p-10 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Join Hundreds of Satisfied Associations
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
              Start your free 14-day trial today and see why associations across Nigeria trust SocietyLedger.
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
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-600 dark:text-gray-400">
              <Link href="/" className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors">Home</Link>
              <Link href="/about" className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors">About</Link>
              <Link href="/contact" className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors">Contact</Link>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">© {new Date().getFullYear()} SocietyLedger</p>
          </div>
        </Container>
      </footer>
    </div>
  );
}
