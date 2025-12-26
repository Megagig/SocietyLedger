'use client';

import { useState } from 'react';
import { PlanWithFeatures, BillingCycle } from '@/types/subscription';
import { Check } from 'lucide-react';

interface PricingCardProps {
  plan: PlanWithFeatures;
  billingCycle: BillingCycle;
  onSelectPlan: (planId: number, billingCycle: BillingCycle) => void;
  isLoading?: boolean;
}

export default function PricingCard({ plan, billingCycle, onSelectPlan, isLoading }: PricingCardProps) {
  const price = billingCycle === 'MONTHLY' 
    ? Number(plan.priceMonthly) 
    : Number(plan.priceAnnual);

  const monthlyPrice = billingCycle === 'ANNUAL' 
    ? Number(plan.priceAnnual) / 12 
    : price;

  const savings = billingCycle === 'ANNUAL' 
    ? ((Number(plan.priceMonthly) * 12 - Number(plan.priceAnnual)) / (Number(plan.priceMonthly) * 12) * 100).toFixed(0)
    : null;

  const features = plan.features || {};

  const getFeatureList = () => {
    const featureList: string[] = [];

    if (plan.memberLimit) {
      featureList.push(`Up to ${plan.memberLimit} members`);
    } else {
      featureList.push('Unlimited members');
    }

    if (features.advancedReporting) {
      featureList.push('Advanced reporting');
    }
    
    if (features.customBranding) {
      featureList.push('Custom branding');
    }
    
    if (features.prioritySupport) {
      featureList.push('Priority support');
    }
    
    if (features.apiAccess) {
      featureList.push('API access');
    }
    
    if (features.multipleAdmins) {
      featureList.push('Multiple admins');
    }

    // Add default features
    featureList.push('Financial tracking');
    featureList.push('Member management');
    featureList.push('Payment processing');
    featureList.push('Report generation');

    return featureList;
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-lg transition-shadow bg-white dark:bg-gray-800">
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        {plan.name}
      </h3>
      
      {plan.description && (
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {plan.description}
        </p>
      )}

      <div className="mb-6">
        <div className="flex items-baseline">
          <span className="text-4xl font-extrabold text-gray-900 dark:text-white">
            ₦{monthlyPrice.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
          </span>
          <span className="text-gray-600 dark:text-gray-400 ml-2">
            /month
          </span>
        </div>
        
        {billingCycle === 'ANNUAL' && (
          <div className="mt-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Billed annually at ₦{price.toLocaleString('en-NG')}
            </span>
            {savings && (
              <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                Save {savings}%
              </span>
            )}
          </div>
        )}
      </div>

      <button
        onClick={() => onSelectPlan(plan.id, billingCycle)}
        disabled={isLoading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-6"
      >
        {isLoading ? 'Processing...' : 'Choose Plan'}
      </button>

      <ul className="space-y-3">
        {getFeatureList().map((feature, index) => (
          <li key={index} className="flex items-start">
            <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
            <span className="text-gray-700 dark:text-gray-300">{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
