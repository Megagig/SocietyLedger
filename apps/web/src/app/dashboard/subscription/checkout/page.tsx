'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Shield, Lock, CreditCard, Loader2, CheckCircle } from 'lucide-react';
import { getTenantHeaders } from '@/utils/tenant';

type PaymentProvider = 'paystack' | 'nomba';

interface PlanDetails {
  id: number;
  name: string;
  description: string;
  priceMonthly: number;
  priceAnnual: number;
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const planId = searchParams.get('planId');
  const billingCycle = searchParams.get('billingCycle') as 'MONTHLY' | 'ANNUAL';
  
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [plan, setPlan] = useState<PlanDetails | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!planId || !billingCycle) {
      router.push('/dashboard/subscription/plans');
      return;
    }
    fetchPlanDetails();
  }, [planId, billingCycle]);

  const fetchPlanDetails = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/subscriptions/plans`, {
        credentials: 'include',
        headers: getTenantHeaders(),
      });
      const data = await response.json();
      if (data.success && data.data) {
        const selectedPlan = data.data.find((p: PlanDetails) => p.id === parseInt(planId!));
        if (selectedPlan) {
          setPlan(selectedPlan);
        }
      }
    } catch (error) {
      console.error('Error fetching plan:', error);
    }
  };

  const getPrice = () => {
    if (!plan) return 0;
    return billingCycle === 'MONTHLY' ? plan.priceMonthly : plan.priceAnnual;
  };

  const handlePayment = async () => {
    if (!selectedProvider || !planId || !billingCycle) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/subscriptions/initialize`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getTenantHeaders(),
          },
          credentials: 'include',
          body: JSON.stringify({
            planId: parseInt(planId),
            billingCycle,
            provider: selectedProvider,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to initialize payment');
      }

      // Redirect to payment gateway
      if (data.data?.authorizationUrl) {
        window.location.href = data.data.authorizationUrl;
      } else if (data.data?.checkoutLink) {
        window.location.href = data.data.checkoutLink;
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      setError(error.message || 'Failed to initialize payment');
      setIsLoading(false);
    }
  };

  const paymentProviders = [
    {
      id: 'paystack' as PaymentProvider,
      name: 'Paystack',
      description: 'Pay with card, bank transfer, or USSD',
      logo: '/images/paystack-logo.jpeg',
      color: 'from-cyan-500 to-blue-500',
      borderColor: 'border-cyan-500',
      bgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
      features: ['Cards (Visa, Mastercard)', 'Bank Transfer', 'USSD'],
    },
    {
      id: 'nomba' as PaymentProvider,
      name: 'Nomba',
      description: 'Pay with card or bank transfer',
      logo: '/images/nomba-logo.png',
      color: 'from-indigo-500 to-purple-500',
      borderColor: 'border-indigo-500',
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
      features: ['Cards (Visa, Mastercard)', 'Bank Transfer', 'QR Payment'],
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to Plans
        </button>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Payment Methods - Left Side */}
          <div className="lg:col-span-3">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 md:p-8">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Choose Payment Method
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                Select your preferred payment provider to complete your subscription
              </p>

              {error && (
                <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              {/* Payment Provider Cards */}
              <div className="space-y-4">
                {paymentProviders.map((provider) => (
                  <div
                    key={provider.id}
                    onClick={() => setSelectedProvider(provider.id)}
                    className={`relative cursor-pointer rounded-xl border-2 p-5 transition-all duration-200 ${
                      selectedProvider === provider.id
                        ? `${provider.borderColor} ${provider.bgColor} shadow-md`
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    {/* Selection Indicator */}
                    <div className="absolute top-4 right-4">
                      {selectedProvider === provider.id ? (
                        <div className={`h-6 w-6 rounded-full bg-gradient-to-r ${provider.color} flex items-center justify-center`}>
                          <CheckCircle className="h-4 w-4 text-white" />
                        </div>
                      ) : (
                        <div className="h-6 w-6 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                      )}
                    </div>

                    <div className="flex items-start space-x-4">
                      {/* Logo */}
                      <div className="flex-shrink-0 w-28 h-12 relative bg-white rounded-lg overflow-hidden flex items-center justify-center p-2">
                        <Image
                          src={provider.logo}
                          alt={`${provider.name} logo`}
                          width={100}
                          height={40}
                          className="object-contain"
                        />
                      </div>

                      {/* Details */}
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {provider.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                          {provider.description}
                        </p>
                        
                        {/* Features */}
                        <div className="flex flex-wrap gap-2">
                          {provider.features.map((feature, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                            >
                              {feature}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pay Button */}
              <button
                onClick={handlePayment}
                disabled={!selectedProvider || isLoading}
                className={`w-full mt-8 py-4 px-6 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center ${
                  selectedProvider && !isLoading
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-5 w-5 mr-2" />
                    Pay ₦{getPrice().toLocaleString('en-NG')}
                  </>
                )}
              </button>

              {/* Security Badge */}
              <div className="mt-6 flex items-center justify-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center">
                  <Lock className="h-4 w-4 mr-1" />
                  SSL Encrypted
                </div>
                <div className="flex items-center">
                  <Shield className="h-4 w-4 mr-1" />
                  Secure Payment
                </div>
              </div>
            </div>
          </div>

          {/* Order Summary - Right Side */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 sticky top-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Order Summary
              </h2>

              {plan ? (
                <>
                  <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {plan.name} Plan
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {billingCycle === 'MONTHLY' ? 'Monthly' : 'Annual'} billing
                        </p>
                      </div>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        ₦{getPrice().toLocaleString('en-NG')}
                      </span>
                    </div>
                    {plan.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {plan.description}
                      </p>
                    )}
                  </div>

                  {billingCycle === 'ANNUAL' && (
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 mb-4">
                      <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                        🎉 You&apos;re saving ₦{((plan.priceMonthly * 12) - plan.priceAnnual).toLocaleString('en-NG')} with annual billing!
                      </p>
                    </div>
                  )}

                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold text-gray-900 dark:text-white">
                        Total
                      </span>
                      <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        ₦{getPrice().toLocaleString('en-NG')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {billingCycle === 'MONTHLY' ? 'Billed monthly' : 'Billed annually'}
                    </p>
                  </div>
                </>
              ) : (
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                </div>
              )}

              {/* Trust Badges */}
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-3">
                  Trusted by 1000+ associations
                </p>
                <div className="flex justify-center space-x-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900 dark:text-white">256-bit</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Encryption</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900 dark:text-white">PCI</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Compliant</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
