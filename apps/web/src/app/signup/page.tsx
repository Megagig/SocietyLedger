'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { API_ROUTES } from '@/utils/constants';
import { getDisplayDomain, getSubdomainUrl } from '@/utils/domain';
import {
  ASSOCIATION_TYPES,
  ASSOCIATION_TYPE_OTHER,
  SUBDOMAIN_MESSAGES,
  SUBDOMAIN_REMINDER,
  associationSignupSchema,
  subdomainProblem,
  suggestSubdomain,
} from '@societyledger/shared';

interface SignupForm {
  // Association details
  associationName: string;
  subdomain: string;
  type: string;
  customType: string;
  // Admin details
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

interface SignupResult {
  requiresVerification: boolean;
  pendingApproval: boolean;
}

const inputClass =
  'w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2';

export default function AssociationSignupPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SignupResult | null>(null);
  const [createdSubdomain, setCreatedSubdomain] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null);
  const [subdomainMessage, setSubdomainMessage] = useState<string | null>(null);
  const [checkingSubdomain, setCheckingSubdomain] = useState(false);
  // Once they type their own address we stop rewriting it from the association name.
  const subdomainTouched = useRef(false);
  const [formData, setFormData] = useState<SignupForm>({
    associationName: '',
    subdomain: '',
    type: '',
    customType: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      associationName: name,
      subdomain: subdomainTouched.current ? prev.subdomain : suggestSubdomain(name),
    }));
  };

  const handleSubdomainChange = (value: string) => {
    subdomainTouched.current = true;
    setFormData((prev) => ({ ...prev, subdomain: value.toLowerCase().replace(/[^a-z0-9-]/g, '') }));
  };

  // Check the address a moment after they stop typing.
  useEffect(() => {
    const subdomain = formData.subdomain;
    setSubdomainAvailable(null);
    setSubdomainMessage(null);
    if (!subdomain) return;

    const problem = subdomainProblem(subdomain);
    if (problem) {
      // "Too short" while they are still typing is noise; the rest are real problems.
      if (problem !== 'TOO_SHORT') {
        setSubdomainAvailable(false);
        setSubdomainMessage(SUBDOMAIN_MESSAGES[problem]);
      }
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setCheckingSubdomain(true);
      try {
        const res = await fetch(`${API_ROUTES.ASSOCIATIONS.CHECK_SUBDOMAIN}?subdomain=${encodeURIComponent(subdomain)}`);
        if (cancelled) return;
        // 404 means nobody has it yet. Anything else (found, reserved, cancelled) means it is not free.
        if (res.status === 404) {
          setSubdomainAvailable(true);
        } else if (res.status === 409) {
          setSubdomainAvailable(false);
          setSubdomainMessage(SUBDOMAIN_MESSAGES.RESERVED);
        } else {
          setSubdomainAvailable(false);
          setSubdomainMessage('That address is already taken.');
        }
      } catch {
        if (!cancelled) setSubdomainAvailable(null);
      } finally {
        if (!cancelled) setCheckingSubdomain(false);
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [formData.subdomain]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    const payload = {
      association: {
        name: formData.associationName,
        subdomain: formData.subdomain,
        type: formData.type,
        customType: formData.type === ASSOCIATION_TYPE_OTHER ? formData.customType : undefined,
      },
      admin: {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
      },
    };

    // The same rules the server applies, so mistakes are caught before anything is sent.
    const checked = associationSignupSchema.safeParse(payload);
    if (!checked.success) {
      setError(checked.error.issues[0]?.message ?? 'Please check the form');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(API_ROUTES.ASSOCIATIONS.SIGNUP, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checked.data),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Signup failed');
      }

      setCreatedSubdomain(checked.data.association.subdomain);
      setSuccess({
        requiresVerification: data.data?.requiresVerification !== false,
        pendingApproval: data.data?.pendingApproval !== false,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    const steps = [
      success.requiresVerification ? 'Verify your email with the code we sent' : null,
      success.pendingApproval ? 'Wait for SocietyLedger to approve your association. Your free trial starts then.' : null,
      'Sign in at your association address',
    ].filter((s): s is string => s !== null);

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 dark:text-green-400 mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {success.requiresVerification ? 'Verify Your Email' : 'Association Created'}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Your association <span className="font-semibold">{formData.associationName}</span> has been created!
              </p>
              {success.requiresVerification && (
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  We&apos;ve sent a verification code to <span className="font-semibold">{formData.email}</span>. Please verify your email to continue.
                </p>
              )}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Your association URL:</p>
                <p className="font-mono text-blue-600 dark:text-blue-400 font-semibold break-all">
                  {getSubdomainUrl(createdSubdomain)}
                </p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div className="text-left">
                    <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">Next Steps</h3>
                    <ol className="text-sm text-amber-700 dark:text-amber-300 mt-1 list-decimal list-inside space-y-1">
                      {steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>
              <Link
                href={success.requiresVerification ? `/auth/verify-email?email=${encodeURIComponent(formData.email)}` : '/auth/login'}
                className="inline-flex items-center justify-center w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 dark:bg-blue-500 text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                {success.requiresVerification ? 'Enter Verification Code' : 'Go to Sign In'}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-600 dark:bg-blue-500 text-white mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create Your Association</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Start managing your community in minutes</p>
        </div>

        {/* Signup Form Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Association Section */}
            <div className="pb-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Association Details</h3>

              <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-800 dark:text-amber-200">{SUBDOMAIN_REMINDER}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="associationName" className={labelClass}>
                    Association Name *
                  </label>
                  <input
                    id="associationName"
                    type="text"
                    required
                    value={formData.associationName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className={inputClass}
                    placeholder="e.g., Lagos Alumni Association"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label htmlFor="type" className={labelClass}>
                    Kind of Association *
                  </label>
                  <select
                    id="type"
                    required
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className={inputClass}
                    disabled={loading}
                  >
                    <option value="" disabled>
                      Choose one
                    </option>
                    {ASSOCIATION_TYPES.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                {formData.type === ASSOCIATION_TYPE_OTHER && (
                  <div>
                    <label htmlFor="customType" className={labelClass}>
                      What kind of association is it? *
                    </label>
                    <input
                      id="customType"
                      type="text"
                      required
                      maxLength={60}
                      value={formData.customType}
                      onChange={(e) => setFormData({ ...formData, customType: e.target.value })}
                      className={inputClass}
                      placeholder="e.g., Village development union"
                      disabled={loading}
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="subdomain" className={labelClass}>
                    Your Address *
                  </label>
                  <div className="flex items-center">
                    <input
                      id="subdomain"
                      type="text"
                      required
                      value={formData.subdomain}
                      onChange={(e) => handleSubdomainChange(e.target.value)}
                      className="flex-1 min-w-0 px-4 py-3 rounded-l-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      placeholder="lagos-alumni"
                      maxLength={30}
                      disabled={loading}
                    />
                    <span className="px-4 py-3 bg-gray-100 dark:bg-gray-700 border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-lg text-gray-500 dark:text-gray-400 text-sm">
                      .{getDisplayDomain()}
                    </span>
                  </div>
                  {formData.subdomain && !subdomainProblem(formData.subdomain) && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 break-all">
                      Members will sign in at <span className="font-mono">{getSubdomainUrl(formData.subdomain)}</span>
                    </p>
                  )}
                  {checkingSubdomain && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Checking availability...</p>
                  )}
                  {subdomainAvailable === true && (
                    <p className="text-sm text-green-600 dark:text-green-400 mt-1 flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      This address is available
                    </p>
                  )}
                  {subdomainAvailable === false && (
                    <p className="text-sm text-red-600 dark:text-red-400 mt-1 flex items-center">
                      <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      {subdomainMessage ?? 'That address is already taken.'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Admin Section */}
            <div className="pt-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Admin Account</h3>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="firstName" className={labelClass}>
                      First Name *
                    </label>
                    <input
                      id="firstName"
                      type="text"
                      required
                      autoComplete="given-name"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className={inputClass}
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className={labelClass}>
                      Last Name *
                    </label>
                    <input
                      id="lastName"
                      type="text"
                      required
                      autoComplete="family-name"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className={inputClass}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className={labelClass}>
                    Email Address *
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={inputClass}
                    placeholder="admin@example.com"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label htmlFor="phone" className={labelClass}>
                    Phone Number *
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    required
                    autoComplete="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className={inputClass}
                    placeholder="0803 123 4567"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label htmlFor="password" className={labelClass}>
                    Password *
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className={`${inputClass} pr-12`}
                      placeholder="At least 6 characters"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300 transition-colors"
                      disabled={loading}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
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

                <div>
                  <label htmlFor="confirmPassword" className={labelClass}>
                    Confirm Password *
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className={`${inputClass} pr-12`}
                      placeholder="Re-enter password"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300 transition-colors"
                      disabled={loading}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? (
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
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || subdomainAvailable === false}
              className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 dark:bg-blue-500 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center mt-6"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating Association...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Create Association
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Already have an association?{' '}
              <Link href="/auth/login" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-300 font-medium">
                Sign in here
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>© {new Date().getFullYear()} SocietyLedger. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
