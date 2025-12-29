'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Save, Loader2, AlertTriangle, Info } from 'lucide-react';
import api from '@/lib/axios';
import { toast } from 'sonner';

interface FinancialSettings {
  defaultGracePeriodDays: number;
  enableLateFees: boolean;
  lateFeeType: 'fixed' | 'percentage';
  lateFeeAmount: number;
  maxLateFeeAmount?: number;
  enablePartialPayments: boolean;
  requirePaymentApproval: boolean;
  approvalThreshold?: number;
  fiscalYearStart: number;
  currencyCode: string;
  currencySymbol: string;
  decimalPlaces: number;
}

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const CURRENCIES = [
  { code: 'NGN', symbol: '₦', label: 'Nigerian Naira' },
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'GBP', symbol: '£', label: 'British Pound' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'ZAR', symbol: 'R', label: 'South African Rand' },
  { code: 'KES', symbol: 'KSh', label: 'Kenyan Shilling' },
  { code: 'GHS', symbol: '₵', label: 'Ghanaian Cedi' },
];

export default function FinancialSettingsPage() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<FinancialSettings>({
    defaultGracePeriodDays: 7,
    enableLateFees: false,
    lateFeeType: 'fixed',
    lateFeeAmount: 0,
    enablePartialPayments: true,
    requirePaymentApproval: false,
    fiscalYearStart: 1,
    currencyCode: 'NGN',
    currencySymbol: '₦',
    decimalPlaces: 2,
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Fetch settings
  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'financial'],
    queryFn: async () => {
      const response = await api.get('/settings/financial');
      return response.data.data as FinancialSettings;
    },
  });

  useEffect(() => {
    if (data) {
      setFormData(data);
      setHasChanges(false);
    }
  }, [data]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (settings: Partial<FinancialSettings>) => {
      const response = await api.patch('/settings/financial', settings);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Financial settings updated');
      queryClient.invalidateQueries({ queryKey: ['settings', 'financial'] });
      setHasChanges(false);
      setShowConfirmation(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update settings');
    },
  });

  const handleChange = (field: keyof FinancialSettings, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      // Auto-update currency symbol when code changes
      if (field === 'currencyCode') {
        const currency = CURRENCIES.find(c => c.code === value);
        if (currency) {
          updated.currencySymbol = currency.symbol;
        }
      }
      return updated;
    });
    setHasChanges(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfirmation(true);
  };

  const confirmSave = () => {
    updateMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-teal-600" />
          Financial Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Configure financial rules and policies for your association
        </p>
      </div>

      {/* Warning Banner */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-700 dark:text-amber-300">
          <p className="font-medium">Important: Prospective Changes Only</p>
          <p className="mt-1">
            Changes to financial settings will only affect <strong>new transactions</strong>. 
            Existing transactions, payments, and penalties will not be modified.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Currency & Fiscal Year */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Currency & Fiscal Year
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Currency
              </label>
              <select
                value={formData.currencyCode}
                onChange={(e) => handleChange('currencyCode', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                {CURRENCIES.map(curr => (
                  <option key={curr.code} value={curr.code}>
                    {curr.symbol} - {curr.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fiscal Year Start
              </label>
              <select
                value={formData.fiscalYearStart}
                onChange={(e) => handleChange('fiscalYearStart', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                {MONTHS.map(month => (
                  <option key={month.value} value={month.value}>{month.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Decimal Places
            </label>
            <select
              value={formData.decimalPlaces}
              onChange={(e) => handleChange('decimalPlaces', parseInt(e.target.value))}
              className="w-full md:w-48 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value={0}>0 (e.g., ₦1,000)</option>
              <option value={2}>2 (e.g., ₦1,000.00)</option>
            </select>
          </div>
        </div>

        {/* Grace Period & Late Fees */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Grace Period & Late Fees
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Default Grace Period (Days)
              </label>
              <input
                type="number"
                min="0"
                max="90"
                value={formData.defaultGracePeriodDays}
                onChange={(e) => handleChange('defaultGracePeriodDays', parseInt(e.target.value))}
                className="w-full md:w-48 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Days after due date before a payment is considered overdue
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-gray-900 dark:text-white">
                  Enable Late Fees
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Automatically apply late fees to overdue payments
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.enableLateFees}
                  onChange={(e) => handleChange('enableLateFees', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 dark:peer-focus:ring-teal-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-teal-600"></div>
              </label>
            </div>

            {formData.enableLateFees && (
              <div className="pl-4 border-l-2 border-teal-500 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Late Fee Type
                    </label>
                    <select
                      value={formData.lateFeeType}
                      onChange={(e) => handleChange('lateFeeType', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    >
                      <option value="fixed">Fixed Amount</option>
                      <option value="percentage">Percentage</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {formData.lateFeeType === 'fixed' ? 'Late Fee Amount' : 'Late Fee Percentage'}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step={formData.lateFeeType === 'percentage' ? '0.1' : '1'}
                        value={formData.lateFeeAmount}
                        onChange={(e) => handleChange('lateFeeAmount', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                        {formData.lateFeeType === 'percentage' ? '%' : formData.currencySymbol}
                      </span>
                    </div>
                  </div>
                </div>

                {formData.lateFeeType === 'percentage' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Maximum Late Fee (Optional)
                    </label>
                    <div className="relative w-full md:w-48">
                      <input
                        type="number"
                        min="0"
                        value={formData.maxLateFeeAmount || ''}
                        onChange={(e) => handleChange('maxLateFeeAmount', e.target.value ? parseFloat(e.target.value) : undefined)}
                        placeholder="No limit"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                        {formData.currencySymbol}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Cap the maximum late fee amount
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Payment Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Payment Settings
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-gray-900 dark:text-white">
                  Allow Partial Payments
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Members can pay less than the full amount due
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.enablePartialPayments}
                  onChange={(e) => handleChange('enablePartialPayments', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 dark:peer-focus:ring-teal-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-teal-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-gray-900 dark:text-white">
                  Require Payment Approval
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Manual payments require admin approval
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.requirePaymentApproval}
                  onChange={(e) => handleChange('requirePaymentApproval', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 dark:peer-focus:ring-teal-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-teal-600"></div>
              </label>
            </div>

            {formData.requirePaymentApproval && (
              <div className="pl-4 border-l-2 border-teal-500">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Approval Threshold (Optional)
                </label>
                <div className="relative w-full md:w-48">
                  <input
                    type="number"
                    min="0"
                    value={formData.approvalThreshold || ''}
                    onChange={(e) => handleChange('approvalThreshold', e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="All payments"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                    {formData.currencySymbol}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Only require approval for payments above this amount
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-3">
          {hasChanges && (
            <span className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1">
              Unsaved changes
            </span>
          )}
          <button
            type="submit"
            disabled={!hasChanges || updateMutation.isPending}
            className="px-6 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
          >
            {updateMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Changes
          </button>
        </div>
      </form>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Confirm Changes
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              You are about to update financial settings. These changes will only affect 
              <strong> new transactions</strong> and will not modify existing data.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmation(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={confirmSave}
                disabled={updateMutation.isPending}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium flex items-center gap-2"
              >
                {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
