'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { 
  IconArrowLeft, 
  IconEdit, 
  IconUsers, 
  IconCalendarEvent,
  IconChecklist,
  IconPlayerPlay,
  IconPlayerStop,
  IconCheck,
  IconX,
  IconPlus,
  IconUserPlus,
  IconChartBar
} from '@tabler/icons-react';
import { 
  getElection, 
  getCandidates,
  startNominations,
  closeNominations,
  startVoting,
  closeVoting,
  publishResults,
  cancelElection,
  castVote,
  getVoterStatus,
  Election,
  Candidate,
  ElectionStatus
} from '@/lib/api/voting';
import { toast } from '@/lib/toast';
import { modals } from '@mantine/modals';
import { Text } from '@mantine/core';

// Helper functions
const formatDate = (date: string) => new Date(date).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });
const formatDateTime = (date: string) => new Date(date).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

// Status badge component
function StatusBadge({ status }: { status: ElectionStatus }) {
  const statusConfig: Record<ElectionStatus, { color: string; label: string }> = {
    DRAFT: { color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', label: 'Draft' },
    NOMINATIONS_OPEN: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', label: 'Nominations Open' },
    NOMINATIONS_CLOSED: { color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', label: 'Nominations Closed' },
    VOTING_OPEN: { color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', label: 'Voting Open' },
    VOTING_CLOSED: { color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', label: 'Voting Closed' },
    RESULTS_PUBLISHED: { color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', label: 'Results Published' },
    CANCELLED: { color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', label: 'Cancelled' },
  };

  const config = statusConfig[status];
  return (
    <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}

// Candidate status badge
function CandidateStatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { color: string; label: string }> = {
    PENDING: { color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', label: 'Pending' },
    APPROVED: { color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', label: 'Approved' },
    REJECTED: { color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', label: 'Rejected' },
    WITHDRAWN: { color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', label: 'Withdrawn' },
  };

  const config = statusConfig[status] || { color: 'bg-gray-100 text-gray-700', label: status };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}

export default function ElectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const electionId = parseInt(params.id as string);
  const [selectedVotes, setSelectedVotes] = useState<Record<number, number | 'abstain'>>({});

  const { data: electionData, isLoading } = useQuery({
    queryKey: ['election', electionId],
    queryFn: () => getElection(electionId),
  });

  const { data: candidatesData } = useQuery({
    queryKey: ['election-candidates', electionId],
    queryFn: () => getCandidates(electionId),
    enabled: !!electionId,
  });

  const { data: voterStatusData } = useQuery({
    queryKey: ['voter-status', electionId],
    queryFn: () => getVoterStatus(electionId),
    enabled: !!electionId && electionData?.data?.status === 'VOTING_OPEN',
  });

  const election = electionData?.data;
  const candidates = candidatesData?.data?.candidates || [];
  const voterStatus = voterStatusData?.data;

  // Status action mutations
  const startNominationsMutation = useMutation({
    mutationFn: () => startNominations(electionId),
    onSuccess: () => {
      toast.success('Nominations opened!');
      queryClient.invalidateQueries({ queryKey: ['election', electionId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const closeNominationsMutation = useMutation({
    mutationFn: () => closeNominations(electionId),
    onSuccess: () => {
      toast.success('Nominations closed!');
      queryClient.invalidateQueries({ queryKey: ['election', electionId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const startVotingMutation = useMutation({
    mutationFn: () => startVoting(electionId),
    onSuccess: () => {
      toast.success('Voting started!');
      queryClient.invalidateQueries({ queryKey: ['election', electionId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const closeVotingMutation = useMutation({
    mutationFn: () => closeVoting(electionId),
    onSuccess: () => {
      toast.success('Voting closed!');
      queryClient.invalidateQueries({ queryKey: ['election', electionId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const publishResultsMutation = useMutation({
    mutationFn: () => publishResults(electionId),
    onSuccess: () => {
      toast.success('Results published!');
      queryClient.invalidateQueries({ queryKey: ['election', electionId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelElection(electionId),
    onSuccess: () => {
      toast.success('Election cancelled');
      queryClient.invalidateQueries({ queryKey: ['election', electionId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const castVoteMutation = useMutation({
    mutationFn: ({ positionId, candidateId, isAbstain }: { positionId: number; candidateId?: number; isAbstain?: boolean }) =>
      castVote(electionId, { positionId, candidateId, isAbstain }),
    onSuccess: () => {
      toast.success('Vote cast successfully!');
      queryClient.invalidateQueries({ queryKey: ['voter-status', electionId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleVote = (positionId: number) => {
    const vote = selectedVotes[positionId];
    if (!vote) {
      toast.error('Please select a candidate or abstain');
      return;
    }
    castVoteMutation.mutate({
      positionId,
      candidateId: vote === 'abstain' ? undefined : vote,
      isAbstain: vote === 'abstain',
    });
  };

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
        <Link href="/dashboard/governance/elections" className="text-teal-600 hover:underline">
          Back to elections
        </Link>
      </div>
    );
  }

  // Group candidates by position
  const candidatesByPosition: Record<number, Candidate[]> = {};
  candidates.forEach((candidate: Candidate) => {
    if (!candidatesByPosition[candidate.positionId]) {
      candidatesByPosition[candidate.positionId] = [];
    }
    candidatesByPosition[candidate.positionId].push(candidate);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/governance/elections"
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <IconArrowLeft size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{election.title}</h1>
              <StatusBadge status={election.status} />
            </div>
            {election.description && (
              <p className="text-gray-600 dark:text-gray-400">{election.description}</p>
            )}
          </div>
        </div>
        
        {/* Action Buttons based on status */}
        <div className="flex gap-2">
          {election.status === 'DRAFT' && (
            <>
              <Link
                href={`/dashboard/governance/elections/${electionId}/edit`}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <IconEdit size={18} />
                Edit
              </Link>
              <button
                onClick={() => startNominationsMutation.mutate()}
                disabled={startNominationsMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <IconPlayerPlay size={18} />
                Open Nominations
              </button>
            </>
          )}
          {election.status === 'NOMINATIONS_OPEN' && (
            <button
              onClick={() => closeNominationsMutation.mutate()}
              disabled={closeNominationsMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
            >
              <IconPlayerStop size={18} />
              Close Nominations
            </button>
          )}
          {election.status === 'NOMINATIONS_CLOSED' && (
            <button
              onClick={() => startVotingMutation.mutate()}
              disabled={startVotingMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <IconChecklist size={18} />
              Start Voting
            </button>
          )}
          {election.status === 'VOTING_OPEN' && (
            <button
              onClick={() => closeVotingMutation.mutate()}
              disabled={closeVotingMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              <IconPlayerStop size={18} />
              Close Voting
            </button>
          )}
          {election.status === 'VOTING_CLOSED' && (
            <button
              onClick={() => publishResultsMutation.mutate()}
              disabled={publishResultsMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              <IconChartBar size={18} />
              Publish Results
            </button>
          )}
          {(election.status === 'VOTING_CLOSED' || election.status === 'RESULTS_PUBLISHED') && (
            <Link
              href={`/dashboard/governance/elections/${electionId}/results`}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              <IconChartBar size={18} />
              View Results
            </Link>
          )}
          {!['CANCELLED', 'RESULTS_PUBLISHED'].includes(election.status) && (
            <button
              onClick={() => {
                modals.openConfirmModal({
                  title: 'Cancel Election',
                  children: <Text size="sm">Are you sure you want to cancel this election?</Text>,
                  labels: { confirm: 'Cancel Election', cancel: 'Go Back' },
                  confirmProps: { color: 'red' },
                  onConfirm: () => {
                    cancelMutation.mutate();
                  },
                });
              }}
              disabled={cancelMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
            >
              <IconX size={18} />
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Election Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400 mb-2">
            <IconCalendarEvent size={20} />
            <span className="text-sm font-medium">Nomination Period</span>
          </div>
          <p className="text-gray-900 dark:text-white">
            {election.nominationStartDate ? formatDateTime(election.nominationStartDate) : 'Not set'}
            {election.nominationEndDate && ` - ${formatDateTime(election.nominationEndDate)}`}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400 mb-2">
            <IconChecklist size={20} />
            <span className="text-sm font-medium">Voting Period</span>
          </div>
          <p className="text-gray-900 dark:text-white">
            {election.votingStartDate ? formatDateTime(election.votingStartDate) : 'Not set'}
            {election.votingEndDate && ` - ${formatDateTime(election.votingEndDate)}`}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400 mb-2">
            <IconUsers size={20} />
            <span className="text-sm font-medium">Settings</span>
          </div>
          <div className="flex gap-2">
            {election.isAnonymous && (
              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Anonymous</span>
            )}
            {election.allowAbstain && (
              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Allow Abstain</span>
            )}
          </div>
        </div>
      </div>

      {/* Positions and Candidates */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Positions & Candidates</h2>
          {(election.status === 'DRAFT' || election.status === 'NOMINATIONS_OPEN') && (
            <Link
              href={`/dashboard/governance/elections/${electionId}/candidates/add`}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              <IconUserPlus size={16} />
              Add Candidate
            </Link>
          )}
        </div>

        {election.positions && election.positions.length > 0 ? (
          <div className="space-y-6">
            {election.positions.map((position) => {
              const positionCandidates = candidatesByPosition[position.id] || [];
              const hasVoted = voterStatus?.votedPositions?.includes(position.id);
              
              return (
                <div key={position.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{position.title}</h3>
                      {position.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">{position.description}</p>
                      )}
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {positionCandidates.filter(c => c.status === 'APPROVED').length} candidates
                    </span>
                  </div>

                  {positionCandidates.length > 0 ? (
                    <div className="space-y-2">
                      {positionCandidates.map((candidate) => (
                        <div
                          key={candidate.id}
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            election.status === 'VOTING_OPEN' && !hasVoted && candidate.status === 'APPROVED'
                              ? 'cursor-pointer hover:border-teal-500'
                              : ''
                          } ${
                            selectedVotes[position.id] === candidate.id
                              ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                              : 'border-gray-200 dark:border-gray-700'
                          }`}
                          onClick={() => {
                            if (election.status === 'VOTING_OPEN' && !hasVoted && candidate.status === 'APPROVED') {
                              setSelectedVotes({ ...selectedVotes, [position.id]: candidate.id });
                            }
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                              <span className="text-sm font-medium">
                                {candidate.member.firstName[0]}{candidate.member.lastName[0]}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {candidate.member.firstName} {candidate.member.lastName}
                              </p>
                              {candidate.manifesto && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">
                                  {candidate.manifesto}
                                </p>
                              )}
                            </div>
                          </div>
                          <CandidateStatusBadge status={candidate.status} />
                        </div>
                      ))}
                      
                      {/* Abstain option */}
                      {election.status === 'VOTING_OPEN' && election.allowAbstain && !hasVoted && (
                        <div
                          className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:border-gray-400 ${
                            selectedVotes[position.id] === 'abstain'
                              ? 'border-gray-500 bg-gray-50 dark:bg-gray-700'
                              : 'border-gray-200 dark:border-gray-700'
                          }`}
                          onClick={() => setSelectedVotes({ ...selectedVotes, [position.id]: 'abstain' })}
                        >
                          <span className="text-gray-600 dark:text-gray-400">Abstain</span>
                        </div>
                      )}

                      {/* Vote button */}
                      {election.status === 'VOTING_OPEN' && !hasVoted && selectedVotes[position.id] && (
                        <button
                          onClick={() => handleVote(position.id)}
                          disabled={castVoteMutation.isPending}
                          className="w-full mt-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                        >
                          {castVoteMutation.isPending ? 'Submitting...' : 'Submit Vote'}
                        </button>
                      )}

                      {hasVoted && (
                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mt-2">
                          <IconCheck size={18} />
                          <span className="text-sm">You have voted for this position</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                      No candidates yet
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <IconUsers size={48} className="mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600 dark:text-gray-400 mb-4">No positions added yet</p>
            {election.status === 'DRAFT' && (
              <Link
                href={`/dashboard/governance/elections/${electionId}/positions/add`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
              >
                <IconPlus size={18} />
                Add Positions
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
