'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Save, Loader2, Check, Info } from 'lucide-react';
import api from '@/lib/axios';
import { toast } from '@/lib/toast';

interface PaymentsSettings {
  enabledChannels: string[];
  defaultPaymentMethod: string;
  enableManualPayments: boolean;
  manualPaymentApprovalRequired: boolean;
  enablePartialPayments: boolean;
  minimumPaymentAmount?: number;
  receiptPrefix?: string;
  receiptAutoGenerate: boolean;
}

const PAYMENT_CHANNELS = [
  { id: 'bank_transfer', label: 'Bank Transfer', description: 'Direct bank transfers' },
  { id: 'cash', label: 'Cash', description: 'Cash payments recorded manually' },
  { id: 'card', label: 'Card (Paystack)', description: 'Online card payments via Paystack' },
  { id: 'mobile_money', label: 'Mobile Money', description: 'Mobile money transfers' },
  { id: 'cheque', label: 'Cheque', description: 'Cheque payments' },
];

export default function PaymentsSettingsPage() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<PaymentsSettings>({
    enabledChannels: ['bank_transfer', 'cash'],
    defaultPaymentMethod: 'bank_transfer',
    enableManualPayments: true,
    manualPaymentApprovalRequired: true,
    enablePartialPayments: true,
    receiptAutoGenerate: true,
  });
  const [hasChanges, setHasChanges] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'payments'],
    queryFn: async () => {
      const response = await api.get('/settings/payments');
      return response.data.data as PaymentsSettings;
    },
  });

  useEffect(() => {
    if (data) {
      setFormData(data);
      setHasChanges(false);
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: async (settings: Partial<PaymentsSettings>) => {
      const response = await api.patch('/settings/payments', settings);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Payment settings updated');
      queryClient.invalidateQueries({ queryKey: ['settings', 'payments'] });
      setHasChanges(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update settings');
    },
  });

  const handleChange = (field: keyof PaymentsSettings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const toggleChannel = (channelId: string) => {
    const newChannels = formData.enabledChannels.includes(channelId)
      ? formData.enabledChannels.filter(c => c !== channelId)
      : [...formData.enabledChannels, channelId];
    handleChange('enabledChannels', newChannels);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-teal-600" />
          Payments & Billing Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Configure payment channels and billing preferences
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Payment Channels */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Payment Channels
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Select which payment methods members can use
          </p>
          
          <div className="space-y-3">
            {PAYMENT_CHANNELS.map(channel => (
              <label
                key={channel.id}
                className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${
                  formData.enabledChannels.includes(channel.id)
                    ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.enabledChannels.includes(channel.id)}
                    onChange={() => toggleChannel(channel.id)}
                    className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                  />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{channel.label}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{channel.description}</div>
                  </div>
                </div>
                {formData.enabledChannels.includes(channel.id) && (
                  <Check className="w-5 h-5 text-teal-600" />
                )}
              </label>
            ))}
          </div>
        </div>

        {/* Default Payment Method */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Default Settings
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Default Payment Method
              </label>
              <select
                value={formData.defaultPaymentMethod}
                onChange={(e) => handleChange('defaultPaymentMethod', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                {PAYMENT_CHANNELS.filter(c => formData.enabledChannels.includes(c.id)).map(channel => (
                  <option key={channel.id} value={channel.id}>{channel.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-gray-900 dark:text-white">
                  Enable Manual Payments
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Allow admins to record payments manually
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.enableManualPayments}
                  onChange={(e) => handleChange('enableManualPayments', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 dark:peer-focus:ring-teal-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-teal-600"></div>
              </label>
            </div>

            {formData.enableManualPayments && (
              <div className="flex items-center justify-between pl-4 border-l-2 border-teal-500">
                <div>
                  <label className="font-medium text-gray-900 dark:text-white">
                    Require Approval for Manual Payments
                  </label>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Manual payments need admin approval before being confirmed
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.manualPaymentApprovalRequired}
                    onChange={(e) => handleChange('manualPaymentApprovalRequired', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 dark:peer-focus:ring-teal-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-teal-600"></div>
                </label>
              </div>
            )}

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
          </div>
        </div>

        {/* Receipt Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Receipt Settings
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-gray-900 dark:text-white">
                  Auto-Generate Receipts
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Automatically generate receipt numbers for payments
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.receiptAutoGenerate}
                  onChange={(e) => handleChange('receiptAutoGenerate', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 dark:peer-focus:ring-teal-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-teal-600"></div>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Receipt Number Prefix
              </label>
              <input
                type="text"
                value={formData.receiptPrefix || ''}
                onChange={(e) => handleChange('receiptPrefix', e.target.value)}
                placeholder="e.g., RCP-"
                className="w-full md:w-48 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Prefix for auto-generated receipt numbers (e.g., RCP-001)
              </p>
            </div>
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
    </div>
  );
}
