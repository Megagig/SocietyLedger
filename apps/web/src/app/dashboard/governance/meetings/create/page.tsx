'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createMeeting, MeetingType } from '@/lib/api/meetings';
import {
  IconArrowLeft,
  IconCalendarEvent,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';

interface AgendaItem {
  orderNumber: number;
  title: string;
  description: string;
  duration: number | null;
  presenter: string;
}

export default function CreateMeetingPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [meetingType, setMeetingType] = useState<MeetingType>('REGULAR');
  const [location, setLocation] = useState('');
  const [virtualLink, setVirtualLink] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [quorumRequired, setQuorumRequired] = useState<number | ''>('');
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);

  const addAgendaItem = () => {
    setAgendaItems([
      ...agendaItems,
      {
        orderNumber: agendaItems.length + 1,
        title: '',
        description: '',
        duration: null,
        presenter: '',
      },
    ]);
  };

  const updateAgendaItem = (index: number, field: keyof AgendaItem, value: any) => {
    const updated = [...agendaItems];
    updated[index] = { ...updated[index], [field]: value };
    setAgendaItems(updated);
  };

  const removeAgendaItem = (index: number) => {
    const updated = agendaItems.filter((_, i) => i !== index);
    // Reorder
    updated.forEach((item, i) => {
      item.orderNumber = i + 1;
    });
    setAgendaItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title || !startDate || !startTime) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setIsSubmitting(true);

      const startDateTime = new Date(`${startDate}T${startTime}`).toISOString();
      const endDateTime = endTime ? new Date(`${startDate}T${endTime}`).toISOString() : undefined;

      const validAgendaItems = agendaItems
        .filter((item) => item.title.trim())
        .map((item) => ({
          orderNumber: item.orderNumber,
          title: item.title,
          description: item.description || undefined,
          duration: item.duration || undefined,
          presenter: item.presenter || undefined,
        }));

      await createMeeting({
        title,
        description: description || undefined,
        meetingType,
        location: location || undefined,
        virtualLink: virtualLink || undefined,
        startTime: startDateTime,
        endTime: endDateTime,
        quorumRequired: quorumRequired ? Number(quorumRequired) : undefined,
        agendaItems: validAgendaItems.length > 0 ? validAgendaItems : undefined,
      });

      router.push('/dashboard/governance/meetings');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          <IconArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Schedule New Meeting
          </h1>
          <p className="text-gray-500">Create a new meeting and invite members</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Meeting Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Meeting Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                placeholder="e.g., Monthly General Meeting"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Meeting Type
              </label>
              <select
                value={meetingType}
                onChange={(e) => setMeetingType(e.target.value as MeetingType)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
              >
                <option value="REGULAR">Regular Meeting</option>
                <option value="EMERGENCY">Emergency Meeting</option>
                <option value="AGM">Annual General Meeting (AGM)</option>
                <option value="EGM">Extraordinary General Meeting (EGM)</option>
                <option value="COMMITTEE">Committee Meeting</option>
                <option value="SPECIAL">Special Meeting</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Quorum Required
              </label>
              <input
                type="number"
                value={quorumRequired}
                onChange={(e) => setQuorumRequired(e.target.value ? parseInt(e.target.value) : '')}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                placeholder="Minimum attendees"
                min="1"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                placeholder="Meeting description and objectives..."
              />
            </div>
          </div>
        </div>

        {/* Date & Time */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Date & Time
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Time *
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Time
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Location
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Physical Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                placeholder="e.g., Community Hall, Room 101"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Virtual Meeting Link
              </label>
              <input
                type="url"
                value={virtualLink}
                onChange={(e) => setVirtualLink(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                placeholder="https://zoom.us/j/..."
              />
            </div>
          </div>
        </div>

        {/* Agenda */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Agenda Items
            </h2>
            <button
              type="button"
              onClick={addAgendaItem}
              className="flex items-center gap-2 px-3 py-1 text-sm text-teal-600 hover:text-teal-800"
            >
              <IconPlus size={16} />
              Add Item
            </button>
          </div>

          {agendaItems.length > 0 ? (
            <div className="space-y-4">
              {agendaItems.map((item, index) => (
                <div
                  key={index}
                  className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div className="flex items-start gap-4">
                    <span className="flex-shrink-0 w-8 h-8 bg-teal-100 dark:bg-teal-900/30 text-teal-600 rounded-full flex items-center justify-center font-medium">
                      {index + 1}
                    </span>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => updateAgendaItem(index, 'title', e.target.value)}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white"
                        placeholder="Agenda item title"
                      />
                      <input
                        type="text"
                        value={item.presenter}
                        onChange={(e) => updateAgendaItem(index, 'presenter', e.target.value)}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white"
                        placeholder="Presenter name"
                      />
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateAgendaItem(index, 'description', e.target.value)}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white"
                        placeholder="Description (optional)"
                      />
                      <input
                        type="number"
                        value={item.duration || ''}
                        onChange={(e) => updateAgendaItem(index, 'duration', e.target.value ? parseInt(e.target.value) : null)}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white"
                        placeholder="Duration (minutes)"
                        min="1"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAgendaItem(index)}
                      className="p-2 text-red-500 hover:text-red-700"
                    >
                      <IconTrash size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">
              No agenda items yet. Click &quot;Add Item&quot; to create one.
            </p>
          )}
        </div>

        {/* Submit */}
        <div className="flex gap-4 justify-end">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
          >
            <IconCalendarEvent size={18} />
            {isSubmitting ? 'Creating...' : 'Schedule Meeting'}
          </button>
        </div>
      </form>
    </div>
  );
}
