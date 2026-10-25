'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { API_ROUTES } from '@/utils/constants';
import { MAX_TEAM_INVITES, ONBOARDING_TEAM_ROLES, onboardingTeamInviteSchema } from '@societyledger/shared';

interface TeamMember {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface InviteResult {
  email: string;
  status: 'invited' | 'invited_email_failed' | 'already_member' | 'failed';
  message?: string;
}

const emptyPerson = (): TeamMember => ({ firstName: '', lastName: '', email: '', role: 'treasurer' });

const inputClass =
  'w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent';

const STATUS_TEXT: Record<InviteResult['status'], string> = {
  invited: 'Invitation sent',
  invited_email_failed: 'Added, but the email could not be sent. Resend it from Members.',
  already_member: 'Already a member',
  failed: 'Could not be invited',
};

export default function TeamSetupPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([emptyPerson()]);
  const [results, setResults] = useState<InviteResult[] | null>(null);

  const addMember = () => {
    if (members.length < MAX_TEAM_INVITES) setMembers([...members, emptyPerson()]);
  };

  const removeMember = (index: number) => {
    setMembers(members.filter((_, i) => i !== index));
  };

  const updateMember = (index: number, field: keyof TeamMember, value: string) => {
    setMembers(members.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  };

  const finishStep = async (skipped: boolean) => {
    await api.patch(API_ROUTES.ONBOARDING.COMPLETE_STEP, { step: 2, stepName: 'team', skipped });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Rows left completely empty are ignored
    const filled = members.filter((m) => m.firstName.trim() || m.lastName.trim() || m.email.trim());
    if (filled.length === 0) {
      setError('Add at least one person, or skip this step.');
      return;
    }
    const checked = onboardingTeamInviteSchema.safeParse({ invites: filled });
    if (!checked.success) {
      setError(checked.error.issues[0]?.message ?? 'Please check the details');
      return;
    }

    setSaving(true);
    try {
      const response = await api.post('/onboarding/team', checked.data);
      const outcome: InviteResult[] = response.data.data.results;
      const anyInvited = outcome.some((r) => r.status === 'invited' || r.status === 'invited_email_failed');
      // Finished only if someone was really invited; otherwise they stay on this step to fix what went wrong
      if (anyInvited) {
        await finishStep(false);
        setResults(outcome);
      } else {
        setResults(outcome);
        setError('Nobody could be invited. Check the messages below and try again, or skip this step.');
      }
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message || 'We could not send the invitations. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSkipStep = async () => {
    try {
      await finishStep(true);
    } finally {
      router.push('/onboarding/members');
    }
  };

  if (results && results.some((r) => r.status === 'invited' || r.status === 'invited_email_failed')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
        <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-teal-100 dark:bg-teal-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckIcon className="w-8 h-8 text-teal-600 dark:text-teal-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Team Invited</h2>
            <p className="text-gray-600 dark:text-gray-400">They can set a password from the email and will have the role you chose.</p>
          </div>
          <ul className="space-y-2 mb-6">
            {results.map((r) => (
              <li key={r.email} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <span className="text-gray-900 dark:text-gray-100 break-all">{r.email}</span>
                <span className={`text-sm text-right ${r.status === 'invited' ? 'text-teal-600 dark:text-teal-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {r.message ?? STATUS_TEXT[r.status]}
                </span>
              </li>
            ))}
          </ul>
          <button
            onClick={() => router.push('/onboarding/members')}
            className="w-full px-6 py-3 bg-gradient-to-r from-teal-500 to-green-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-green-600 transition-all shadow-lg"
          >
            Continue to Member Import
          </button>
        </div>
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
              Step 2 of 5
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Invite Your Team
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Add the officers who will help manage your association
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div role="alert" className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
              {error}
              {results && (
                <ul className="mt-2 list-disc list-inside">
                  {results.map((r) => (
                    <li key={r.email}>{r.email}: {r.message ?? STATUS_TEXT[r.status]}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
            <div className="space-y-6">
              {members.map((member, index) => (
                <div key={index} className="space-y-3 pb-6 border-b border-gray-100 dark:border-gray-700 last:border-0 last:pb-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={member.firstName}
                      onChange={(e) => updateMember(index, 'firstName', e.target.value)}
                      placeholder="First name"
                      aria-label="First name"
                      autoComplete="off"
                      className={inputClass}
                    />
                    <input
                      type="text"
                      value={member.lastName}
                      onChange={(e) => updateMember(index, 'lastName', e.target.value)}
                      placeholder="Last name"
                      aria-label="Last name"
                      autoComplete="off"
                      className={inputClass}
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-start">
                    <input
                      type="email"
                      value={member.email}
                      onChange={(e) => updateMember(index, 'email', e.target.value)}
                      placeholder="team@example.com"
                      aria-label="Email"
                      autoComplete="off"
                      className={`flex-1 ${inputClass}`}
                    />
                    <select
                      value={member.role}
                      onChange={(e) => updateMember(index, 'role', e.target.value)}
                      aria-label="Role"
                      className={`sm:w-48 ${inputClass}`}
                    >
                      {ONBOARDING_TEAM_ROLES.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                    {members.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMember(index)}
                        aria-label="Remove this person"
                        className="p-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors self-end sm:self-auto"
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {members.length < MAX_TEAM_INVITES && (
              <button
                type="button"
                onClick={addMember}
                className="mt-4 flex items-center gap-2 text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium"
              >
                <PlusIcon /> Add another team member
              </button>
            )}
          </div>

          {/* Role Descriptions */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Role Permissions</h3>
            <div className="space-y-3">
              {ONBOARDING_TEAM_ROLES.map((role) => (
                <div key={role.value} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-teal-500 mt-2"></div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{role.label}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{role.description}</p>
                  </div>
                </div>
              ))}
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
              {saving ? 'Sending Invites...' : 'Send Invites'}
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

function PlusIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
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

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
