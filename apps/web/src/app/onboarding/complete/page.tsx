'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { API_ROUTES } from '@/utils/constants';
import confetti from 'canvas-confetti';

const quickActions = [
  {
    title: 'Add Your First Member',
    description: 'Start building your member directory',
    icon: 'users',
    href: '/dashboard/members/new',
    color: 'bg-blue-500',
  },
  {
    title: 'Create a Transaction',
    description: 'Record dues, levies, or donations',
    icon: 'cash',
    href: '/dashboard/transactions/new',
    color: 'bg-green-500',
  },
  {
    title: 'View Dashboard',
    description: 'See your association overview',
    icon: 'chart',
    href: '/dashboard',
    color: 'bg-purple-500',
  },
  {
    title: 'Manage Settings',
    description: 'Customize your association',
    icon: 'settings',
    href: '/dashboard/settings',
    color: 'bg-orange-500',
  },
];

const helpResources = [
  { title: 'Getting Started Guide', href: '#' },
  { title: 'Video Tutorials', href: '#' },
  { title: 'FAQ', href: '#' },
  { title: 'Contact Support', href: '#' },
];

export default function CompletePage() {
  const router = useRouter();
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    // Trigger confetti on mount
    const duration = 3 * 1000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#14b8a6', '#10b981', '#22c55e'],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#14b8a6', '#10b981', '#22c55e'],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    frame();
  }, []);

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await api.patch(
        API_ROUTES.ONBOARDING.COMPLETE_STEP,
        { step: 5, stepName: 'complete' }
      );
      router.push('/dashboard');
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      router.push('/dashboard');
    }
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'users':
        return <UsersIcon />;
      case 'cash':
        return <CashIcon />;
      case 'chart':
        return <ChartIcon />;
      case 'settings':
        return <SettingsIcon />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Success Header */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-gradient-to-r from-teal-500 to-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <CheckIcon className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            🎉 You're All Set!
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            Your association is ready to go. Start managing your members and finances with ease.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Quick Actions
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={() => router.push(action.href)}
                className="flex items-start gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
              >
                <div className={`w-10 h-10 ${action.color} rounded-lg flex items-center justify-center text-white flex-shrink-0`}>
                  {getIcon(action.icon)}
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{action.title}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{action.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Help Resources */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Need Help?
          </h2>
          <div className="grid md:grid-cols-2 gap-3">
            {helpResources.map((resource, index) => (
              <a
                key={index}
                href={resource.href}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <BookIcon className="w-5 h-5 text-teal-500" />
                <span className="text-gray-700 dark:text-gray-300">{resource.title}</span>
              </a>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <button
            onClick={handleComplete}
            disabled={completing}
            className="px-8 py-4 bg-gradient-to-r from-teal-500 to-green-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-green-600 transition-all shadow-lg hover:shadow-xl text-lg disabled:opacity-50"
          >
            {completing ? 'Loading...' : 'Go to Dashboard →'}
          </button>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            You can always access these resources from your dashboard
          </p>
        </div>
      </div>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function CashIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function BookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}
