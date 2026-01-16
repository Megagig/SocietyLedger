import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Customer Testimonials',
  description: 'See what associations, cooperatives, and HOAs say about SocietyLedger. Real reviews from satisfied customers across Nigeria and Africa.',
  keywords: ['societyledger reviews', 'customer testimonials', 'user reviews', 'success stories'],
  openGraph: {
    title: 'Testimonials | SocietyLedger',
    description: 'Real reviews from SocietyLedger customers.',
    url: 'https://societyledger.com.ng/testimonials',
    type: 'website',
  },
  alternates: {
    canonical: 'https://societyledger.com.ng/testimonials',
  },
};

export default function TestimonialsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
