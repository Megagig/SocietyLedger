'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { IconArrowLeft } from '@tabler/icons-react';
import { getPoll, updatePoll } from '@/lib/api/voting';
import { toast } from '@/lib/toast';

// R2.5/G31: this route never existed — the poll detail page's Edit button
// pointed here and 404'd. pollType/options aren't editable (updatePollSchema
// doesn't accept them — only Add/Delete Option endpoints change options).
export default function EditPollPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const pollId = parseInt(params.id as string);

  const { data: pollData, isLoading } = useQuery({
    queryKey: ['poll', pollId],
    queryFn: () => getPoll(pollId),
  });
  const poll = pollData?.data;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [allowMultipleVotes, setAllowMultipleVotes] = useState(false);
  const [showResultsBeforeEnd, setShowResultsBeforeEnd] = useState(false);

  const toLocalInput = (iso?: string) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');

  useEffect(() => {
    if (!poll) return;
    setTitle(poll.title);
    setDescription(poll.description || '');
    setStartDate(toLocalInput(poll.startDate));
    setEndDate(toLocalInput(poll.endDate));
    setIsAnonymous(poll.isAnonymous);
    setAllowMultipleVotes(poll.allowMultipleVotes);
    setShowResultsBeforeEnd(poll.showResultsBeforeEnd);
  }, [poll]);

  const updateMutation = useMutation({
    mutationFn: () =>
      updatePoll(pollId, {
        title,
        description: description || undefined,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        isAnonymous,
        allowMultipleVotes,
        showResultsBeforeEnd,
      }),
    onSuccess: () => {
      toast.success('Poll updated');
      queryClient.invalidateQueries({ queryKey: ['poll', pollId] });
      router.push(`/dashboard/governance/polls/${pollId}`);
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

  if (!poll) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">Poll not found</p>
      </div>
    );
  }

  if (poll.status !== 'DRAFT') {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">Only draft polls can be edited.</p>
        <Link href={`/dashboard/governance/polls/${pollId}`} className="text-teal-600 hover:underline">
          Back to poll
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/dashboard/governance/polls/${pollId}`}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <IconArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Poll</h1>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(); }}
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-6"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Poll Question *</label>
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
            rows={2}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400">
          Poll type and options can&apos;t be changed after creation — delete and recreate the poll if you need a different type.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Start Date *</label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">End Date *</label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
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
            <span className="text-sm text-gray-700 dark:text-gray-300">Anonymous responses</span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={allowMultipleVotes}
              onChange={(e) => setAllowMultipleVotes(e.target.checked)}
              className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Allow members to change their response</span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={showResultsBeforeEnd}
              onChange={(e) => setShowResultsBeforeEnd(e.target.checked)}
              className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Show results before the poll ends</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Link
            href={`/dashboard/governance/polls/${pollId}`}
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
