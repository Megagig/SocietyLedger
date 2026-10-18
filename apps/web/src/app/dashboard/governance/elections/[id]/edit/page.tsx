'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { IconArrowLeft } from '@tabler/icons-react';
import { getElection, updateElection, ElectionType } from '@/lib/api/voting';
import { toast } from '@/lib/toast';

// R2.5/G31: this route never existed — the election detail page's Edit
// button pointed here and 404'd.
export default function EditElectionPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const electionId = parseInt(params.id as string);

  const { data: electionData, isLoading } = useQuery({
    queryKey: ['election', electionId],
    queryFn: () => getElection(electionId),
  });
  const election = electionData?.data;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [electionType, setElectionType] = useState<ElectionType>('GENERAL');
  const [nominationStartDate, setNominationStartDate] = useState('');
  const [nominationEndDate, setNominationEndDate] = useState('');
  const [votingStartDate, setVotingStartDate] = useState('');
  const [votingEndDate, setVotingEndDate] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [allowAbstention, setAllowAbstention] = useState(true);

  const toLocalInput = (iso?: string) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');

  useEffect(() => {
    if (!election) return;
    setTitle(election.title);
    setDescription(election.description || '');
    setElectionType(election.electionType);
    setNominationStartDate(toLocalInput(election.nominationStartDate));
    setNominationEndDate(toLocalInput(election.nominationEndDate));
    setVotingStartDate(toLocalInput(election.votingStartDate));
    setVotingEndDate(toLocalInput(election.votingEndDate));
    setIsAnonymous(election.isAnonymous);
    setAllowAbstention(election.allowAbstention);
  }, [election]);

  const updateMutation = useMutation({
    mutationFn: () =>
      updateElection(electionId, {
        title,
        description: description || undefined,
        electionType,
        nominationStartDate: nominationStartDate ? new Date(nominationStartDate).toISOString() : undefined,
        nominationEndDate: nominationEndDate ? new Date(nominationEndDate).toISOString() : undefined,
        votingStartDate: new Date(votingStartDate).toISOString(),
        votingEndDate: new Date(votingEndDate).toISOString(),
        isAnonymous,
        allowAbstention,
      }),
    onSuccess: () => {
      toast.success('Election updated');
      queryClient.invalidateQueries({ queryKey: ['election', electionId] });
      router.push(`/dashboard/governance/elections/${electionId}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
      </div>
    );
  }

  if (!election) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">Election not found</p>
      </div>
    );
  }

  if (election.status !== 'DRAFT') {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">Only draft elections can be edited.</p>
        <Link href={`/dashboard/governance/elections/${electionId}`} className="text-teal-600 hover:underline">
          Back to election
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/dashboard/governance/elections/${electionId}`}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <IconArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Election</h1>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(); }}
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-6"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Election Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Election Type *</label>
          <select
            value={electionType}
            onChange={(e) => setElectionType(e.target.value as ElectionType)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
          >
            <option value="GENERAL">General Election</option>
            <option value="EXECUTIVE">Executive Committee</option>
            <option value="COMMITTEE">Committee Member</option>
            <option value="SPECIAL">Special Purpose</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nomination Start Date</label>
            <input
              type="datetime-local"
              value={nominationStartDate}
              onChange={(e) => setNominationStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nomination End Date</label>
            <input
              type="datetime-local"
              value={nominationEndDate}
              onChange={(e) => setNominationEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Voting Start Date *</label>
            <input
              type="datetime-local"
              value={votingStartDate}
              onChange={(e) => setVotingStartDate(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Voting End Date *</label>
            <input
              type="datetime-local"
              value={votingEndDate}
              onChange={(e) => setVotingEndDate(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Anonymous voting (votes are not linked to voters)</span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={allowAbstention}
              onChange={(e) => setAllowAbstention(e.target.checked)}
              className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Allow abstaining from voting</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Link
            href={`/dashboard/governance/elections/${electionId}`}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
