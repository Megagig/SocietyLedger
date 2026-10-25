'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Text, Progress } from '@mantine/core';
import { modals } from '@mantine/modals';
import { PERMISSIONS } from '@/lib/permissions';
import { Can } from '@/hooks/usePermissions';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/utils/api';
import { toast } from '@/lib/toast';
import { 
  ArrowLeft, Target, Users, Calendar, DollarSign, 
  CheckCircle, Clock, AlertCircle, UserPlus, Trash2,
  TrendingUp, PieChart
} from 'lucide-react';

interface LevyCampaign {
  id: number;
  name: string;
  description: string | null;
  targetAmount: number;
  amountPerMember: number | null;
  deadline: string;
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'COMPLETED' | 'CANCELLED';
  category: { id: number; name: string };
  assignments: CampaignAssignment[];
  createdAt: string;
}

interface CampaignAssignment {
  id: number;
  memberId: number;
  amount: number;
  status: string;
  assignedAt: string;
  member: {
    id: number;
    memberId: string;
    firstName: string;
    lastName: string;
  };
  transaction?: {
    id: number;
    status: string;
    payments: { amountPaid: number }[];
  };
}

interface CampaignProgress {
  campaign: LevyCampaign;
  totalAssigned: number;
  totalCollected: number;
  /** What the assigned members still owe — stays owed after the campaign is closed. */
  stillOwed: number;
  totalMembers: number;
  paidMembers: number;
  progressPercentage: number;
}

interface Member {
  id: number;
  memberId: string;
  firstName: string;
  lastName: string;
  status: string;
}

