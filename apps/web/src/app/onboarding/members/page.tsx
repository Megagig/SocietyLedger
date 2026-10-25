'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { API_ROUTES } from '@/utils/constants';

interface ParsedMember {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  category: string;
}

export default function MembersImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsedMembers, setParsedMembers] = useState<ParsedMember[]>([]);
  const [importMethod, setImportMethod] = useState<'csv' | 'manual' | null>(null);
  const [manualMember, setManualMember] = useState<ParsedMember>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    category: 'regular',
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseCSV(selectedFile);
    }
  };

  const parseCSV = async (file: File) => {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    
    const members: ParsedMember[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const member: ParsedMember = {
        firstName: values[headers.indexOf('first_name')] || values[headers.indexOf('firstname')] || values[0] || '',
        lastName: values[headers.indexOf('last_name')] || values[headers.indexOf('lastname')] || values[1] || '',
        email: values[headers.indexOf('email')] || values[2] || '',
        phone: values[headers.indexOf('phone')] || values[3] || '',
        category: values[headers.indexOf('category')] || 'regular',
      };
      if (member.firstName || member.lastName) {
        members.push(member);
      }
    }
    setParsedMembers(members);
  };

  const addManualMember = () => {
    if (manualMember.firstName && manualMember.lastName) {
      setParsedMembers([...parsedMembers, { ...manualMember }]);
      setManualMember({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        category: 'regular',
      });
    }
  };

  const removeMember = (index: number) => {
    setParsedMembers(parsedMembers.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      // Import members via bulk API if there are any
      if (parsedMembers.length > 0) {
        await api.post(
          API_ROUTES.MEMBERS.BULK,
          { members: parsedMembers }
        );
      }

      await api.patch(
        API_ROUTES.ONBOARDING.COMPLETE_STEP,
        parsedMembers.length > 0
          ? { step: 3, stepName: 'members' }
          : { step: 3, stepName: 'members', skipped: true }
      );
      router.push('/onboarding/finance');
    } catch (err) {
      console.error('Failed to import members:', err);
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message || 'We could not import your members. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSkipStep = async () => {
    try {
      await api.patch(
        API_ROUTES.ONBOARDING.COMPLETE_STEP,
        { step: 3, stepName: 'members', skipped: true }
      );
      router.push('/onboarding/finance');
    } catch (error) {
      router.push('/onboarding/finance');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      <div className="max-w-3xl mx-auto">
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
              Step 3 of 5
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Import Members
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Add your existing members via CSV upload or manually
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div role="alert" className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
          {/* Import Method Selection */}
          {!importMethod && (
            <div className="grid md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setImportMethod('csv')}
                className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-xl hover:shadow-2xl transition-all text-left border-2 border-transparent hover:border-teal-500"
              >
                <div className="w-12 h-12 bg-teal-100 dark:bg-teal-900 rounded-xl flex items-center justify-center mb-4">
                  <UploadIcon className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Upload CSV File
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Import multiple members at once from a spreadsheet
                </p>
              </button>

              <button
                type="button"
                onClick={() => setImportMethod('manual')}
                className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-xl hover:shadow-2xl transition-all text-left border-2 border-transparent hover:border-teal-500"
              >
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-xl flex items-center justify-center mb-4">
                  <UserPlusIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Add Manually
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Enter member details one by one
                </p>
              </button>
            </div>
          )}

          {/* CSV Upload */}
          {importMethod === 'csv' && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Upload CSV</h3>
                <button
                  type="button"
                  onClick={() => { setImportMethod(null); setFile(null); setParsedMembers([]); }}
                  className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  Change method
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />

              {!file ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center cursor-pointer hover:border-teal-500 transition-colors"
                >
                  <UploadIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400 mb-2">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500">
                    CSV file with columns: first_name, last_name, email, phone
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-4 p-4 bg-teal-50 dark:bg-teal-900/20 rounded-xl">
                  <FileIcon className="w-8 h-8 text-teal-600 dark:text-teal-400" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{file.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {parsedMembers.length} members found
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setFile(null); setParsedMembers([]); }}
                    className="text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Manual Entry */}
          {importMethod === 'manual' && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Add Member</h3>
                <button
                  type="button"
                  onClick={() => { setImportMethod(null); setParsedMembers([]); }}
                  className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  Change method
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <input
                  type="text"
                  placeholder="First Name *"
                  value={manualMember.firstName}
                  onChange={(e) => setManualMember({ ...manualMember, firstName: e.target.value })}
                  className="px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-teal-500"
                />
                <input
                  type="text"
                  placeholder="Last Name *"
                  value={manualMember.lastName}
                  onChange={(e) => setManualMember({ ...manualMember, lastName: e.target.value })}
                  className="px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-teal-500"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={manualMember.email}
                  onChange={(e) => setManualMember({ ...manualMember, email: e.target.value })}
                  className="px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-teal-500"
                />
                <input
                  type="tel"
                  placeholder="Phone"
                  value={manualMember.phone}
                  onChange={(e) => setManualMember({ ...manualMember, phone: e.target.value })}
                  className="px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <button
                type="button"
                onClick={addManualMember}
                disabled={!manualMember.firstName || !manualMember.lastName}
                className="w-full py-3 bg-teal-100 dark:bg-teal-900 text-teal-600 dark:text-teal-400 font-medium rounded-lg hover:bg-teal-200 dark:hover:bg-teal-800 transition-colors disabled:opacity-50"
              >
                Add Member
              </button>
            </div>
          )}

          {/* Members Preview */}
          {parsedMembers.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Members to Import ({parsedMembers.length})
              </h3>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {parsedMembers.map((member, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {member.firstName} {member.lastName}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {member.email || 'No email'} • {member.phone || 'No phone'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeMember(index)}
                      className="text-red-500 hover:text-red-700 p-2"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

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
              {saving ? 'Importing...' : parsedMembers.length > 0 ? `Import ${parsedMembers.length} Members` : 'Continue to Finance Setup'}
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

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  );
}

function UserPlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}
