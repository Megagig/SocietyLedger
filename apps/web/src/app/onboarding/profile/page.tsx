'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { API_ROUTES } from '@/utils/constants';

const inputClass =
  'w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2';

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

const messageFrom = (error: unknown, fallback: string): string => {
  const data = (error as { response?: { data?: { message?: string } } })?.response?.data;
  return data?.message || fallback;
};

export default function ProfileSetupPage() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    primaryColor: '#14b8a6',
    address: '',
    phone: '',
    email: '',
  });

  useEffect(() => {
    fetchAssociationData();
  }, []);

  // Free the temporary preview URL when it is replaced or the page closes
  useEffect(() => {
    return () => {
      if (logoPreview.startsWith('blob:')) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  const fetchAssociationData = async () => {
    setLoading(true);
    try {
      const response = await api.get(API_ROUTES.ONBOARDING.STATUS);
      const association = response.data.data.association;
      if (association) {
        setFormData((prev) => ({
          ...prev,
          name: association.name || '',
          primaryColor: association.primaryColor || prev.primaryColor,
        }));
        setLogoPreview(association.logo || '');
      }
      // Contact details already saved (for example when they come back to this step)
      try {
        const profile = await api.get('/settings/association/profile');
        const saved = profile.data.data ?? {};
        setFormData((prev) => ({
          ...prev,
          address: saved.address ?? '',
          phone: saved.phone ?? '',
          email: saved.email ?? '',
        }));
      } catch {
        // Not critical: the fields just start empty
      }
    } catch (err) {
      console.error('Failed to fetch association data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoPicked = (file: File | undefined) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Use a JPEG, PNG or WebP picture for the logo.');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError('The logo is larger than 2MB. Choose a smaller picture.');
      return;
    }
    setError(null);
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      // Empty fields are sent as empty text; the server reads that as "cleared".
      await api.patch('/settings/association/profile', {
        name: formData.name.trim() || undefined,
        primaryColor: formData.primaryColor,
        address: formData.address,
        phone: formData.phone,
        email: formData.email,
      });

      if (logoFile) {
        const body = new FormData();
        body.append('logo', logoFile);
        await api.post('/settings/association/logo', body);
      }

      await api.patch(API_ROUTES.ONBOARDING.COMPLETE_STEP, { step: 1, stepName: 'profile' });
      router.push('/onboarding/team');
    } catch (err) {
      console.error('Failed to save profile:', err);
      setError(messageFrom(err, 'We could not save your profile. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const handleSkipStep = async () => {
    try {
      await api.patch(API_ROUTES.ONBOARDING.COMPLETE_STEP, { step: 1, stepName: 'profile', skipped: true });
    } finally {
      router.push('/onboarding/team');
    }
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
            Customize your association&apos;s branding and contact details
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div role="alert" className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
            {/* Logo Upload */}
            <div className="mb-6">
              <label className={labelClass}>Association Logo</label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                  {logoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                <div>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => handleLogoPicked(e.target.files?.[0])}
                  />
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    {logoPreview ? 'Change picture' : 'Choose a picture'}
                  </button>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    JPEG, PNG or WebP, up to 2MB. Square, about 200x200px, looks best.
                  </p>
                </div>
              </div>
            </div>

            {/* Association Name */}
            <div className="mb-6">
              <label htmlFor="name" className={labelClass}>Association Name</label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={inputClass}
                placeholder="Enter your association name"
              />
            </div>

            {/* Contact details */}
            <div className="mb-6">
              <label htmlFor="address" className={labelClass}>Address (Optional)</label>
              <input
                id="address"
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className={inputClass}
                placeholder="Where the association meets or is based"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label htmlFor="phone" className={labelClass}>Phone (Optional)</label>
                <input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className={inputClass}
                  placeholder="0803 123 4567"
                />
              </div>
              <div>
                <label htmlFor="email" className={labelClass}>Email (Optional)</label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={inputClass}
                  placeholder="info@example.com"
                />
              </div>
            </div>

            {/* Primary Color */}
            <div>
              <label className={labelClass}>Primary Color</label>
              <div className="flex items-center gap-4">
                <input
                  type="color"
                  value={formData.primaryColor}
                  onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                  className="w-12 h-12 rounded-lg cursor-pointer border-0"
                  aria-label="Pick a colour"
                />
                <input
                  type="text"
                  value={formData.primaryColor}
                  onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                  className={`flex-1 ${inputClass}`}
                  placeholder="#14b8a6"
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                This color will be used throughout your dashboard
              </p>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Preview</h3>
            <div className="flex items-center gap-4 p-4 rounded-xl" style={{ backgroundColor: `${formData.primaryColor}15` }}>
              <div className="w-12 h-12 rounded-lg bg-white dark:bg-gray-700 flex items-center justify-center overflow-hidden shadow">
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
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
                  {formData.phone || formData.email || 'Contact details'}
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
