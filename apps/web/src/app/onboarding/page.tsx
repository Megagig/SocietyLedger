'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { API_ROUTES } from '@/utils/constants';

interface OnboardingStatus {
  onboarding: {
    id: number;
    currentStep: number;
    completedSteps: number[];
    profileCompleted: boolean;
    teamInvited: boolean;
    membersImported: boolean;
    financeConfigured: boolean;
    onboardingComplete: boolean;
    skippedAt: string | null;
  };
  context: {
    hasLogo: boolean;
    hasTeamMembers: boolean;
    hasMembers: boolean;
    hasFinancialSetup: boolean;
  };
}

const steps = [
  { id: 1, name: 'Profile', path: '/onboarding/profile', description: 'Set up your association profile' },
  { id: 2, name: 'Team', path: '/onboarding/team', description: 'Invite team members' },
  { id: 3, name: 'Members', path: '/onboarding/members', description: 'Import your members' },
  { id: 4, name: 'Finance', path: '/onboarding/finance', description: 'Configure financial settings' },
  { id: 5, name: 'Complete', path: '/onboarding/complete', description: 'Finish setup' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [skipping, setSkipping] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await api.get(API_ROUTES.ONBOARDING.STATUS);
      setStatus(response.data.data);
      
      // If onboarding is complete, redirect to dashboard
      if (response.data.data.onboarding.onboardingComplete) {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Failed to fetch onboarding status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setSkipping(true);
    try {
      await api.post(API_ROUTES.ONBOARDING.SKIP, {});
      router.push('/dashboard');
    } catch (error) {
      console.error('Failed to skip onboarding:', error);
      setSkipping(false);
    }
  };

  const handleStepClick = (step: typeof steps[0]) => {
    router.push(step.path);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  const currentStep = status?.onboarding.currentStep || 1;
  const completedSteps = status?.onboarding.completedSteps || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-4">
            Welcome to SocietyLedger
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Let's get your association set up in just a few steps
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                    completedSteps.includes(step.id)
                      ? 'bg-teal-500 text-white'
                      : currentStep === step.id
                      ? 'bg-teal-100 dark:bg-teal-900 text-teal-600 dark:text-teal-400 ring-2 ring-teal-500'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {completedSteps.includes(step.id) ? (
                    <CheckIcon />
                  ) : (
                    step.id
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`w-16 md:w-24 h-1 mx-2 ${
                      completedSteps.includes(step.id)
                        ? 'bg-teal-500'
                        : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Steps Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
          {steps.map((step) => {
            const isCompleted = completedSteps.includes(step.id);
            const isCurrent = currentStep === step.id;
            const isLocked = step.id > currentStep && !isCompleted;

            return (
              <button
                key={step.id}
                onClick={() => !isLocked && handleStepClick(step)}
                disabled={isLocked}
                className={`p-6 rounded-2xl text-left transition-all ${
                  isCompleted
                    ? 'bg-teal-50 dark:bg-teal-900/20 border-2 border-teal-200 dark:border-teal-800 hover:shadow-lg'
                    : isCurrent
                    ? 'bg-white dark:bg-gray-800 border-2 border-teal-500 shadow-lg hover:shadow-xl'
                    : isLocked
                    ? 'bg-gray-100 dark:bg-gray-800/50 border-2 border-gray-200 dark:border-gray-700 opacity-60 cursor-not-allowed'
                    : 'bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:shadow-lg'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className={`text-sm font-medium ${
                    isCompleted ? 'text-teal-600 dark:text-teal-400' : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    Step {step.id}
                  </span>
                  {isCompleted && (
                    <span className="bg-teal-100 dark:bg-teal-900 text-teal-600 dark:text-teal-400 text-xs px-2 py-1 rounded-full">
                      Complete
                    </span>
                  )}
                  {isCurrent && !isCompleted && (
                    <span className="bg-teal-500 text-white text-xs px-2 py-1 rounded-full">
                      Current
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  {step.name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {step.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleSkip}
            disabled={skipping}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            {skipping ? 'Skipping...' : 'Skip for now'}
          </button>
          <button
            onClick={() => handleStepClick(steps[currentStep - 1])}
            className="px-6 py-3 bg-gradient-to-r from-teal-500 to-green-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-green-600 transition-all shadow-lg hover:shadow-xl"
          >
            {currentStep === 1 ? 'Get Started' : 'Continue Setup'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
