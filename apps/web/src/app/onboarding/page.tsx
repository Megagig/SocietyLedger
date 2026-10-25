'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/axios';
import { API_ROUTES } from '@/utils/constants';
import { docsUrl } from '@/lib/docs';
import { ONBOARDING_STEPS } from '@societyledger/shared';

interface OnboardingStatus {
  onboarding: {
    id: number;
    currentStep: number;
    completedSteps: number[];
    skippedSteps?: number[];
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

// The same five steps, in the same order, as the mobile app (packages/shared/src/onboarding.ts)
const steps = ONBOARDING_STEPS.map((s) => ({ id: s.id, name: s.name, description: s.description, path: `/onboarding/${s.key}` }));

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [skipping, setSkipping] = useState(false);
  
  // Allow access even after completion if ?rerun=true is in URL
  const forceAccess = searchParams.get('rerun') === 'true';

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await api.get(API_ROUTES.ONBOARDING.STATUS);
        setStatus(response.data.data);
        
        // If onboarding is complete and not forcing access, redirect to dashboard
        // Check forceAccess directly from searchParams to ensure it's current
        const isForceAccess = searchParams.get('rerun') === 'true';
        if (response.data.data.onboarding.onboardingComplete && !isForceAccess) {
          router.push('/dashboard');
        }
      } catch (error) {
        console.error('Failed to fetch onboarding status:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStatus();
  }, [searchParams, router]);

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
  const skippedSteps = status?.onboarding.skippedSteps || [];
  const isRerunMode = forceAccess && status?.onboarding.onboardingComplete;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-8 sm:py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          {isRerunMode && (
            <div className="mb-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="inline-flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Dashboard
              </button>
            </div>
          )}
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-3 sm:mb-4">
            {isRerunMode ? 'Setup Wizard' : 'Welcome to SocietyLedger'}
          </h1>
          <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 px-4">
            {isRerunMode 
              ? 'Re-run any setup step to update your configuration'
              : "Let's get your association set up in just a few steps"
            }
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8 sm:mb-12 overflow-x-auto pb-4">
          <div className="flex items-center justify-between mb-4 min-w-max px-2">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-semibold transition-all text-sm sm:text-base ${
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
                    className={`w-12 sm:w-16 md:w-24 h-1 mx-1 sm:mx-2 ${
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
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mb-6 sm:mb-8">
          {steps.map((step) => {
            const isCompleted = completedSteps.includes(step.id);
            const isCurrent = currentStep === step.id;
            // In rerun mode, all steps are accessible
            const isLocked = !isRerunMode && step.id > currentStep && !isCompleted && !skippedSteps.includes(step.id);

            return (
              <button
                key={step.id}
                onClick={() => !isLocked && handleStepClick(step)}
                disabled={isLocked}
                className={`p-5 sm:p-6 rounded-2xl text-left transition-all ${
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
                  <span className={`text-xs sm:text-sm font-medium ${
                    isCompleted ? 'text-teal-600 dark:text-teal-400' : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    Step {step.id}
                  </span>
                  {isCompleted && (
                    <span className="bg-teal-100 dark:bg-teal-900 text-teal-600 dark:text-teal-400 text-xs px-2 py-1 rounded-full">
                      {isRerunMode ? 'Re-run' : 'Complete'}
                    </span>
                  )}
                  {!isCompleted && skippedSteps.includes(step.id) && (
                    <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs px-2 py-1 rounded-full">
                      Skipped
                    </span>
                  )}
                  {isCurrent && !isCompleted && (
                    <span className="bg-teal-500 text-white text-xs px-2 py-1 rounded-full">
                      Current
                    </span>
                  )}
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  {step.name}
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  {step.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
          {isRerunMode ? (
            <button
              onClick={() => router.push('/dashboard')}
              className="text-center sm:text-left text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors py-2 sm:py-0"
            >
              Return to Dashboard
            </button>
          ) : (
            <button
              onClick={handleSkip}
              disabled={skipping}
              className="text-center sm:text-left text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors py-2 sm:py-0"
            >
              {skipping ? 'Skipping...' : 'Skip for now'}
            </button>
          )}
          <button
            onClick={() => handleStepClick(steps[isRerunMode ? 2 : currentStep - 1])}
            className="px-6 py-3 bg-gradient-to-r from-teal-500 to-green-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-green-600 transition-all shadow-lg hover:shadow-xl"
          >
            {isRerunMode ? 'Import Members' : currentStep === 1 ? 'Get Started' : 'Continue Setup'}
          </button>
        </div>

        <div className="text-center mt-6">
          <a
            href={docsUrl('/docs/getting-started/onboarding-wizard', 'web_onboarding')}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
          >
            Need help? See the setup guide
          </a>
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

// Wrap with Suspense for useSearchParams
export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500"></div>
      </div>
    }>
      <OnboardingContent />
    </Suspense>
  );
}
