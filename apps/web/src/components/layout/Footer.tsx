'use client';

import Link from 'next/link';
import { IconUsers, IconBrandFacebook, IconBrandInstagram, IconBrandLinkedin, IconBrandX, IconBrandYoutube, IconPhone, IconMail, IconBrandWhatsapp } from '@tabler/icons-react';

export default function Footer() {
  return (
    <footer className="bg-gray-900 dark:bg-black text-white py-12 px-4 border-t border-gray-800">
      <div className="max-w-7xl mx-auto">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Logo and Info Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-green-500 flex items-center justify-center">
                <IconUsers className="text-white" size={20} />
              </div>
              <span className="font-bold text-xl">SocietyLedger</span>
            </div>
            
            <p className="text-gray-400 text-sm leading-relaxed">
              Empowering associations with seamless management solutions for efficient operations and growth.
            </p>

            {/* Contact Info */}
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-400">
                <IconPhone size={16} />
                <a 
                  href="tel:+2348060374755" 
                  className="hover:text-teal-400 transition-colors"
                >
                  +234 806 037 4755
                </a>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <IconBrandWhatsapp size={16} />
                <a 
                  href="https://wa.me/2348060374755" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-teal-400 transition-colors"
                >
                  WhatsApp
                </a>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <IconMail size={16} />
                <a 
                  href="mailto:support@societyledger.com.ng" 
                  className="hover:text-teal-400 transition-colors"
                >
                  support@societyledger.com.ng
                </a>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-white mb-4">Quick links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/features" className="text-gray-400 hover:text-teal-400 transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-gray-400 hover:text-teal-400 transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-gray-400 hover:text-teal-400 transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-gray-400 hover:text-teal-400 transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-gray-400 hover:text-teal-400 transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/documentation" className="text-gray-400 hover:text-teal-400 transition-colors">
                  Documentation
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-gray-400 hover:text-teal-400 transition-colors">
                  Blog
                </Link>
              </li>
            </ul>
          </div>

          {/* Social */}
          <div>
            <h3 className="font-semibold text-white mb-4">Social</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a 
                  href="https://facebook.com/societyledger" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-teal-400 transition-colors flex items-center gap-2"
                >
                  <IconBrandFacebook size={18} />
                  Facebook
                </a>
              </li>
              <li>
                <a 
                  href="https://instagram.com/societyledger" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-teal-400 transition-colors flex items-center gap-2"
                >
                  <IconBrandInstagram size={18} />
                  Instagram
                </a>
              </li>
              <li>
                <a 
                  href="https://linkedin.com/company/societyledger" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-teal-400 transition-colors flex items-center gap-2"
                >
                  <IconBrandLinkedin size={18} />
                  LinkedIn
                </a>
              </li>
              <li>
                <a 
                  href="https://x.com/societyledger" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-teal-400 transition-colors flex items-center gap-2"
                >
                  <IconBrandX size={18} />
                  X
                </a>
              </li>
              <li>
                <a 
                  href="https://youtube.com/@societyledger" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-teal-400 transition-colors flex items-center gap-2"
                >
                  <IconBrandYoutube size={18} />
                  Youtube
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold text-white mb-4">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/privacy" className="text-gray-400 hover:text-teal-400 transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-gray-400 hover:text-teal-400 transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-gray-800 text-center">
          <p className="text-sm text-gray-400">
            © {new Date().getFullYear()} SocietyLedger. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
