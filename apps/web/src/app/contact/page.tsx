'use client';

import { Button, Container, TextInput, Textarea } from '@mantine/core';
import { 
  IconMail, 
  IconPhone, 
  IconMapPin, 
  IconBrandTwitter, 
  IconBrandFacebook, 
  IconBrandLinkedin,
  IconUsers,
  IconSend
} from '@tabler/icons-react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import Footer from '@/components/layout/Footer';
import Header from '@/components/layout/Header';
import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import { useAnalytics } from '@/hooks/useAnalytics';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    organization: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const { trackContactFormSubmit } = useAnalytics();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Track form submission
    trackContactFormSubmit();
    
    // Simulate form submission
    setTimeout(() => {
      notifications.show({
        title: 'Message Sent!',
        message: 'Thank you for contacting us. We\'ll get back to you within 24 hours.',
        color: 'teal',
      });
      setFormData({ name: '', email: '', organization: '', message: '' });
      setLoading(false);
    }, 1000);
  };

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
                Get in Touch
              </span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Have questions about SocietyLedger? We&apos;re here to help. Reach out to our team and we&apos;ll respond within 24 hours.
            </p>
          </div>
        </Container>
      </section>

      {/* Contact Form & Info Section */}
      <section className="pb-20 px-4">
        <Container size="lg">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Contact Information */}
            <div className="lg:col-span-1 space-y-6">
              <div className="glass-strong p-6 rounded-2xl border border-gray-200/50 dark:border-gray-700/50">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500/20 to-green-500/20 border border-teal-500/30 flex items-center justify-center flex-shrink-0">
                    <IconMail className="text-teal-500" size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white mb-2">Email Us</h3>
                    <a href="mailto:support@societyledger.com.ng" className="text-teal-600 dark:text-teal-400 hover:underline">
                      support@societyledger.com.ng
                    </a>
                  </div>
                </div>
              </div>

              <div className="glass-strong p-6 rounded-2xl border border-gray-200/50 dark:border-gray-700/50">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500/20 to-green-500/20 border border-teal-500/30 flex items-center justify-center flex-shrink-0">
                    <IconPhone className="text-teal-500" size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white mb-2">Call Us</h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      Mon-Fri: 9am - 5pm WAT
                    </p>
                  </div>
                </div>
              </div>

              <div className="glass-strong p-6 rounded-2xl border border-gray-200/50 dark:border-gray-700/50">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500/20 to-green-500/20 border border-teal-500/30 flex items-center justify-center flex-shrink-0">
                    <IconMapPin className="text-teal-500" size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white mb-2">Location</h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      Lagos, Nigeria
                    </p>
                  </div>
                </div>
              </div>

              {/* Social Media */}
              <div className="glass-strong p-6 rounded-2xl border border-gray-200/50 dark:border-gray-700/50">
                <h3 className="font-bold text-gray-900 dark:text-white mb-4">Follow Us</h3>
                <div className="flex gap-3">
                  <a href="https://twitter.com/societyledger" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 flex items-center justify-center transition-colors">
                    <IconBrandTwitter className="text-teal-500" size={20} />
                  </a>
                  <a href="https://facebook.com/societyledger" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 flex items-center justify-center transition-colors">
                    <IconBrandFacebook className="text-teal-500" size={20} />
                  </a>
                  <a href="https://linkedin.com/company/societyledger" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 flex items-center justify-center transition-colors">
                    <IconBrandLinkedin className="text-teal-500" size={20} />
                  </a>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="lg:col-span-2">
              <div className="glass-strong p-8 rounded-2xl border border-gray-200/50 dark:border-gray-700/50">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Send us a Message</h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <TextInput
                    label="Your Name"
                    placeholder="John Doe"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    size="md"
                  />
                  
                  <TextInput
                    label="Email Address"
                    placeholder="john@example.com"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    size="md"
                  />
                  
                  <TextInput
                    label="Organization Name"
                    placeholder="Your Association or Cooperative"
                    value={formData.organization}
                    onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                    size="md"
                  />
                  
                  <Textarea
                    label="Message"
                    placeholder="Tell us how we can help you..."
                    required
                    minRows={6}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    size="md"
                  />
                  
                  <Button 
                    type="submit"
                    size="lg"
                    loading={loading}
                    rightSection={<IconSend size={18} />}
                    className="bg-gradient-to-r from-teal-500 to-green-500 hover:from-teal-600 hover:to-green-600"
                  >
                    Send Message
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* FAQ Link Section */}
      <section className="pb-20 px-4">
        <Container size="lg">
          <div className="glass-strong p-8 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 text-center">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Looking for Quick Answers?
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Check out our FAQ page for answers to common questions
            </p>
            <Button 
              component={Link}
              href="/faq"
              size="lg"
              variant="outline"
              className="border-2 border-teal-500 text-teal-600 dark:text-teal-400"
            >
              View FAQ
            </Button>
          </div>
        </Container>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
