'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { 
  IconArrowLeft, 
  IconEdit, 
  IconUsers, 
  IconClock,
  IconChartBar,
  IconPlayerPlay,
  IconPlayerStop,
  IconX,
  IconCheck,
  IconChartPie
} from '@tabler/icons-react';
import { 
  getPoll, 
  getPollResults,
  startPoll,
  closePoll,
  cancelPoll,
  submitPollResponse,
  Poll,
  PollStatus
} from '@/lib/api/voting';
import { toast } from '@/lib/toast';

// Helper functions
const formatDateTime = (date: string) => new Date(date).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

// Status badge component
function StatusBadge({ status }: { status: PollStatus }) {
  const statusConfig: Record<PollStatus, { color: string; label: string }> = {
    DRAFT: { color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', label: 'Draft' },
    ACTIVE: { color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', label: 'Active' },
    CLOSED: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', label: 'Closed' },
    CANCELLED: { color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', label: 'Cancelled' },
  };

  const config = statusConfig[status];
  return (
    <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}

export default function PollDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const pollId = parseInt(params.id as string);
  const [selectedOptions, setSelectedOptions] = useState<number[]>([]);
  const [hasResponded, setHasResponded] = useState(false);

  const { data: pollData, isLoading } = useQuery({
    queryKey: ['poll', pollId],
    queryFn: () => getPoll(pollId),
  });

  const { data: resultsData } = useQuery({
    queryKey: ['poll-results', pollId],
    queryFn: () => getPollResults(pollId),
    enabled: !!pollId && (pollData?.data?.status === 'ACTIVE' || pollData?.data?.status === 'CLOSED'),
  });

  const poll = pollData?.data;
  const results = resultsData?.data;

  // Status action mutations
  const startPollMutation = useMutation({
    mutationFn: () => startPoll(pollId),
    onSuccess: () => {
      toast.success('Poll started!');
      queryClient.invalidateQueries({ queryKey: ['poll', pollId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const closePollMutation = useMutation({
    mutationFn: () => closePoll(pollId),
    onSuccess: () => {
      toast.success('Poll closed!');
      queryClient.invalidateQueries({ queryKey: ['poll', pollId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cancelPollMutation = useMutation({
    mutationFn: () => cancelPoll(pollId),
    onSuccess: () => {
      toast.success('Poll cancelled');
      queryClient.invalidateQueries({ queryKey: ['poll', pollId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const submitResponseMutation = useMutation({
    mutationFn: (optionIds: number[]) => submitPollResponse(pollId, { optionIds }),
    onSuccess: () => {
      toast.success('Response submitted!');
      setHasResponded(true);
      queryClient.invalidateQueries({ queryKey: ['poll-results', pollId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleOptionSelect = (optionId: number) => {
    if (poll?.pollType === 'SINGLE_CHOICE' || poll?.pollType === 'YES_NO') {
      setSelectedOptions([optionId]);
    } else {
      if (selectedOptions.includes(optionId)) {
        setSelectedOptions(selectedOptions.filter(id => id !== optionId));
      } else {
        if (poll?.maxSelections && selectedOptions.length >= poll.maxSelections) {
          toast.error(`You can only select up to ${poll.maxSelections} options`);
          return;
        }
        setSelectedOptions([...selectedOptions, optionId]);
      }
    }
  };

  const handleSubmitResponse = () => {
    if (selectedOptions.length === 0) {
      toast.error('Please select at least one option');
      return;
    }
    submitResponseMutation.mutate(selectedOptions);
  };

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
        <Link href="/dashboard/governance/polls" className="text-teal-600 hover:underline">
          Back to polls
        </Link>
      </div>
    );
  }

  const totalResponses = results?.totalResponses || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/governance/polls"
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <IconArrowLeft size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{poll.title}</h1>
              <StatusBadge status={poll.status} />
            </div>
            {poll.description && (
              <p className="text-gray-600 dark:text-gray-400">{poll.description}</p>
            )}
          </div>
        </div>
        
        {/* Action Buttons based on status */}
        <div className="flex gap-2">
          {poll.status === 'DRAFT' && (
            <>
              <Link
                href={`/dashboard/governance/polls/${pollId}/edit`}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <IconEdit size={18} />
                Edit
              </Link>
              <button
                onClick={() => startPollMutation.mutate()}
                disabled={startPollMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <IconPlayerPlay size={18} />
                Start Poll
              </button>
            </>
          )}
          {poll.status === 'ACTIVE' && (
            <button
              onClick={() => closePollMutation.mutate()}
              disabled={closePollMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <IconPlayerStop size={18} />
              Close Poll
            </button>
          )}
          {!['CANCELLED', 'CLOSED'].includes(poll.status) && (
            <button
              onClick={() => {
                if (confirm('Are you sure you want to cancel this poll?')) {
                  cancelPollMutation.mutate();
                }
              }}
              disabled={cancelPollMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
            >
              <IconX size={18} />
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Poll Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400 mb-2">
            <IconClock size={20} />
            <span className="text-sm font-medium">Duration</span>
          </div>
          <p className="text-gray-900 dark:text-white">
            {poll.startDate ? formatDateTime(poll.startDate) : 'Not set'}
            {poll.endDate && ` - ${formatDateTime(poll.endDate)}`}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400 mb-2">
            <IconUsers size={20} />
            <span className="text-sm font-medium">Responses</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalResponses}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400 mb-2">
            <IconChartPie size={20} />
            <span className="text-sm font-medium">Settings</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {poll.isAnonymous && (
              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Anonymous</span>
            )}
            {poll.allowMultipleResponses && (
              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Can Change</span>
            )}
            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs capitalize">
              {poll.pollType.replace('_', ' ').toLowerCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Options / Voting / Results */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {poll.status === 'ACTIVE' && !hasResponded ? 'Cast Your Vote' : 'Results'}
        </h2>

        {poll.options && poll.options.length > 0 ? (
          <div className="space-y-3">
            {poll.options.map((option) => {
              const optionResult = results?.options?.find(o => o.option.id === option.id);
              const percentage = optionResult?.percentage || 0;
              const responseCount = optionResult?.responseCount || 0;
              const isSelected = selectedOptions.includes(option.id);
              const showResults = poll.status !== 'DRAFT' && (poll.status !== 'ACTIVE' || hasResponded);

              return (
                <div
                  key={option.id}
                  className={`relative p-4 rounded-lg border transition-all ${
                    poll.status === 'ACTIVE' && !hasResponded
                      ? `cursor-pointer hover:border-teal-500 ${isSelected ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20' : 'border-gray-200 dark:border-gray-700'}`
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                  onClick={() => {
                    if (poll.status === 'ACTIVE' && !hasResponded) {
                      handleOptionSelect(option.id);
                    }
                  }}
                >
                  {showResults && (
                    <div
                      className="absolute inset-0 bg-teal-100 dark:bg-teal-900/30 rounded-lg transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  )}
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {poll.status === 'ACTIVE' && !hasResponded && (
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? 'border-teal-500 bg-teal-500' : 'border-gray-300 dark:border-gray-600'
                        }`}>
                          {isSelected && <IconCheck size={14} className="text-white" />}
                        </div>
                      )}
                      <span className="font-medium text-gray-900 dark:text-white">{option.text}</span>
                    </div>
                    {showResults && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-600 dark:text-gray-400">{responseCount} votes</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{percentage.toFixed(1)}%</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">No options available</p>
        )}

        {/* Submit button for active polls */}
        {poll.status === 'ACTIVE' && !hasResponded && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSubmitResponse}
              disabled={selectedOptions.length === 0 || submitResponseMutation.isPending}
              className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
            >
              {submitResponseMutation.isPending ? 'Submitting...' : 'Submit Vote'}
            </button>
          </div>
        )}

        {hasResponded && (
          <div className="mt-4 flex items-center gap-2 text-green-600 dark:text-green-400">
            <IconCheck size={18} />
            <span className="text-sm">Your response has been recorded</span>
          </div>
        )}
      </div>
    </div>
  );
}
