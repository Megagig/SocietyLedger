'use client';

import { Button, Container, Accordion } from '@mantine/core';
import { IconUsers, IconQuestionMark, IconArrowRight } from '@tabler/icons-react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function FAQPage() {
  const faqs = [
    {
      category: 'General',
      questions: [
        {
          question: 'What is SocietyLedger?',
          answer: 'SocietyLedger is a comprehensive SaaS platform designed for managing associations, cooperatives, HOAs, town unions, and community organizations across Africa. We provide tools for member management, financial tracking, dues collection, welfare funds, SMS communications, and more.'
        },
        {
          question: 'Who is SocietyLedger for?',
          answer: 'SocietyLedger is perfect for cooperative societies, homeowners associations (HOAs), town unions, religious organizations, social clubs, professional associations, alumni groups, and any community organization that needs to manage members and finances.'
        },
        {
          question: 'Is SocietyLedger available in Nigeria?',
          answer: 'Yes! SocietyLedger is built specifically for African associations with a primary focus on Nigeria. We support Nigerian payment methods, SMS providers, and understand the unique needs of Nigerian organizations.'
        },
        {
          question: 'Do I need technical skills to use SocietyLedger?',
          answer: 'No technical skills required! SocietyLedger is designed to be user-friendly and intuitive. If you can use WhatsApp or Facebook, you can use SocietyLedger. We also provide training and support to help you get started.'
        }
      ]
    },
    {
      category: 'Pricing & Plans',
      questions: [
        {
          question: 'How much does SocietyLedger cost?',
          answer: 'We offer flexible pricing starting from ₦5,000/month for small associations (up to 50 members), ₦15,000/month for growing associations (up to 200 members), and custom enterprise pricing for larger organizations. All plans include a 14-day free trial.'
        },
        {
          question: 'Is there a free trial?',
          answer: 'Yes! We offer a 14-day free trial with full access to all features. No credit card required to start your trial. You can explore the platform and see if it fits your needs before committing.'
        },
        {
          question: 'Can I change plans later?',
          answer: 'Absolutely! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and we will prorate any charges or credits to your account.'
        },
        {
          question: 'What payment methods do you accept?',
          answer: 'We accept bank transfers, card payments (via Paystack), and USSD payments. All payments are processed securely through our payment partners.'
        }
      ]
    },
    {
      category: 'Features',
      questions: [
        {
          question: 'What features are included?',
          answer: 'SocietyLedger includes member management, dues and levies tracking, welfare fund management, financial reporting, SMS and email notifications, role-based access control, document storage, meeting management, elections, and much more. Check our Features page for a complete list.'
        },
        {
          question: 'Can I manage multiple associations?',
          answer: 'Yes! You can create and manage multiple associations from a single account. Each association has its own separate data, members, and financial records.'
        },
        {
          question: 'Does it support welfare funds?',
          answer: 'Yes! We have a comprehensive welfare fund module that allows you to create multiple funds, track contributions, manage payout requests, set eligibility rules, and generate reports. This is perfect for bereavement, medical, education, and other welfare schemes.'
        },
        {
          question: 'Can I send SMS to members?',
          answer: 'Yes! SocietyLedger integrates with Termii SMS gateway to send bulk SMS, payment reminders, announcements, and custom messages to your members. SMS credits are purchased separately based on your needs.'
        }
      ]
    },
    {
      category: 'Technical',
      questions: [
        {
          question: 'Is my data secure?',
          answer: 'Absolutely! We use bank-level encryption (SSL/TLS) to protect your data in transit and at rest. We implement role-based access control, regular backups, and follow industry best practices for security. Your data is stored securely in the cloud with 99.9% uptime.'
        },
        {
          question: 'Can I export my data?',
          answer: 'Yes! You can export your data at any time in CSV or Excel format. This includes member lists, financial reports, transaction history, and more. You own your data and can take it with you if needed.'
        },
        {
          question: 'Do you have a mobile app?',
          answer: 'SocietyLedger is a Progressive Web App (PWA), which means it works perfectly on mobile browsers and can be installed on your phone like a native app. We\'re also working on dedicated iOS and Android apps coming soon!'
        },
        {
          question: 'What browsers are supported?',
          answer: 'SocietyLedger works on all modern browsers including Chrome, Firefox, Safari, and Edge. For the best experience, we recommend using the latest version of Chrome or Safari.'
        }
      ]
    },
    {
      category: 'Setup & Support',
      questions: [
        {
          question: 'How long does setup take?',
          answer: 'You can set up your association in as little as 10 minutes! Our onboarding wizard guides you through creating your association profile, adding members, and configuring your financial settings. You can start using SocietyLedger immediately after setup.'
        },
        {
          question: 'Do you provide training?',
          answer: 'Yes! We provide comprehensive documentation, video tutorials, and live training sessions for new users. Our support team is also available to answer questions and help you get the most out of SocietyLedger.'
        },
        {
          question: 'What support options are available?',
          answer: 'We offer email support (support@societyledger.com.ng) with 24-hour response time, live chat during business hours, comprehensive documentation, and video tutorials. Professional and Enterprise plans include priority support and dedicated account managers.'
        },
        {
          question: 'Can I import existing data?',
          answer: 'Yes! We can help you import your existing member data, financial records, and transaction history from Excel spreadsheets or other systems. Contact our support team for assistance with data migration.'
        }
      ]
    }
  ];

  // Generate FAQ Schema for SEO
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.flatMap(section => 
      section.questions.map(q => ({
        '@type': 'Question',
        name: q.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: q.answer,
        },
      }))
    ),
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-teal-50/30 to-green-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* JSON-LD FAQ Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      
      {/* Navigation */}
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
              <Button component={Link} href="/" variant="subtle">
                Back to Home
              </Button>
            </div>
          </div>
        </Container>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-12 px-4">
        <Container size="lg">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-500/20 to-green-500/20 border border-teal-500/30 mb-6">
              <IconQuestionMark className="text-teal-500" size={40} />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent">
                Frequently Asked Questions
              </span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Find answers to common questions about SocietyLedger. Cannot find what you are looking for? Contact our support team.
            </p>
          </div>
        </Container>
      </section>

      {/* FAQ Sections */}
      <section className="pb-20 px-4">
        <Container size="lg">
          {faqs.map((section, idx) => (
            <div key={idx} className="mb-12">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
                {section.category}
              </h2>
              <Accordion 
                variant="separated"
                classNames={{
                  item: 'glass-strong border border-gray-200/50 dark:border-gray-700/50 rounded-xl mb-4',
                  control: 'hover:bg-teal-50/50 dark:hover:bg-teal-900/20',
                  label: 'text-lg font-semibold text-gray-900 dark:text-white',
                  content: 'text-gray-600 dark:text-gray-300 leading-relaxed',
                }}
              >
                {section.questions.map((faq, qIdx) => (
                  <Accordion.Item key={qIdx} value={`${idx}-${qIdx}`}>
                    <Accordion.Control>{faq.question}</Accordion.Control>
                    <Accordion.Panel>{faq.answer}</Accordion.Panel>
                  </Accordion.Item>
                ))}
              </Accordion>
            </div>
          ))}
        </Container>
      </section>

      {/* Still Have Questions CTA */}
      <section className="pb-20 px-4">
        <Container size="lg">
          <div className="glass-strong p-10 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Still Have Questions?
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
              Our support team is here to help. Get in touch and we will respond within 24 hours.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button 
                component={Link}
                href="/contact"
                size="lg"
                className="bg-gradient-to-r from-teal-500 to-green-500 hover:from-teal-600 hover:to-green-600"
                rightSection={<IconArrowRight size={20} />}
              >
                Contact Support
              </Button>
              <Button 
                component={Link}
                href="/documentation"
                size="lg"
                variant="outline"
                className="border-2 border-teal-500 text-teal-600 dark:text-teal-400"
              >
                View Documentation
              </Button>
            </div>
          </div>
        </Container>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-gray-200 dark:border-gray-800">
        <Container size="xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-green-500 flex items-center justify-center">
                <IconUsers className="text-white" size={20} />
              </div>
              <span className="font-bold text-gray-900 dark:text-white">
                SocietyLedger
              </span>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-600 dark:text-gray-400">
              <Link href="/" className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
                Home
              </Link>
              <Link href="/about" className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
                About
              </Link>
              <Link href="/contact" className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
                Contact
              </Link>
              <Link href="/privacy" className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
                Terms of Service
              </Link>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-400">
              © {new Date().getFullYear()} SocietyLedger
            </p>
          </div>
        </Container>
      </footer>
    </div>
  );
}