export default function LevyCampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;
  
  const [progress, setProgress] = useState<CampaignProgress | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Assign modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [customAmount, setCustomAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchCampaignProgress();
    fetchMembers();
  }, [campaignId]);

  const fetchCampaignProgress = async () => {
    setIsLoading(true);
    try {
      const response = await apiGet(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/advanced/levies/campaigns/${campaignId}/progress`
      );
      if (!response.ok) throw new Error('Failed to fetch campaign progress');
      const data = await response.json();
      setProgress(data.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const all: Member[] = [];
      for (let page = 1; page <= 50; page++) {
        const response = await apiGet(
          `${process.env.NEXT_PUBLIC_API_URL}/api/members?status=active&limit=100&page=${page}`
        );
        if (!response.ok) throw new Error('Failed to fetch members');
        const data = await response.json();
        all.push(...data.data.members);
        if (!data.data.pagination?.hasMore) break;
      }
      setMembers(all);
    } catch (err: any) {
      console.error('Error fetching members:', err);
    }
  };


  const handleAssignMembers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMembers.length === 0) {
      toast.error('Please select at least one member');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiPost(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/advanced/levies/campaigns/${campaignId}/assign`,
        {
          memberIds: selectedMembers,
          amount: customAmount ? parseFloat(customAmount) : undefined,
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to assign members');

      toast.success(`Successfully assigned ${selectedMembers.length} member(s)`);
      setShowAssignModal(false);
      setSelectedMembers([]);
      setCustomAmount('');
      fetchCampaignProgress();
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign members');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseCampaign = () => {
    modals.openConfirmModal({
      title: 'Close this campaign?',
      children: (
        <Text size="sm">
          No more members can be added. Everything already charged stays owed: members keep being reminded and their
          balances don&apos;t change until they pay, or you waive or void their charge.
        </Text>
      ),
      labels: { confirm: 'Close campaign', cancel: 'Keep open' },
      onConfirm: async () => {
        try {
          const response = await apiPatch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/finance/advanced/levies/campaigns/${campaignId}`,
            { status: 'CLOSED' }
          );
          const data = await response.json();
          if (!response.ok) throw new Error(data.message);
          toast.success('Campaign closed');
          fetchCampaignProgress();
        } catch (err: any) {
          toast.error(err.message || 'Failed to close campaign');
        }
      },
    });
  };

  const handleRemoveAssignment = async (assignmentId: number, memberName: string) => {
    modals.openConfirmModal({
      title: 'Remove Assignment',
      children: (
        <Text size="sm">
          Remove {memberName} from this campaign? Use this to correct a mistake: their charge is voided and taken off their
          ledger. It isn&apos;t possible once they have paid something. To drop a debt, waive or void their charge instead.
        </Text>
      ),
      labels: { confirm: 'Remove', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          const response = await apiDelete(
            `${process.env.NEXT_PUBLIC_API_URL}/api/finance/advanced/levies/campaigns/${campaignId}/assignments/${assignmentId}`
          );

          const data = await response.json();
          if (!response.ok) throw new Error(data.message);

          toast.success('Assignment removed');
          fetchCampaignProgress();
        } catch (err: any) {
          toast.error(err.message || 'Failed to remove assignment');
        }
      },
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'partial': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'pending': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      case 'waived': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCampaignStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'CLOSED': return 'bg-orange-100 text-orange-800';
      case 'COMPLETED': return 'bg-blue-100 text-blue-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      case 'DRAFT': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Get members not yet assigned
  const assignedMemberIds = progress?.campaign?.assignments?.map(a => a.memberId) || [];
  const availableMembers = members.filter(m => !assignedMemberIds.includes(m.id));

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error || !progress || !progress.campaign) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 p-4 rounded-lg">
          {error || 'Campaign not found'}
        </div>
        <button
          onClick={() => router.push('/dashboard/finance/levies')}
          className="mt-4 flex items-center gap-2 text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Levies
        </button>
      </div>
    );
  }

  const { campaign, totalAssigned, totalCollected, stillOwed, totalMembers, paidMembers, progressPercentage } = progress;
  const assignments = campaign.assignments || [];
  const daysRemaining = Math.ceil((new Date(campaign.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/dashboard/finance/levies')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {campaign.name}
            </h1>
            <span className={`text-xs px-2 py-1 rounded-full ${getCampaignStatusColor(campaign.status)}`}>
              {campaign.status}
            </span>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {campaign.description || campaign.category.name}
          </p>
        </div>
        
        <Can permission={PERMISSIONS.FINANCE_EDIT}>
          {campaign.status === 'ACTIVE' && (
            <button
              onClick={handleCloseCampaign}
              className="flex items-center gap-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 px-4 py-2 rounded-lg"
            >
              Close campaign
            </button>
          )}
        </Can>
        <Can permission={PERMISSIONS.TRANSACTION_CREATE}>
          {campaign.status === 'ACTIVE' && (
            <button
              onClick={() => setShowAssignModal(true)}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg"
            >
              <UserPlus className="w-4 h-4" />
              Assign Members
            </button>
          )}
        </Can>
      </div>

      {campaign.status === 'CLOSED' && (
        <div className="bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200 p-4 rounded-lg text-sm">
          Closed to new members. {totalMembers - paidMembers} member(s) still owe ₦{Number(stillOwed).toLocaleString()} —
          these charges stay owed and keep being reminded until they are paid, waived or voided.
        </div>
      )}


      {/* Progress Overview */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <PieChart className="w-5 h-5 text-purple-600" />
            Campaign Progress
          </h2>
          <span className="text-2xl font-bold text-purple-600">
            {progressPercentage.toFixed(1)}%
          </span>
        </div>
        
        <Progress value={progressPercentage} color="grape" size="xl" radius="md" className="mb-4" />
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <Target className="w-6 h-6 mx-auto text-purple-600 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Target</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              ₦{Number(campaign.targetAmount).toLocaleString()}
            </p>
          </div>
          
          <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <DollarSign className="w-6 h-6 mx-auto text-blue-600 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Assigned</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              ₦{Number(totalAssigned).toLocaleString()}
            </p>
          </div>
          
          <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <TrendingUp className="w-6 h-6 mx-auto text-green-600 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Collected</p>
            <p className="text-xl font-bold text-green-600">
              ₦{Number(totalCollected).toLocaleString()}
            </p>
          </div>
          
          <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <Users className="w-6 h-6 mx-auto text-orange-600 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Members</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {paidMembers}/{totalMembers}
            </p>
          </div>
        </div>
      </div>

      {/* Campaign Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Deadline</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {new Date(campaign.deadline).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Days Remaining</p>
              <p className={`font-semibold ${daysRemaining < 0 ? 'text-red-600' : daysRemaining < 7 ? 'text-orange-600' : 'text-gray-900 dark:text-white'}`}>
                {daysRemaining < 0 ? `${Math.abs(daysRemaining)} days overdue` : `${daysRemaining} days`}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Amount Per Member</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {campaign.amountPerMember ? `₦${Number(campaign.amountPerMember).toLocaleString()}` : 'Variable'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Assignments Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" />
            Member Assignments ({assignments.length})
          </h2>
        </div>
        
        {assignments.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">No members assigned yet</p>
            <Can permission={PERMISSIONS.TRANSACTION_CREATE}>
              <button
                onClick={() => setShowAssignModal(true)}
                className="mt-4 inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg"
              >
                <UserPlus className="w-4 h-4" />
                Assign Members
              </button>
            </Can>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Member</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Paid</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Assigned</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {assignments.map(assignment => {
                  const paidAmount = assignment.transaction?.payments.reduce((sum, p) => sum + Number(p.amountPaid), 0) || 0;
                  return (
                    <tr key={assignment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {assignment.member.firstName} {assignment.member.lastName}
                          </p>
                          <p className="text-sm text-gray-500">{assignment.member.memberId}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">
                        ₦{Number(assignment.amount).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-green-600 font-medium">
                        ₦{paidAmount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(assignment.status)}`}>
                          {assignment.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(assignment.assignedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Can permission={PERMISSIONS.TRANSACTION_DELETE}>
                          {assignment.status === 'pending' && (
                            <button
                              onClick={() => handleRemoveAssignment(
                                assignment.id,
                                `${assignment.member.firstName} ${assignment.member.lastName}`
                              )}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </Can>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>


      {/* Assign Members Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Assign Members to Campaign
              </h2>
            </div>

            <form onSubmit={handleAssignMembers} className="flex-1 overflow-hidden flex flex-col">
              <div className="p-4 space-y-4 flex-1 overflow-y-auto">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Custom Amount (₦) - Optional
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder={campaign.amountPerMember ? `Default: ${campaign.amountPerMember}` : 'Enter amount'}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Leave empty to use campaign default amount
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select Members ({selectedMembers.length} selected)
                  </label>
                  
                  {availableMembers.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">
                      All active members are already assigned
                    </p>
                  ) : (
                    <div className="border border-gray-200 dark:border-gray-600 rounded-lg max-h-60 overflow-y-auto">
                      {availableMembers.map(member => (
                        <label
                          key={member.id}
                          className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-0"
                        >
                          <input
                            type="checkbox"
                            checked={selectedMembers.includes(member.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedMembers([...selectedMembers, member.id]);
                              } else {
                                setSelectedMembers(selectedMembers.filter(id => id !== member.id));
                              }
                            }}
                            className="rounded border-gray-300"
                          />
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {member.firstName} {member.lastName}
                            </p>
                            <p className="text-sm text-gray-500">{member.memberId}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                  
                  {availableMembers.length > 0 && (
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => setSelectedMembers(availableMembers.map(m => m.id))}
                        className="text-sm text-purple-600 hover:text-purple-800"
                      >
                        Select All
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedMembers([])}
                        className="text-sm text-gray-600 hover:text-gray-800"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedMembers([]);
                    setCustomAmount('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || selectedMembers.length === 0}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50"
                >
                  {isSubmitting ? 'Assigning...' : `Assign ${selectedMembers.length} Member(s)`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
