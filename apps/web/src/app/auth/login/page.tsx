'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTenant } from '@/contexts/TenantContext';
import { useAuthStore } from '@/store/authStore';
import Link from 'next/link';
import { getDisplayDomain } from '@/utils/domain';

interface LoginForm {
  email: string;
  password: string;
}

const SUPPORT_WHATSAPP_NUMBER = '2348060374755';
const SUPPORT_MESSAGE =
  "Hello Society Ledger support. My account is still pending approval and I'd like to check on its status.";

export default function LoginPage() {
  const router = useRouter();
  const { tenant, isLoading: tenantLoading, error: tenantError } = useTenant();
  const { login, isLoading: authLoading, error: authError } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<LoginForm>({
    email: '',
    password: '',
  });
  const [localError, setLocalError] = useState<string | null>(null);

  // Combine tenant and auth errors
  const error = tenantError || authError || localError;

  // A pending account isn't a failure the member can fix by retrying, so it gets its own
  // explanatory panel (timeline + support route) instead of a red "Login Error".
  const isPendingApproval = !!error && /pending admin approval/i.test(error);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!formData.email || !formData.password) {
      setLocalError('Please fill in all fields');
      return;
    }

    try {
      const success = await login(formData);

      if (success) {
        const { user } = useAuthStore.getState();
        if (user?.requiresOnboarding && user?.role === 'admin' && !user?.platformRole) {
          router.push('/onboarding');
        } else {
          router.push('/dashboard');
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      if (message.includes('PLATFORM_LOGIN_REQUIRED') || message.includes('admin console')) {
        setLocalError('Platform administrators must log in via admin.societyledger.com.ng');
      } else {
        setLocalError(message);
      }
    }
  };

  if (tenantLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-600 dark:bg-blue-500 text-white mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white dark:text-white">
            {tenant?.name || 'SocietyLedger'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 dark:text-gray-400 mt-2">
            {tenant ? 'Sign in to your account' : 'Sign in to your association'}
          </p>
          {!tenant && (
            <p className="text-sm text-amber-600 dark:text-amber-400 dark:text-amber-400 mt-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2 inline-block">
              Access your association via its subdomain (e.g., myassociation.{getDisplayDomain()})
            </p>
          )}
        </div>

        {/* Login Form Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          {isPendingApproval && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                    Your account is pending approval
                  </h3>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1 leading-relaxed">
                    We&apos;ll notify you by email once an admin approves your account. Approval usually takes less
                    than 24 hours.
                  </p>
                  <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-800">
                    <p className="text-sm text-emerald-700 dark:text-emerald-300">
                      Taking longer than expected?{' '}
                      <a
                        href={`https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(SUPPORT_MESSAGE)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 font-semibold text-emerald-800 dark:text-emerald-200 underline underline-offset-2 hover:text-emerald-900 dark:hover:text-emerald-100 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.13-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.8-.78.97-.15.16-.29.18-.54.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.84-.2-.49-.4-.42-.56-.43h-.47c-.16 0-.43.06-.65.31-.22.25-.85.84-.85 2.05s.87 2.37.99 2.54c.12.16 1.71 2.61 4.14 3.66.58.25 1.03.4 1.38.51.58.19 1.11.16 1.53.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.17-.48-.29Z" />
                        </svg>
                        Contact us on WhatsApp
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && !isPendingApproval && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-red-600 dark:text-red-400 dark:text-red-400 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-200 dark:text-red-200">Login Error</h3>
                  <p className="text-sm text-red-700 dark:text-red-300 dark:text-red-300 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                placeholder="your.email@example.com"
                disabled={authLoading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors pr-12"
                  placeholder="Enter your password"
                  disabled={authLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-200 transition-colors"
                  disabled={authLoading}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 dark:bg-blue-500 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {authLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  Sign In
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center space-y-2">
            <Link href="/auth/forgot-password" className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-300">
              Forgot your password?
            </Link>
            <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-400">
              Don&apos;t have an account?{' '}
              {tenant ? (
                <Link href="/auth/register" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-300 font-medium">
                  Register here
                </Link>
              ) : (
                <Link href="/signup" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-300 font-medium">
                  Create an association
                </Link>
              )}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400 dark:text-gray-400">
          <p>© 2025 {tenant?.name || 'SocietyLedger'}. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}