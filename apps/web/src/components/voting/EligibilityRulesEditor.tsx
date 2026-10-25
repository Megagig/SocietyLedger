'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getEligibilityOptions,
  previewEligibility,
  type CandidateRule,
  type EligibilityPreview,
  type EligibilityRules,
  type MemberRule,
} from '@/lib/api/voting';

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const inputClass =
  'w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-teal-500';

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 w-4 h-4 text-teal-600 rounded focus:ring-teal-500" />
      <span>{children}</span>
    </label>
  );
}

/** The conditions shared by voters and candidates. Each one is switched on by ticking it; what is switched off isn't checked at all. */
function ConditionFields<T extends MemberRule>({ rule, onChange, categories, scopeWord }: { rule: T; onChange: (next: T) => void; categories: string[]; scopeWord: string }) {
  const set = (patch: Partial<T>) => {
    const next = { ...rule, ...patch } as T;
    (Object.keys(next) as (keyof T)[]).forEach((k) => next[k] === undefined && delete next[k]);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Check checked={!!rule.financialStanding} onChange={(on) => set({ financialStanding: on ? { maxOverdue: 0 } : undefined } as Partial<T>)}>
          Only members in good financial standing can {scopeWord}
        </Check>
        {rule.financialStanding && (
          <div className="ml-7 flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            May owe up to ₦
            <input
              type="number"
              min={0}
              value={rule.financialStanding.maxOverdue}
              onChange={(e) => set({ financialStanding: { maxOverdue: Math.max(0, Number(e.target.value) || 0) } } as Partial<T>)}
              className={inputClass}
              aria-label="Most a member may owe on overdue charges"
            />
            on overdue charges (0 means nothing overdue)
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Check checked={rule.minMembershipMonths !== undefined} onChange={(on) => set({ minMembershipMonths: on ? 12 : undefined } as Partial<T>)}>
          Only members of a minimum length can {scopeWord}
        </Check>
        {rule.minMembershipMonths !== undefined && (
          <div className="ml-7 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            At least
            <input
              type="number"
              min={1}
              value={rule.minMembershipMonths}
              onChange={(e) => set({ minMembershipMonths: Math.max(1, Math.floor(Number(e.target.value) || 1)) } as Partial<T>)}
              className={inputClass}
              aria-label="Months of membership"
            />
            months a member
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Check checked={rule.categories !== undefined} onChange={(on) => set({ categories: on ? categories.slice(0, 1) : undefined } as Partial<T>)}>
          Only some kinds of member can {scopeWord}
        </Check>
        {rule.categories !== undefined && (
          <div className="ml-7 flex flex-wrap gap-2">
            {categories.map((c) => {
              const on = rule.categories!.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => set({ categories: on ? rule.categories!.filter((x) => x !== c) : [...rule.categories!, c] } as Partial<T>)}
                  className={`px-3 py-1 rounded-full text-sm border ${on ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}`}
                  aria-pressed={on}
                >
                  {titleCase(c)}
                </button>
              );
            })}
            {rule.categories.length === 0 && <span className="text-sm text-red-600">Choose at least one</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Who can vote and who can stand. Nothing is switched on to begin with, which means every active member can do both, as always. Each tick
 * adds a condition; the preview shows what the rule would do to this association's members before it is saved.
 */
export function EligibilityRulesEditor({ value, onChange, showPreview = true }: { value: EligibilityRules | null; onChange: (rules: EligibilityRules | null) => void; showPreview?: boolean }) {
  const { data: options } = useQuery({ queryKey: ['eligibility-options'], queryFn: getEligibilityOptions, staleTime: 5 * 60 * 1000 });
  const categories = options?.categories ?? ['regular', 'executive', 'honorary', 'student'];
  const [preview, setPreview] = useState<EligibilityPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const rules = value ?? {};
  const restricted = !!rules.voters || !!rules.candidates;

  const emit = (next: EligibilityRules) => {
    setPreview(null);
    const cleaned: EligibilityRules = {};
    if (next.voters && Object.keys(next.voters).length > 0) cleaned.voters = next.voters;
    if (next.candidates && Object.keys(next.candidates).length > 0) cleaned.candidates = next.candidates;
    onChange(cleaned.voters || cleaned.candidates ? cleaned : null);
  };

  const runPreview = async () => {
    setPreviewing(true);
    setPreviewError(null);
    try {
      setPreview(await previewEligibility(value));
    } catch (e) {
      setPreviewError((e as Error).message);
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className="space-y-5" data-testid="eligibility-editor">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {restricted ? 'Only members who meet these conditions can vote or stand.' : 'Every active member can vote and stand. Tick a condition below to narrow it.'}
      </p>

      <fieldset className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <legend className="px-2 text-sm font-semibold text-gray-900 dark:text-white">Who can vote</legend>
        <ConditionFields<MemberRule> rule={rules.voters ?? {}} onChange={(voters) => emit({ ...rules, voters })} categories={categories} scopeWord="vote" />
      </fieldset>

      <fieldset className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <legend className="px-2 text-sm font-semibold text-gray-900 dark:text-white">Who can stand</legend>
        <ConditionFields<CandidateRule> rule={rules.candidates ?? {}} onChange={(candidates) => emit({ ...rules, candidates })} categories={categories} scopeWord="stand" />
        <Check checked={!!rules.candidates?.mustBeVoter} onChange={(on) => emit({ ...rules, candidates: { ...(rules.candidates ?? {}), mustBeVoter: on || undefined } })}>
          A candidate must also be allowed to vote
        </Check>
        <div className="space-y-1.5">
          <Check checked={rules.candidates?.maxPositions !== undefined} onChange={(on) => emit({ ...rules, candidates: { ...(rules.candidates ?? {}), maxPositions: on ? 1 : undefined } })}>
            Limit how many positions one person can stand for
          </Check>
          {rules.candidates?.maxPositions !== undefined && (
            <div className="ml-7 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              At most
              <input
                type="number"
                min={1}
                value={rules.candidates.maxPositions}
                onChange={(e) => emit({ ...rules, candidates: { ...rules.candidates, maxPositions: Math.max(1, Math.floor(Number(e.target.value) || 1)) } })}
                className={inputClass}
                aria-label="Most positions one person can stand for"
              />
              positions
            </div>
          )}
        </div>
      </fieldset>

      {showPreview && (
        <div className="space-y-3">
          <button type="button" onClick={runPreview} disabled={previewing} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">
            {previewing ? 'Checking…' : 'See who this would let in'}
          </button>
          {previewError && <p className="text-sm text-red-600">{previewError}</p>}
          {preview && (
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4 text-sm text-gray-700 dark:text-gray-300 space-y-2" data-testid="eligibility-preview">
              <p>
                <strong>{preview.canVote}</strong> of {preview.activeMembers} active members could vote, and <strong>{preview.canStand}</strong> could stand.
              </p>
              {preview.turnedAway.length > 0 && (
                <ul className="max-h-48 overflow-y-auto space-y-1">
                  {preview.turnedAway.slice(0, 30).map((t, i) => (
                    <li key={`${t.memberId}-${t.scope}-${i}`}>
                      <span className="font-medium">{t.name}</span> ({t.memberNumber}) can&apos;t {t.scope === 'VOTE' ? 'vote' : 'stand'}: {t.reason}
                    </li>
                  ))}
                  {preview.turnedAway.length > 30 && <li>…and more.</li>}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
