'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconArrowLeft } from '@tabler/icons-react';
import { EligibilityRulesEditor } from '@/components/voting/EligibilityRulesEditor';
import { HelpLink } from '@/components/docs/HelpLink';
import { Can, usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';
import { getEligibilityTemplate, setEligibilityTemplate, type EligibilityRules } from '@/lib/api/voting';
import { toast } from '@/lib/toast';

/**
 * The association's rules for who can vote and who can stand. New elections start from these (the committee can still change them for a
 * single election), and an election that already exists is never changed by them. Nothing is set until the association chooses to:
 * without it every active member can vote and stand.
 */
export default function VotingRulesPage() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canSave = can(PERMISSIONS.ELECTION_RULES);
  const { data, isLoading, isError, error } = useQuery({ queryKey: ['eligibility-template'], queryFn: getEligibilityTemplate });
  const [rules, setRules] = useState<EligibilityRules | null>(null);

  useEffect(() => {
    if (data) setRules(data.rules);
  }, [data]);

  const save = useMutation({
    mutationFn: () => setEligibilityTemplate(rules),
    onSuccess: (saved) => {
      toast.success(saved.rules ? 'Rules saved. New elections will start from them.' : 'Rules cleared. Every active member can vote and stand.');
      queryClient.invalidateQueries({ queryKey: ['eligibility-template'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/governance/elections" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg" aria-label="Back to elections">
            <IconArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Voting rules</h1>
            <p className="text-gray-600 dark:text-gray-400">Who can vote and who can stand, for new elections</p>
          </div>
        </div>
        <HelpLink />
      </div>

      <Can permission={PERMISSIONS.ELECTION_RULES} anyPermissions={[PERMISSIONS.ELECTION_RULES, PERMISSIONS.ELECTION_MANAGE]}>
        {isLoading ? (
          <div className="animate-pulse h-64 bg-gray-100 dark:bg-gray-800 rounded-xl" />
        ) : isError ? (
          <p className="text-red-600">{(error as Error).message}</p>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
            <EligibilityRulesEditor value={rules} onChange={setRules} />
            {canSave ? (
              <div className="flex gap-2 border-t border-gray-200 dark:border-gray-700 pt-4">
                <button onClick={() => save.mutate()} disabled={save.isPending} className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
                  {save.isPending ? 'Saving…' : 'Save rules'}
                </button>
                {rules && (
                  <button onClick={() => setRules(null)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg">
                    Clear all rules
                  </button>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">Only the Administrator and the Election Committee can change these.</p>
            )}
          </div>
        )}
      </Can>
    </div>
  );
}
