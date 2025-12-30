'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Save, Loader2, Download, AlertTriangle, Info } from 'lucide-react';
import api from '@/lib/axios';
import { toast } from '@/lib/toast';

interface DataPrivacySettings {
  dataRetentionMonths: number;
  softDeleteEnabled: boolean;
  anonymizeInactiveMembers: boolean;
  anonymizeAfterMonths?: number;
  allowDataExport: boolean;
  gdprCompliant: boolean;
}

export default function DataPrivacySettingsPage() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<DataPrivacySettings>({
    dataRetentionMonths: 84,
    softDeleteEnabled: true,
    anonymizeInactiveMembers: false,
    allowDataExport: true,
    gdprCompliant: false,
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'data_privacy'],
    queryFn: async () => {
      const response = await api.get('/settings/data_privacy');
      return response.data.data as DataPrivacySettings;
    },
  });

  useEffect(() => {
    if (data) {
      setFormData(data);
      setHasChanges(false);
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: async (settings: Partial<DataPrivacySettings>) => {
      const response = await api.patch('/settings/data_privacy', settings);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Data privacy settings updated');
      queryClient.invalidateQueries({ queryKey: ['settings', 'data_privacy'] });
      setHasChanges(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update settings');
    },
  });

  const handleChange = (field: keyof DataPrivacySettings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const response = await api.get('/settings/export');
      const blob = new Blob([JSON.stringify(response.data.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `association-data-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Data exported successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to export data');
    } finally {
      setIsExporting(false);
    }
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
          <Shield className="w-6 h-6 text-teal-600" />
          Data & Privacy Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage data retention, privacy, and compliance settings
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Data Export */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Data Export
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-gray-900 dark:text-white">
                  Allow Data Export
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Enable admins to export all association data
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.allowDataExport}
                  onChange={(e) => handleChange('allowDataExport', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 dark:peer-focus:ring-teal-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-teal-600"></div>
              </label>
            </div>

            {formData.allowDataExport && (
              <button
                type="button"
                onClick={handleExportData}
                disabled={isExporting}
                className="px-4 py-2 border border-teal-500 text-teal-600 dark:text-teal-400 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-900/20 flex items-center gap-2 transition-colors"
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Export All Settings
              </button>
            )}
          </div>
        </div>

        {/* Data Retention */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Data Retention
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Data Retention Period (Months)
              </label>
              <select
                value={formData.dataRetentionMonths}
                onChange={(e) => handleChange('dataRetentionMonths', parseInt(e.target.value))}
                className="w-full md:w-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value={12}>1 Year</option>
                <option value={24}>2 Years</option>
                <option value={36}>3 Years</option>
                <option value={60}>5 Years</option>
                <option value={84}>7 Years (Recommended)</option>
                <option value={120}>10 Years</option>
                <option value={0}>Forever</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                How long to keep financial records and transaction history
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-gray-900 dark:text-white">
                  Soft Delete
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Keep deleted records for recovery (recommended)
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.softDeleteEnabled}
                  onChange={(e) => handleChange('softDeleteEnabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 dark:peer-focus:ring-teal-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-teal-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Member Data */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Member Data
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-gray-900 dark:text-white">
                  Anonymize Inactive Members
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Remove personal data from long-inactive members
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.anonymizeInactiveMembers}
                  onChange={(e) => handleChange('anonymizeInactiveMembers', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 dark:peer-focus:ring-teal-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-teal-600"></div>
              </label>
            </div>

            {formData.anonymizeInactiveMembers && (
              <div className="pl-4 border-l-2 border-teal-500">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Anonymize After (Months of Inactivity)
                </label>
                <input
                  type="number"
                  min="12"
                  max="120"
                  value={formData.anonymizeAfterMonths || 36}
                  onChange={(e) => handleChange('anonymizeAfterMonths', parseInt(e.target.value))}
                  className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
            )}
          </div>
        </div>

        {/* Compliance */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Compliance
          </h2>
          
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-gray-900 dark:text-white">
                GDPR Compliance Mode
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Enable additional data protection features for EU compliance
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.gdprCompliant}
                onChange={(e) => handleChange('gdprCompliant', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 dark:peer-focus:ring-teal-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-teal-600"></div>
            </label>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex gap-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <p className="font-medium">Data Protection Notice</p>
            <p className="mt-1">
              Changes to data retention settings will only affect future data. Existing data will be retained according to the previous settings until manually purged.
            </p>
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
