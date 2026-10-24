'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Select, Textarea } from '@mantine/core';
import {
  addEligibilityException,
  getElectionEligibility,
  getMyEligibility,
  removeEligibilityException,
  searchCandidateMembers,
  setElectionEligibility,
  type EligibilityRules,
  type ElectionStatus,
} from '@/lib/api/voting';
import { toast } from '@/lib/toast';
import { EligibilityRulesEditor } from './EligibilityRulesEditor';

const BEFORE_VOTING: ElectionStatus[] = ['DRAFT', 'NOMINATIONS_OPEN', 'NOMINATIONS_CLOSED'];
const EXCEPTIONS_OPEN: ElectionStatus[] = ['DRAFT', 'NOMINATIONS_OPEN', 'NOMINATIONS_CLOSED', 'VOTING_OPEN'];

/**
 * One line for a member on a list of elections: why they can't vote in this one, when the association's rules say so. Shows nothing for
 * anyone who can — which is everyone, unless the association has set a rule.
 */
export function IneligibleNote({ electionId }: { electionId: number }) {
  const { data } = useQuery({ queryKey: ['my-eligibility', electionId], queryFn: () => getMyEligibility(electionId) });
  if (!data || data.vote.eligible) return null;
  return (
    <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300" data-testid="ineligible-note">
      {data.vote.reason}
    </p>
  );
}

/**
 * What an election asks of people, and the committee's tools for it. Everyone sees the requirements and whether they meet them (only when
 * the association has set any). The committee can change the rules until voting opens and name exceptions until it closes.
 */
export function EligibilityPanel({ electionId, status, canManage }: { electionId: number; status: ElectionStatus; canManage: boolean }) {
  const queryClient = useQueryClient();
  const { data: mine } = useQuery({ queryKey: ['my-eligibility', electionId], queryFn: () => getMyEligibility(electionId) });
  const { data: managed } = useQuery({ queryKey: ['election-eligibility', electionId], queryFn: () => getElectionEligibility(electionId), enabled: canManage });

  const [draft, setDraft] = useState<EligibilityRules | null>(null);
  const [editing, setEditing] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberId, setMemberId] = useState<string | null>(null);
  const [scope, setScope] = useState<'VOTE' | 'STAND'>('VOTE');
  const [kind, setKind] = useState<'ALLOW' | 'BAR'>('ALLOW');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (managed && !editing) setDraft(managed.rules);
  }, [managed, editing]);

  const { data: members } = useQuery({ queryKey: ['exception-members', memberSearch], queryFn: () => searchCandidateMembers(memberSearch), enabled: canManage });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['election-eligibility', electionId] });
    queryClient.invalidateQueries({ queryKey: ['my-eligibility', electionId] });
    queryClient.invalidateQueries({ queryKey: ['election-progress', electionId] });
  };

  const saveRules = useMutation({
    mutationFn: () => setElectionEligibility(electionId, draft),
    onSuccess: () => {
      toast.success('Rules saved');
      setEditing(false);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addException = useMutation({
    mutationFn: () => addEligibilityException(electionId, { memberId: Number(memberId), scope, kind, reason }),
    onSuccess: () => {
      toast.success('Exception saved');
      setMemberId(null);
      setReason('');
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeException = useMutation({
    mutationFn: removeEligibilityException,
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const hasRules = !!mine?.hasRules;
  const showForManager = canManage;
  if (!hasRules && !showForManager) return null;

  const relevant = status === 'VOTING_OPEN' || status === 'VOTING_CLOSED' ? 'vote' : status === 'DRAFT' || status === 'NOMINATIONS_OPEN' ? 'stand' : null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5" data-testid="eligibility-panel">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Who can vote and stand</h2>

      {hasRules && mine && (
        <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
          {mine.requirements.voters.length > 0 && (
            <div>
              <p className="font-medium">To vote</p>
              <ul className="list-disc pl-5">{mine.requirements.voters.map((r) => <li key={r}>{r}</li>)}</ul>
            </div>
          )}
          {mine.requirements.candidates.length > 0 && (
            <div>
              <p className="font-medium">To stand</p>
              <ul className="list-disc pl-5">{mine.requirements.candidates.map((r) => <li key={r}>{r}</li>)}</ul>
            </div>
          )}
          {relevant && (
            <p
              className={`rounded-lg p-3 ${(relevant === 'vote' ? mine.vote : mine.stand).eligible ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300'}`}
              data-testid="my-eligibility"
            >
              {(relevant === 'vote' ? mine.vote : mine.stand).eligible
                ? relevant === 'vote' ? 'You can vote in this election.' : 'You can stand in this election.'
                : (relevant === 'vote' ? mine.vote : mine.stand).reason}
            </p>
          )}
        </div>
      )}
      {!hasRules && showForManager && (
        <p className="text-sm text-gray-600 dark:text-gray-400">No rules are set, so every active member can vote and stand.</p>
      )}

      {showForManager && (
        <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
          {BEFORE_VOTING.includes(status) ? (
            editing ? (
              <div className="space-y-4">
                <EligibilityRulesEditor value={draft} onChange={setDraft} />
                <div className="flex gap-2">
                  <button onClick={() => saveRules.mutate()} disabled={saveRules.isPending} className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
                    {saveRules.isPending ? 'Saving…' : 'Save rules'}
                  </button>
                  <button onClick={() => { setEditing(false); setDraft(managed?.rules ?? null); }} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setEditing(true)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                Change the rules
              </button>
            )
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">The rules are fixed once voting opens. Add an exception for a single member below.</p>
          )}

          {EXCEPTIONS_OPEN.includes(status) && (
            <div className="space-y-3">
              <h3 className="font-medium text-gray-900 dark:text-white">Exceptions</h3>
              {managed && managed.exceptions.length > 0 ? (
                <ul className="space-y-2">
                  {managed.exceptions.map((x) => (
                    <li key={x.id} className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-sm">
                      <span>
                        <strong>{x.member.firstName} {x.member.lastName}</strong> ({x.member.memberId}) — {x.kind === 'ALLOW' ? 'allowed to' : 'barred from'} {x.scope === 'VOTE' ? 'vote' : 'stand'}.
                        <br />
                        <span className="text-gray-500 dark:text-gray-400">Reason: {x.reason}</span>
                      </span>
                      <button onClick={() => removeException.mutate(x.id)} className="text-red-600 hover:underline shrink-0">Remove</button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">None. Use an exception to let one member in, or keep one out, whatever the rules say.</p>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label="Member"
                  placeholder="Search for a member…"
                  searchable
                  searchValue={memberSearch}
                  onSearchChange={setMemberSearch}
                  data={(members?.data ?? []).map((m) => ({ value: String(m.id), label: `${m.firstName} ${m.lastName} (${m.memberId})` }))}
                  value={memberId}
                  onChange={setMemberId}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Select label="For" data={[{ value: 'VOTE', label: 'Voting' }, { value: 'STAND', label: 'Standing' }]} value={scope} onChange={(v) => v && setScope(v as 'VOTE' | 'STAND')} allowDeselect={false} />
                  <Select label="Make them" data={[{ value: 'ALLOW', label: 'Allowed' }, { value: 'BAR', label: 'Barred' }]} value={kind} onChange={(v) => v && setKind(v as 'ALLOW' | 'BAR')} allowDeselect={false} />
                </div>
              </div>
              <Textarea label="Reason (kept on record)" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
              <button
                onClick={() => addException.mutate()}
                disabled={!memberId || reason.trim().length < 3 || addException.isPending}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                {addException.isPending ? 'Saving…' : 'Save exception'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
