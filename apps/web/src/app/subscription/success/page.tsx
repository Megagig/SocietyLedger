'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, ArrowRight, Sparkles } from 'lucide-react';

export default function SubscriptionSuccessPage() {
  const searchParams = useSearchParams();
  const subdomain = searchParams.get('subdomain');
  const [countdown, setCountdown] = useState(5);

  // Build the redirect URL based on subdomain
  const getRedirectUrl = () => {
    if (subdomain) {
      // Redirect to subdomain login
      return `http://${subdomain}.localhost:3000/auth/login?redirect=/dashboard/subscription`;
    }
    // Fallback to generic login
    return '/auth/login?redirect=/dashboard/subscription';
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.href = getRedirectUrl();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [subdomain]);

  const handleContinue = () => {
    window.location.href = getRedirectUrl();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        {/* Success Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 md:p-12 text-center">
          {/* Success Icon with Animation */}
          <div className="relative inline-flex items-center justify-center mb-6">
            <div className="absolute inset-0 bg-green-100 dark:bg-green-900/30 rounded-full animate-ping opacity-75"></div>
            <div className="relative bg-green-100 dark:bg-green-900/50 rounded-full p-6">
              <CheckCircle className="h-20 w-20 text-green-600 dark:text-green-400" />
            </div>
          </div>

          {/* Success Message */}
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Payment Successful!
          </h1>
          
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Your subscription has been activated successfully
          </p>

          {/* Features Unlocked */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-6 mb-8">
            <div className="flex items-center justify-center mb-4">
              <Sparkles className="h-6 w-6 text-purple-600 dark:text-purple-400 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Welcome to Your Premium Experience
              </h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4 text-left">
              <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-300">Full member management</span>
              </div>
              <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-300">Advanced financial tracking</span>
              </div>
              <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-300">Payment processing</span>
              </div>
              <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-300">Detailed reports</span>
              </div>
            </div>
          </div>

          {/* Next Steps */}
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              Redirecting to your dashboard in{' '}
              <span className="font-bold text-blue-600 dark:text-blue-400">{countdown}</span>{' '}
              seconds...
            </p>

            <button
              onClick={handleContinue}
              className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors shadow-lg hover:shadow-xl"
            >
              Continue to Dashboard
              <ArrowRight className="ml-2 h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Support Info */}
        <div className="mt-8 text-center">
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Need help? Contact our support team at{' '}
            <a href="mailto:support@societyledger.com" className="text-blue-600 dark:text-blue-400 hover:underline">
              support@societyledger.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
