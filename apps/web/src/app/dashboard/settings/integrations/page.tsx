'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { key } from '@societyledger/query';
import { useQueryScope, useScopedQuery } from '@/lib/query';
import { Plug, Save, Loader2, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import api from '@/lib/axios';
import { toast } from '@/lib/toast';

interface IntegrationsSettings {
  paystackEnabled: boolean;
  paystackPublicKey?: string;
  nombaEnabled: boolean;
  nombaAccountId?: string;
  smsProvider: 'termii' | 'none';
  webhookUrl?: string;
  apiAccessEnabled: boolean;
}

export default function IntegrationsSettingsPage() {
  const queryClient = useQueryClient();
  const { tenant } = useQueryScope();
  const [formData, setFormData] = useState<IntegrationsSettings>({
    paystackEnabled: false,
    nombaEnabled: false,
    smsProvider: 'none',
    apiAccessEnabled: false,
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const { data, isLoading } = useScopedQuery({
    domain: 'settings',
    parts: ['integrations'],
    queryFn: async () => {
      const response = await api.get('/settings/integrations');
      return response.data.data as IntegrationsSettings;
    },
  });

  useEffect(() => {
    if (data) {
      setFormData(data);
      setHasChanges(false);
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: async (settings: Partial<IntegrationsSettings>) => {
      const response = await api.patch('/settings/integrations', settings);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Integration settings updated');
      queryClient.invalidateQueries({ queryKey: key(tenant, 'settings', 'integrations') });
      setHasChanges(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update settings');
    },
  });

  const handleChange = (field: keyof IntegrationsSettings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const toggleShowKey = (key: string) => {
    setShowKeys(prev => ({ ...prev, [key]: !prev[key] }));
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
    <div className="max-w-3xl p-4 sm:p-0">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Plug className="w-5 h-5 sm:w-6 sm:h-6 text-teal-600" />
          Integrations Settings
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
          Configure external services and API integrations
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {/* Payment Gateways */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
            Payment Gateways
          </h2>
          
          <div className="space-y-6">
            {/* Paystack */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <span className="text-blue-600 dark:text-blue-400 font-bold text-sm">PS</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">Paystack</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Accept card payments</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.paystackEnabled}
                    onChange={(e) => handleChange('paystackEnabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 dark:peer-focus:ring-teal-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-teal-600"></div>
                </label>
              </div>
              
              {formData.paystackEnabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Public Key
                  </label>
                  <div className="relative">
                    <input
                      type={showKeys.paystack ? 'text' : 'password'}
                      value={formData.paystackPublicKey || ''}
                      onChange={(e) => handleChange('paystackPublicKey', e.target.value)}
                      placeholder="pk_live_xxxxx"
                      className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey('paystack')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                    >
                      {showKeys.paystack ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Nomba */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                    <span className="text-purple-600 dark:text-purple-400 font-bold text-sm">NB</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">Nomba</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Alternative payment provider</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.nombaEnabled}
                    onChange={(e) => handleChange('nombaEnabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 dark:peer-focus:ring-teal-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-teal-600"></div>
                </label>
              </div>
              
              {formData.nombaEnabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Account ID
                  </label>
                  <input
                    type="text"
                    value={formData.nombaAccountId || ''}
                    onChange={(e) => handleChange('nombaAccountId', e.target.value)}
                    placeholder="Your Nomba Account ID"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SMS Provider */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
            SMS Provider
          </h2>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              SMS Service
            </label>
            <select
              value={formData.smsProvider}
              onChange={(e) => handleChange('smsProvider', e.target.value)}
              className="w-full md:w-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="none">Disabled</option>
              <option value="termii">Termii</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              SMS provider for sending notifications and reminders
            </p>
          </div>
        </div>

        {/* API Access */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
            API Access
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-gray-900 dark:text-white">
                  Enable API Access
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Allow external applications to access your data via API
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.apiAccessEnabled}
                  onChange={(e) => handleChange('apiAccessEnabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 dark:peer-focus:ring-teal-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-teal-600"></div>
              </label>
            </div>

            {formData.apiAccessEnabled && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-700 dark:text-amber-300">
                  <p className="font-medium">Enterprise Feature</p>
                  <p className="mt-1">
                    API access is available on Enterprise plans. Contact support to enable this feature.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
          {hasChanges && (
            <span className="text-sm text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1">
              Unsaved changes
            </span>
          )}
          <button
            type="submit"
            disabled={!hasChanges || updateMutation.isPending}
            className="w-full sm:w-auto px-6 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
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
