'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { IconArrowLeft, IconPlus, IconTrash } from '@tabler/icons-react';
import { createElection, addPosition, ElectionType } from '@/lib/api/voting';
import { toast } from '@/lib/toast';

interface PositionInput {
  title: string;
  description: string;
  maxCandidates: number;
}

export default function NewElectionPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [electionId, setElectionId] = useState<number | null>(null);
  
  // Election form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [electionType, setElectionType] = useState<ElectionType>('GENERAL');
  const [nominationStartDate, setNominationStartDate] = useState('');
  const [nominationEndDate, setNominationEndDate] = useState('');
  const [votingStartDate, setVotingStartDate] = useState('');
  const [votingEndDate, setVotingEndDate] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [allowAbstention, setAllowAbstention] = useState(true);

  // Positions state
  const [positions, setPositions] = useState<PositionInput[]>([
    { title: '', description: '', maxCandidates: 1 }
  ]);

  const createElectionMutation = useMutation({
    mutationFn: createElection,
    onSuccess: (data) => {
      setElectionId(data.data.id);
      setStep(2);
      toast.success('Election created! Now add positions.');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const addPositionMutation = useMutation({
    mutationFn: ({ electionId, position }: { electionId: number; position: PositionInput & { orderNumber: number } }) =>
      addPosition(electionId, position),
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleCreateElection = (e: React.FormEvent) => {
    e.preventDefault();
    createElectionMutation.mutate({
      title,
      description: description || undefined,
      electionType,
      nominationStartDate: nominationStartDate ? new Date(nominationStartDate).toISOString() : undefined,
      nominationEndDate: nominationEndDate ? new Date(nominationEndDate).toISOString() : undefined,
      votingStartDate: new Date(votingStartDate).toISOString(),
      votingEndDate: new Date(votingEndDate).toISOString(),
      isAnonymous,
      allowAbstention,
    });
  };

  const handleAddPositions = async () => {
    if (!electionId) return;
    
    const validPositions = positions.filter(p => p.title.trim());
    if (validPositions.length === 0) {
      toast.error('Please add at least one position');
      return;
    }

    try {
      for (let i = 0; i < validPositions.length; i++) {
        await addPositionMutation.mutateAsync({
          electionId,
          position: { ...validPositions[i], orderNumber: i + 1 },
        });
      }
      toast.success('Positions added successfully!');
      queryClient.invalidateQueries({ queryKey: ['elections'] });
      router.push(`/dashboard/governance/elections/${electionId}`);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const addPositionRow = () => {
    setPositions([...positions, { title: '', description: '', maxCandidates: 1 }]);
  };

  const removePositionRow = (index: number) => {
    if (positions.length > 1) {
      setPositions(positions.filter((_, i) => i !== index));
    }
  };

  const updatePosition = (index: number, field: keyof PositionInput, value: string | number) => {
    const updated = [...positions];
    updated[index] = { ...updated[index], [field]: value };
    setPositions(updated);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/governance/elections"
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <IconArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create New Election</h1>
          <p className="text-gray-600 dark:text-gray-400">
            {step === 1 ? 'Step 1: Election Details' : 'Step 2: Add Positions'}
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        <div className={`flex-1 h-2 rounded-full ${step >= 1 ? 'bg-teal-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
        <div className={`flex-1 h-2 rounded-full ${step >= 2 ? 'bg-teal-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
      </div>

      {step === 1 ? (
        /* Step 1: Election Details */
        <form onSubmit={handleCreateElection} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Election Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g., 2025 Executive Committee Election"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe the purpose of this election..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Election Type *
            </label>
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nomination Start Date
              </label>
              <input
                type="datetime-local"
                value={nominationStartDate}
                onChange={(e) => setNominationStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nomination End Date
              </label>
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Voting Start Date *
              </label>
              <input
                type="datetime-local"
                value={votingStartDate}
                onChange={(e) => setVotingStartDate(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Voting End Date *
              </label>
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
              href="/dashboard/governance/elections"
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={createElectionMutation.isPending}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
            >
              {createElectionMutation.isPending ? 'Creating...' : 'Continue to Positions'}
            </button>
          </div>
        </form>
      ) : (
        /* Step 2: Add Positions */
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Election Positions</h2>
            <button
              type="button"
              onClick={addPositionRow}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              <IconPlus size={16} />
              Add Position
            </button>
          </div>

          <div className="space-y-4">
            {positions.map((position, index) => (
              <div key={index} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Position {index + 1}</span>
                  {positions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePositionRow(index)}
                      className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    >
                      <IconTrash size={16} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <input
                      type="text"
                      value={position.title}
                      onChange={(e) => updatePosition(index, 'title', e.target.value)}
                      placeholder="Position title (e.g., President)"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <input
                      type="text"
                      value={position.description}
                      onChange={(e) => updatePosition(index, 'description', e.target.value)}
                      placeholder="Description (optional)"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Max Winners</label>
                    <input
                      type="number"
                      min={1}
                      value={position.maxCandidates}
                      onChange={(e) => updatePosition(index, 'maxCandidates', parseInt(e.target.value) || 1)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => router.push(`/dashboard/governance/elections/${electionId}`)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Skip for Now
            </button>
            <button
              type="button"
              onClick={handleAddPositions}
              disabled={addPositionMutation.isPending}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
            >
              {addPositionMutation.isPending ? 'Saving...' : 'Save Positions'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
