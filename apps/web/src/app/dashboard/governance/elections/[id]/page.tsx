'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePrompt } from '@/hooks/usePrompt';
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
  IconChartBar,
  IconUserMinus
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
  registerCandidate,
  selfNominate,
  approveCandidate,
  withdrawCandidate,
  addPosition,
  searchCandidateMembers,
  Election,
  Candidate,
  ElectionStatus
} from '@/lib/api/voting';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';
import { toast } from '@/lib/toast';
import { modals } from '@mantine/modals';
import { Text, Modal, Select, Textarea, Button } from '@mantine/core';
import { HelpLink } from '@/components/docs/HelpLink';

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
  const { prompt, element: promptElement } = usePrompt();
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.ELECTION_MANAGE); // create, edit, positions, cancel
  const canCandidates = can(PERMISSIONS.ELECTION_CANDIDATES); // register, approve, reject
  const canRun = can(PERMISSIONS.ELECTION_RUN); // open and close nominations and voting
  const canPublish = can(PERMISSIONS.ELECTION_RESULTS_PUBLISH);
  const canSeeEarlyResults = can(PERMISSIONS.ELECTION_RESULTS_VIEW);
  const electionId = parseInt(params.id as string);
  const [selectedVotes, setSelectedVotes] = useState<Record<number, number | 'abstain'>>({});
  const [addCandidateFor, setAddCandidateFor] = useState<number | null>(null); // positionId
  const [addCandidateMemberId, setAddCandidateMemberId] = useState<string | null>(null);
  const [manifesto, setManifesto] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [rejectingCandidateId, setRejectingCandidateId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const { data: electionData, isLoading } = useQuery({
    queryKey: ['election', electionId],
    queryFn: () => getElection(electionId),
  });

  const { data: candidatesData } = useQuery({
    queryKey: ['election-candidates', electionId],
    queryFn: () => getCandidates(electionId),
    enabled: !!electionId,
  });

  // Fetched for any status (not just VOTING_OPEN) so we know the viewer's own
  // memberId — needed to show "Withdraw" only on the viewer's own candidacy
  // (withdrawCandidate() is self-service only, scoped by the caller's memberId).
  const { data: voterStatusData } = useQuery({
    queryKey: ['voter-status', electionId],
    queryFn: () => getVoterStatus(electionId),
    enabled: !!electionId,
  });

  // The committee can't list members, so they search through the voting module.
  const { data: membersData } = useQuery({
    queryKey: ['members-for-candidate', memberSearch],
    queryFn: () => searchCandidateMembers(memberSearch),
    enabled: addCandidateFor !== null && canCandidates,
  });

  const election = electionData?.data;
  const candidates = candidatesData?.data || [];
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
    mutationFn: (reason: string) => cancelElection(electionId, reason),
    onSuccess: () => {
      toast.success('Election cancelled');
      queryClient.invalidateQueries({ queryKey: ['election', electionId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const castVoteMutation = useMutation({
    mutationFn: ({ positionId, candidateId, isAbstention }: { positionId: number; candidateId?: number; isAbstention?: boolean }) =>
      castVote(electionId, { positionId, candidateId, isAbstention }),
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
      isAbstention: vote === 'abstain',
    });
  };

  // R2.2/G29: candidate management — officer add, member self-nominate,
  // approve/reject, withdraw. All backed by endpoints that already existed
  // but were never called from any component.
  const closeCandidateModal = () => {
    setAddCandidateFor(null);
    setAddCandidateMemberId(null);
    setManifesto('');
    setMemberSearch('');
  };

  const registerCandidateMutation = useMutation({
    mutationFn: ({ positionId, memberId }: { positionId: number; memberId: number }) =>
      registerCandidate(electionId, { positionId, memberId, manifesto: manifesto || undefined }),
    onSuccess: () => {
      toast.success('Candidate added');
      queryClient.invalidateQueries({ queryKey: ['election-candidates', electionId] });
      closeCandidateModal();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const selfNominateMutation = useMutation({
    mutationFn: (positionId: number) => selfNominate(electionId, { positionId, manifesto: manifesto || undefined }),
    onSuccess: () => {
      toast.success('You have been nominated — awaiting officer approval');
      queryClient.invalidateQueries({ queryKey: ['election-candidates', electionId] });
      closeCandidateModal();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const approveCandidateMutation = useMutation({
    mutationFn: ({ candidateId, status, rejectionReason: reason }: { candidateId: number; status: 'APPROVED' | 'REJECTED'; rejectionReason?: string }) =>
      approveCandidate(candidateId, { status, rejectionReason: reason }),
    onSuccess: (_, variables) => {
      toast.success(variables.status === 'APPROVED' ? 'Candidate approved' : 'Candidate rejected');
      queryClient.invalidateQueries({ queryKey: ['election-candidates', electionId] });
      setRejectingCandidateId(null);
      setRejectionReason('');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const withdrawCandidateMutation = useMutation({
    mutationFn: (candidateId: number) => withdrawCandidate(candidateId),
    onSuccess: () => {
      toast.success('Candidacy withdrawn');
      queryClient.invalidateQueries({ queryKey: ['election-candidates', electionId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addPositionMutation = useMutation({
    mutationFn: (data: { title: string; maxCandidates: number }) => addPosition(electionId, data),
    onSuccess: () => {
      toast.success('Position added');
      queryClient.invalidateQueries({ queryKey: ['election', electionId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleCancel = async () => {
    const reason = await prompt({
      title: 'Cancel this election?',
      label: 'Why is it being cancelled?',
      placeholder: 'Members will be able to see this',
      confirmLabel: 'Cancel election',
    });
    if (!reason) return;
    cancelMutation.mutate(reason);
  };

  const handleAddPosition = async () => {
    const title = await prompt({ title: 'Add a position', label: 'Position title', placeholder: 'e.g. President', confirmLabel: 'Add position' });
    if (!title) return;
    addPositionMutation.mutate({ title, maxCandidates: 1 });
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
  const approvedCandidateCount = candidates.filter((c: Candidate) => c.status === 'APPROVED').length;
  const pendingCandidateCount = candidates.filter((c: Candidate) => c.status === 'PENDING').length;
  // Nominations can be decided until voting opens, even after they have closed.
  const candidatesCanChange = ['DRAFT', 'NOMINATIONS_OPEN', 'NOMINATIONS_CLOSED'].includes(election.status);

  return (
    <div className="space-y-6">
      {promptElement}
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
        
        {/* Action buttons: each is shown only to the people whose role lets them take it */}
        <div className="flex flex-wrap justify-end gap-2">
          <HelpLink />
          {election.status === 'DRAFT' && canManage && (
            <Link
              href={`/dashboard/governance/elections/${electionId}/edit`}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <IconEdit size={18} />
              Edit
            </Link>
          )}
          {election.status === 'DRAFT' && canRun && (
            <>
              <button
                onClick={() => startNominationsMutation.mutate()}
                disabled={startNominationsMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <IconPlayerPlay size={18} />
                Open Nominations
              </button>
              {/* An election can go straight to voting from draft when the committee has registered and approved the candidates itself. */}
              {approvedCandidateCount > 0 && (
                <button
                  onClick={() => startVotingMutation.mutate()}
                  disabled={startVotingMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <IconChecklist size={18} />
                  Start Voting
                </button>
              )}
            </>
          )}
          {election.status === 'NOMINATIONS_OPEN' && canRun && (
            <button
              onClick={() => closeNominationsMutation.mutate()}
              disabled={closeNominationsMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
            >
              <IconPlayerStop size={18} />
              Close Nominations
            </button>
          )}
          {election.status === 'NOMINATIONS_CLOSED' && canRun && (
            <button
              onClick={() => startVotingMutation.mutate()}
              disabled={startVotingMutation.isPending || pendingCandidateCount > 0}
              title={pendingCandidateCount > 0 ? 'Approve or reject the waiting nominations first' : undefined}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <IconChecklist size={18} />
              Start Voting
            </button>
          )}
          {election.status === 'VOTING_OPEN' && canRun && (
            <button
              onClick={() => closeVotingMutation.mutate()}
              disabled={closeVotingMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              <IconPlayerStop size={18} />
              Close Voting
            </button>
          )}
          {election.status === 'VOTING_CLOSED' && canPublish && (
            <button
              onClick={() => publishResultsMutation.mutate()}
              disabled={publishResultsMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              <IconChartBar size={18} />
              Publish Results
            </button>
          )}
          {(election.status === 'RESULTS_PUBLISHED' || (election.status === 'VOTING_CLOSED' && canSeeEarlyResults)) && (
            <Link
              href={`/dashboard/governance/elections/${electionId}/results`}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              <IconChartBar size={18} />
              View Results
            </Link>
          )}
          {canManage && !['CANCELLED', 'RESULTS_PUBLISHED'].includes(election.status) && (
            <button
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
            >
              <IconX size={18} />
              Cancel
            </button>
          )}
        </div>
      </div>

      {canCandidates && pendingCandidateCount > 0 && ['DRAFT', 'NOMINATIONS_OPEN', 'NOMINATIONS_CLOSED'].includes(election.status) && (
        <div className="rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
          {pendingCandidateCount} {pendingCandidateCount === 1 ? 'nomination is' : 'nominations are'} waiting for a decision. Voting cannot open until each one is approved or rejected.
        </div>
      )}
      {election.status === 'CANCELLED' && election.cancellationReason && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300">
          Cancelled: {election.cancellationReason}
        </div>
      )}

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
            {election.allowAbstention && (
              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Allow Abstain</span>
            )}
          </div>
        </div>
        {/* R2.6/G32: turnout — eligibleVoterCount/totalVotesCast/quorumPercentage
            were always returned by GET /elections/:id, just never rendered. */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400 mb-2">
            <IconUsers size={20} />
            <span className="text-sm font-medium">Turnout</span>
          </div>
          <p className="text-gray-900 dark:text-white">
            {election.totalVotesCast} of {election.eligibleVoterCount} eligible members voted
            {election.eligibleVoterCount > 0 && (
              <span className="text-gray-500 dark:text-gray-400">
                {' '}({Math.round((election.totalVotesCast / election.eligibleVoterCount) * 100)}%)
              </span>
            )}
          </p>
          {election.requiresQuorum && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Quorum required: {election.quorumPercentage}%
            </p>
          )}
        </div>
      </div>

      {/* Positions and Candidates */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Positions & Candidates</h2>
          {election.status === 'DRAFT' && canManage && (
            <button
              onClick={handleAddPosition}
              disabled={addPositionMutation.isPending}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              <IconPlus size={16} />
              Add Position
            </button>
          )}
        </div>

        {election.positions && election.positions.length > 0 ? (
          <div className="space-y-6">
            {election.positions.map((position) => {
              const positionCandidates = candidatesByPosition[position.id] || [];
              const hasVoted = voterStatus?.votedPositions?.includes(position.id);
              
              const myCandidacy = positionCandidates.find(
                (c) => c.memberId === voterStatus?.memberId && c.status !== 'WITHDRAWN' && c.status !== 'REJECTED'
              );

              return (
                <div key={position.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{position.title}</h3>
                      {position.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">{position.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {positionCandidates.filter(c => c.status === 'APPROVED').length} candidates
                      </span>
                      {(election.status === 'DRAFT' || election.status === 'NOMINATIONS_OPEN') && (
                        <>
                          {canCandidates && (
                            <button
                              onClick={() => setAddCandidateFor(position.id)}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-700"
                            >
                              <IconUserPlus size={14} />
                              Add Candidate
                            </button>
                          )}
                          {election.status === 'NOMINATIONS_OPEN' && !myCandidacy && (
                            <button
                              onClick={() => selfNominateMutation.mutate(position.id)}
                              disabled={selfNominateMutation.isPending}
                              className="flex items-center gap-1 px-2 py-1 text-xs border border-teal-600 text-teal-600 rounded hover:bg-teal-50 dark:hover:bg-teal-900/20 disabled:opacity-50"
                            >
                              <IconUserPlus size={14} />
                              Nominate Yourself
                            </button>
                          )}
                        </>
                      )}
                    </div>
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
                          <div className="flex items-center gap-2">
                            <CandidateStatusBadge status={candidate.status} />
                            {candidate.status === 'PENDING' && candidatesCanChange && canCandidates && candidate.memberId === voterStatus?.memberId && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">Another committee member decides this</span>
                            )}
                            {candidate.status === 'PENDING' && candidatesCanChange && canCandidates && candidate.memberId !== voterStatus?.memberId && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    approveCandidateMutation.mutate({ candidateId: candidate.id, status: 'APPROVED' });
                                  }}
                                  disabled={approveCandidateMutation.isPending}
                                  title="Approve"
                                  className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded disabled:opacity-50"
                                >
                                  <IconCheck size={16} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRejectingCandidateId(candidate.id);
                                  }}
                                  title="Reject"
                                  className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                >
                                  <IconX size={16} />
                                </button>
                              </>
                            )}
                            {candidate.memberId === voterStatus?.memberId &&
                              candidate.status !== 'WITHDRAWN' &&
                              candidate.status !== 'REJECTED' &&
                              candidatesCanChange && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    withdrawCandidateMutation.mutate(candidate.id);
                                  }}
                                  disabled={withdrawCandidateMutation.isPending}
                                  title="Withdraw my candidacy"
                                  className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-50"
                                >
                                  <IconUserMinus size={16} />
                                </button>
                              )}
                          </div>
                        </div>
                      ))}
                      
                      {/* Abstain option */}
                      {election.status === 'VOTING_OPEN' && election.allowAbstention && !hasVoted && (
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
            {election.status === 'DRAFT' && canManage && (
              <button
                onClick={handleAddPosition}
                disabled={addPositionMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                <IconPlus size={18} />
                Add Position
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add Candidate modal (officer action) */}
      <Modal
        opened={addCandidateFor !== null}
        onClose={closeCandidateModal}
        title="Add Candidate"
      >
        <div className="space-y-4">
          <Select
            label="Member"
            placeholder="Search for a member..."
            searchable
            searchValue={memberSearch}
            onSearchChange={setMemberSearch}
            data={(membersData?.data || []).map((m) => ({
              value: String(m.id),
              label: `${m.firstName} ${m.lastName} (${m.memberId})`,
            }))}
            value={addCandidateMemberId}
            onChange={setAddCandidateMemberId}
          />
          <Textarea
            label="Manifesto (optional)"
            value={manifesto}
            onChange={(e) => setManifesto(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button variant="default" onClick={closeCandidateModal}>Cancel</Button>
            <Button
              disabled={!addCandidateMemberId || registerCandidateMutation.isPending}
              onClick={() => {
                if (!addCandidateFor || !addCandidateMemberId) return;
                registerCandidateMutation.mutate({
                  positionId: addCandidateFor,
                  memberId: parseInt(addCandidateMemberId),
                });
              }}
            >
              Add Candidate
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reject candidate modal */}
      <Modal
        opened={rejectingCandidateId !== null}
        onClose={() => { setRejectingCandidateId(null); setRejectionReason(''); }}
        title="Reject Candidate"
      >
        <div className="space-y-4">
          <Textarea
            label="Rejection reason"
            required
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button variant="default" onClick={() => { setRejectingCandidateId(null); setRejectionReason(''); }}>
              Cancel
            </Button>
            <Button
              color="red"
              disabled={!rejectionReason.trim() || approveCandidateMutation.isPending}
              onClick={() => {
                if (!rejectingCandidateId) return;
                approveCandidateMutation.mutate({
                  candidateId: rejectingCandidateId,
                  status: 'REJECTED',
                  rejectionReason: rejectionReason.trim(),
                });
              }}
            >
              Reject Candidate
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
