'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { IconArrowLeft, IconPlus, IconTrash } from '@tabler/icons-react';
import { createPoll, PollType } from '@/lib/api/voting';
import { toast } from '@/lib/toast';

export default function NewPollPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  
  // Poll form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pollType, setPollType] = useState<PollType>('SINGLE_CHOICE');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [allowMultipleResponses, setAllowMultipleResponses] = useState(false);
  const [maxSelections, setMaxSelections] = useState<number | undefined>(undefined);
  const [options, setOptions] = useState<string[]>(['', '']);

  const createPollMutation = useMutation({
    mutationFn: createPoll,
    onSuccess: (data) => {
      toast.success('Poll created successfully!');
      queryClient.invalidateQueries({ queryKey: ['polls'] });
      router.push(`/dashboard/governance/polls/${data.data.id}`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const validOptions = options.filter(o => o.trim());
    if (validOptions.length < 2) {
      toast.error('Please add at least 2 options');
      return;
    }

    createPollMutation.mutate({
      title,
      description: description || undefined,
      pollType,
      startDate: startDate ? new Date(startDate).toISOString() : undefined,
      endDate: endDate ? new Date(endDate).toISOString() : undefined,
      isAnonymous,
      allowMultipleResponses,
      maxSelections: pollType === 'MULTIPLE_CHOICE' ? maxSelections : undefined,
      options: validOptions.map((text, index) => ({ optionText: text, orderNumber: index })),
    });
  };

  const addOption = () => {
    setOptions([...options, '']);
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, value: string) => {
    const updated = [...options];
    updated[index] = value;
    setOptions(updated);
  };

  // Auto-set options for Yes/No poll type
  const handlePollTypeChange = (type: PollType) => {
    setPollType(type);
    if (type === 'YES_NO') {
      setOptions(['Yes', 'No']);
    } else if (options.length === 2 && options[0] === 'Yes' && options[1] === 'No') {
      setOptions(['', '']);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/governance/polls"
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <IconArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create New Poll</h1>
          <p className="text-gray-600 dark:text-gray-400">Gather member opinions with a quick poll</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Poll Question *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="e.g., Should we increase monthly dues?"
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
            rows={2}
            placeholder="Add more context about this poll..."
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Poll Type *
          </label>
          <select
            value={pollType}
            onChange={(e) => handlePollTypeChange(e.target.value as PollType)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
          >
            <option value="SINGLE_CHOICE">Single Choice (select one)</option>
            <option value="MULTIPLE_CHOICE">Multiple Choice (select multiple)</option>
            <option value="YES_NO">Yes/No</option>
            <option value="RANKED_CHOICE">Ranked Choice</option>
          </select>
        </div>

        {pollType === 'MULTIPLE_CHOICE' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Maximum Selections (optional)
            </label>
            <input
              type="number"
              min={1}
              value={maxSelections || ''}
              onChange={(e) => setMaxSelections(e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="Leave empty for unlimited"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
            />
          </div>
        )}

        {/* Options */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Options *
            </label>
            {pollType !== 'YES_NO' && (
              <button
                type="button"
                onClick={addOption}
                className="flex items-center gap-1 text-sm text-teal-600 dark:text-teal-400 hover:underline"
              >
                <IconPlus size={16} />
                Add Option
              </button>
            )}
          </div>
          <div className="space-y-2">
            {options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  disabled={pollType === 'YES_NO'}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
                />
                {pollType !== 'YES_NO' && options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(index)}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                  >
                    <IconTrash size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Start Date
            </label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              End Date
            </label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
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
            <span className="text-sm text-gray-700 dark:text-gray-300">Anonymous responses (responses are not linked to members)</span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={allowMultipleResponses}
              onChange={(e) => setAllowMultipleResponses(e.target.checked)}
              className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Allow members to change their response</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Link
            href="/dashboard/governance/polls"
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={createPollMutation.isPending}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
          >
            {createPollMutation.isPending ? 'Creating...' : 'Create Poll'}
          </button>
        </div>
      </form>
    </div>
  );
}
