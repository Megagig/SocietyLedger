'use client';

import { Container, Button } from '@mantine/core';
import Footer from '@/components/layout/Footer';
import Header from '@/components/layout/Header';
import { IconCode } from '@tabler/icons-react';
import Link from 'next/link';

/** Licences are the ones each package declares in its own package.json; the full text ships with each package. */
const GROUPS: { title: string; blurb: string; items: { name: string; license: string }[] }[] = [
  {
    title: 'App framework',
    blurb: 'The foundation the SocietyLedger mobile app runs on.',
    items: [
      { name: 'React', license: 'MIT' },
      { name: 'React Native', license: 'MIT' },
      { name: 'Expo (SDK and modules: Router, Notifications, Secure Store, Local Authentication, Image Picker, File System, Sharing, Web Browser, Updates and others)', license: 'MIT' },
      { name: 'React Native Screens, Gesture Handler, Reanimated, Worklets, Safe Area Context, SVG', license: 'MIT' },
      { name: 'React Native MMKV', license: 'MIT' },
      { name: 'FlashList', license: 'MIT' },
    ],
  },
  {
    title: 'Data, forms and state',
    blurb: 'How the app loads, validates and keeps your information.',
    items: [
      { name: 'TanStack Query', license: 'MIT' },
      { name: 'React Hook Form and its resolvers', license: 'MIT' },
      { name: 'Zod', license: 'MIT' },
      { name: 'Zustand', license: 'MIT' },
      { name: 'Axios', license: 'MIT' },
      { name: 'date-fns', license: 'MIT' },
      { name: 'decimal.js-light', license: 'MIT' },
    ],
  },
  {
    title: 'Design and interface',
    blurb: 'Styling, components, icons and typefaces.',
    items: [
      { name: 'NativeWind and Tailwind CSS', license: 'MIT' },
      { name: 'Gorhom Bottom Sheet', license: 'MIT' },
      { name: 'Sonner Native', license: 'MIT' },
      { name: 'React Native Gifted Charts', license: 'MIT' },
      { name: 'Lucide icons', license: 'ISC' },
      { name: 'Manrope typeface (Google Fonts package)', license: 'SIL Open Font Licence 1.1' },
    ],
  },
  {
    title: 'Monitoring',
    blurb: 'Crash and error reporting that helps us fix problems.',
    items: [{ name: 'Sentry for React Native', license: 'MIT' }],
  },
];

export default function LicensesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-teal-50/30 to-green-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <Header />

      <section className="pt-32 pb-12 px-4">
        <Container size="md">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-500/20 to-green-500/20 border border-teal-500/30 mb-6">
              <IconCode className="text-teal-500" size={40} />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent">
                Open-Source Licences
              </span>
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              SocietyLedger is built on the work of the open-source community. We are grateful to everyone who maintains these projects.
            </p>
          </div>
        </Container>
      </section>

      <section className="pb-20 px-4">
        <Container size="md">
          <div className="glass-strong p-10 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 prose prose-lg dark:prose-invert max-w-none">
            <h2>About these licences</h2>
            <p>
              The software below is used under the licence each project publishes. Most are permissive licences (MIT and ISC) that allow use in commercial products provided the
              copyright and licence notice are kept. The full licence text and copyright holders for each project are included with that project and available from its
              public repository. This list covers the main components of the mobile app and is not a complete list of every transitive dependency.
            </p>

            {GROUPS.map((group) => (
              <div key={group.title}>
                <h2>{group.title}</h2>
                <p>{group.blurb}</p>
                <ul>
                  {group.items.map((item) => (
                    <li key={item.name}>
                      {item.name} — <strong>{item.license}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <h2>The MIT licence in short</h2>
            <p>
              Permission is granted, free of charge, to any person obtaining a copy of the software and associated files to deal in the software without restriction,
              including the rights to use, copy, modify, merge, publish, distribute, sublicense and sell copies, subject to keeping the copyright notice and permission
              notice in all copies or substantial portions of the software. The software is provided &quot;as is&quot;, without warranty of any kind.
            </p>

            <h2>Questions</h2>
            <p>
              If you believe a notice is missing or incorrect, contact us at:
              <br />
              Email: legal@societyledger.com.ng
            </p>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button component={Link} href="/privacy" size="lg" variant="outline" className="border-2 border-teal-500 text-teal-600 dark:text-teal-400">
              Privacy Policy
            </Button>
            <Button component={Link} href="/terms" size="lg" variant="outline" className="border-2 border-teal-500 text-teal-600 dark:text-teal-400">
              Terms of Service
            </Button>
          </div>
        </Container>
      </section>

      <Footer />
    </div>
  );
}
