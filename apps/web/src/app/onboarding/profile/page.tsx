'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { API_ROUTES } from '@/utils/constants';

export default function ProfileSetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    logo: '',
    primaryColor: '#14b8a6',
    description: '',
  });

  useEffect(() => {
    fetchAssociationData();
  }, []);

  const fetchAssociationData = async () => {
    setLoading(true);
    try {
      const response = await api.get(API_ROUTES.ONBOARDING.STATUS);
      const association = response.data.data.association;
      if (association) {
        setFormData({
          name: association.name || '',
          logo: association.logo || '',
          primaryColor: association.primaryColor || '#14b8a6',
          description: '',
        });
      }
    } catch (error) {
      console.error('Failed to fetch association data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Complete the step
      await api.patch(
        API_ROUTES.ONBOARDING.COMPLETE_STEP,
        { step: 1, stepName: 'profile' }
      );
      router.push('/onboarding/team');
    } catch (error) {
      console.error('Failed to save profile:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSkipStep = () => {
    router.push('/onboarding/team');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/onboarding')}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4 flex items-center gap-2"
          >
            <ArrowLeftIcon /> Back to Overview
          </button>
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-teal-100 dark:bg-teal-900 text-teal-600 dark:text-teal-400 text-sm font-medium px-3 py-1 rounded-full">
              Step 1 of 5
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Association Profile
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Customize your association's branding and appearance
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
            {/* Logo Upload */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Association Logo
              </label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                  {formData.logo ? (
                    <img src={formData.logo} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                <div>
                  <input
                    type="url"
                    placeholder="Enter logo URL"
                    value={formData.logo}
                    onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Recommended: 200x200px, PNG or JPG
                  </p>
                </div>
              </div>
            </div>

            {/* Association Name */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Association Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="Enter your association name"
              />
            </div>

            {/* Primary Color */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Primary Color
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="color"
                  value={formData.primaryColor}
                  onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                  className="w-12 h-12 rounded-lg cursor-pointer border-0"
                />
                <input
                  type="text"
                  value={formData.primaryColor}
                  onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                  className="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="#14b8a6"
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                This color will be used throughout your dashboard
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description (Optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                placeholder="Brief description of your association"
              />
            </div>
          </div>

          {/* Preview */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Preview</h3>
            <div className="flex items-center gap-4 p-4 rounded-xl" style={{ backgroundColor: `${formData.primaryColor}15` }}>
              <div className="w-12 h-12 rounded-lg bg-white dark:bg-gray-700 flex items-center justify-center overflow-hidden shadow">
                {formData.logo ? (
                  <img src={formData.logo} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-bold" style={{ color: formData.primaryColor }}>
                    {formData.name?.charAt(0) || 'A'}
                  </span>
                )}
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                  {formData.name || 'Your Association'}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {formData.description || 'Association description'}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={handleSkipStep}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Skip this step
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-gradient-to-r from-teal-500 to-green-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-green-600 transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Continue to Team Setup'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ArrowLeftIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
