'use client';

import { useState, useEffect } from 'react';
import { Paper, Text, Button, Badge, Table, Loader, NumberInput, CopyButton, ActionIcon, Tooltip, Modal, Textarea } from '@mantine/core';
import { IconSparkles, IconBell, IconCopy, IconCheck, IconRefresh, IconSend, IconClock, IconUser } from '@tabler/icons-react';
import { aiApi, ReminderSuggestion, ReminderSuggestionsResponse } from '@/lib/api/ai';
import { toast } from '@/lib/toast';

export default function AIRemindersPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<ReminderSuggestionsResponse | null>(null);
  const [limit, setLimit] = useState<number>(10);
  const [minDaysOverdue, setMinDaysOverdue] = useState<number>(1);
  const [selectedReminder, setSelectedReminder] = useState<ReminderSuggestion | null>(null);
  const [editedMessage, setEditedMessage] = useState('');

  const fetchSuggestions = async () => {
    setIsLoading(true);
    try {
      const response = await aiApi.getReminderSuggestions({
        limit,
        minDaysOverdue,
      });
      setSuggestions(response.data);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to get suggestions';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const getToneBadge = (tone: string) => {
    const colors: Record<string, string> = {
      friendly: 'green',
      formal: 'blue',
      urgent: 'red',
    };
    return <Badge size="sm" color={colors[tone]}>{tone}</Badge>;
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `₦${num.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  };

  const handleEditReminder = (reminder: ReminderSuggestion) => {
    setSelectedReminder(reminder);
    setEditedMessage(reminder.suggestedMessage);
  };

  const handleSendReminder = () => {
    // In a real implementation, this would send the reminder via SMS/Email
    toast.success(`Reminder queued for ${selectedReminder?.memberName}`);
    setSelectedReminder(null);
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          AI Smart Reminders
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          AI-powered payment reminder suggestions with optimal timing and tone
        </p>
      </div>

      {/* Controls */}
      <Paper className="p-4 mb-4 sm:mb-6 glass-card" withBorder>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
          <NumberInput
            label="Number of Suggestions"
            value={limit}
            onChange={(val) => setLimit(val as number)}
            min={1}
            max={50}
            className="w-full sm:w-[150px]"
          />
          <NumberInput
            label="Min Days Overdue"
            value={minDaysOverdue}
            onChange={(val) => setMinDaysOverdue(val as number)}
            min={1}
            max={365}
            className="w-full sm:w-[150px]"
          />
          <Button
            onClick={fetchSuggestions}
            loading={isLoading}
            leftSection={<IconRefresh size={18} />}
            className="w-full sm:w-auto"
          >
            Refresh Suggestions
          </Button>
        </div>
      </Paper>

      {/* Summary Stats */}
      {suggestions && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <Paper className="p-3 sm:p-4 glass-card" withBorder>
            <Text size="xs" className="sm:text-sm" c="dimmed">Total Owing Members</Text>
            <Text size="lg" className="sm:text-xl" fw={700}>{suggestions.totalOwingMembers}</Text>
          </Paper>
          <Paper className="p-3 sm:p-4 glass-card" withBorder>
            <Text size="xs" className="sm:text-sm" c="dimmed">Total Outstanding</Text>
            <Text size="lg" className="sm:text-xl text-red-500" fw={700}>
              {formatCurrency(suggestions.totalOutstanding)}
            </Text>
          </Paper>
          <Paper className="p-3 sm:p-4 glass-card" withBorder>
            <Text size="xs" className="sm:text-sm" c="dimmed">Suggestions Generated</Text>
            <Text size="lg" className="sm:text-xl" fw={700}>{suggestions.suggestions.length}</Text>
          </Paper>
        </div>
      )}

      {/* Suggestions Table */}
      <Paper className="glass-card overflow-hidden" withBorder>
        {isLoading ? (
          <div className="p-8 sm:p-12 text-center">
            <Loader size="lg" className="mx-auto mb-4" />
            <Text>Generating AI suggestions...</Text>
          </div>
        ) : suggestions && suggestions.suggestions.length > 0 ? (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
              {suggestions.suggestions.map((suggestion, index) => (
                <div key={index} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <IconUser size={16} className="text-gray-400" />
                      <Text size="sm" fw={500}>{suggestion.memberName}</Text>
                    </div>
                    {getToneBadge(suggestion.suggestedTone)}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-center bg-gray-50 dark:bg-gray-700/30 rounded-lg p-2">
                    <div>
                      <Text size="xs" c="dimmed">Outstanding</Text>
                      <Text size="sm" fw={600} className="text-red-500">
                        {formatCurrency(suggestion.outstandingAmount)}
                      </Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">Days Overdue</Text>
                      <Badge size="sm" color={suggestion.daysOverdue > 60 ? 'red' : suggestion.daysOverdue > 30 ? 'yellow' : 'gray'}>
                        {suggestion.daysOverdue} days
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 text-gray-500">
                      <IconClock size={12} />
                      <span>{new Date(suggestion.suggestedTiming).toLocaleDateString()}</span>
                    </div>
                    <Badge size="xs" color={suggestion.confidence > 0.8 ? 'green' : suggestion.confidence > 0.6 ? 'yellow' : 'gray'}>
                      {Math.round(suggestion.confidence * 100)}% confidence
                    </Badge>
                  </div>
                  
                  <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                    <CopyButton value={suggestion.suggestedMessage}>
                      {({ copied, copy }) => (
                        <Button 
                          size="xs" 
                          variant="light" 
                          onClick={copy}
                          leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                          className="flex-1"
                        >
                          {copied ? 'Copied!' : 'Copy'}
                        </Button>
                      )}
                    </CopyButton>
                    <Button 
                      size="xs" 
                      variant="filled"
                      leftSection={<IconSend size={14} />}
                      onClick={() => handleEditReminder(suggestion)}
                      className="flex-1"
                    >
                      Edit & Send
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block">
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Member</Table.Th>
                    <Table.Th>Outstanding</Table.Th>
                    <Table.Th>Days Overdue</Table.Th>
                    <Table.Th>Suggested Tone</Table.Th>
                    <Table.Th>Suggested Timing</Table.Th>
                    <Table.Th>Confidence</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {suggestions.suggestions.map((suggestion, index) => (
                    <Table.Tr key={index}>
                      <Table.Td>
                        <div className="flex items-center gap-2">
                          <IconUser size={16} className="text-gray-400" />
                          <Text size="sm" fw={500}>{suggestion.memberName}</Text>
                        </div>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={600} className="text-red-500">
                          {formatCurrency(suggestion.outstandingAmount)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={suggestion.daysOverdue > 60 ? 'red' : suggestion.daysOverdue > 30 ? 'yellow' : 'gray'}>
                          {suggestion.daysOverdue} days
                        </Badge>
                      </Table.Td>
                      <Table.Td>{getToneBadge(suggestion.suggestedTone)}</Table.Td>
                      <Table.Td>
                        <div className="flex items-center gap-1">
                          <IconClock size={14} className="text-gray-400" />
                          <Text size="xs">
                            {new Date(suggestion.suggestedTiming).toLocaleDateString()}
                          </Text>
                        </div>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={suggestion.confidence > 0.8 ? 'green' : suggestion.confidence > 0.6 ? 'yellow' : 'gray'}>
                          {Math.round(suggestion.confidence * 100)}%
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <div className="flex items-center gap-1">
                          <CopyButton value={suggestion.suggestedMessage}>
                            {({ copied, copy }) => (
                              <Tooltip label={copied ? 'Copied!' : 'Copy message'}>
                                <ActionIcon variant="subtle" onClick={copy}>
                                  {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                                </ActionIcon>
                              </Tooltip>
                            )}
                          </CopyButton>
                          <Tooltip label="Edit & Send">
                            <ActionIcon 
                              variant="subtle" 
                              color="teal"
                              onClick={() => handleEditReminder(suggestion)}
                            >
                              <IconSend size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </div>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
          </>
        ) : (
          <div className="p-8 sm:p-12 text-center">
            <IconBell size={48} className="mx-auto mb-4 text-gray-400 sm:hidden" />
            <IconBell size={64} className="mx-auto mb-4 text-gray-400 hidden sm:block" />
            <Text size="lg" fw={500} mb="xs">No Suggestions Available</Text>
            <Text size="sm" c="dimmed">
              No members with overdue payments found, or AI service is unavailable.
            </Text>
          </div>
        )}
      </Paper>

      {/* Message Preview Cards */}
      {suggestions && suggestions.suggestions.length > 0 && (
        <div className="mt-4 sm:mt-6">
          <Text size="lg" fw={600} mb="md">Message Previews</Text>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {suggestions.suggestions.slice(0, 4).map((suggestion, index) => (
              <Paper key={index} className="p-3 sm:p-4 glass-card" withBorder>
                <div className="flex items-center justify-between mb-2">
                  <Text size="sm" fw={600}>{suggestion.memberName}</Text>
                  {getToneBadge(suggestion.suggestedTone)}
                </div>
                <Paper className="p-2 sm:p-3 bg-gray-50 dark:bg-gray-800 mb-2" withBorder>
                  <Text size="xs" className="sm:text-sm">{suggestion.suggestedMessage}</Text>
                </Paper>
                <Text size="xs" c="dimmed" mb="sm" className="line-clamp-2">
                  <strong>AI Reasoning:</strong> {suggestion.reasoning}
                </Text>
                <div className="flex gap-2">
                  <CopyButton value={suggestion.suggestedMessage}>
                    {({ copied, copy }) => (
                      <Button 
                        size="xs" 
                        variant="light" 
                        onClick={copy}
                        leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                        className="flex-1"
                      >
                        {copied ? 'Copied!' : 'Copy'}
                      </Button>
                    )}
                  </CopyButton>
                  <Button 
                    size="xs" 
                    variant="filled"
                    leftSection={<IconSend size={14} />}
                    onClick={() => handleEditReminder(suggestion)}
                    className="flex-1"
                  >
                    Edit & Send
                  </Button>
                </div>
              </Paper>
            ))}
          </div>
        </div>
      )}

      {/* Edit & Send Modal */}
      <Modal
        opened={!!selectedReminder}
        onClose={() => setSelectedReminder(null)}
        title="Edit & Send Reminder"
        size="lg"
      >
        {selectedReminder && (
          <div>
            <div className="mb-4">
              <Text size="sm" c="dimmed">Recipient</Text>
              <Text fw={500}>{selectedReminder.memberName}</Text>
            </div>
            <div className="mb-4">
              <Text size="sm" c="dimmed">Outstanding Amount</Text>
              <Text fw={500} className="text-red-500">
                {formatCurrency(selectedReminder.outstandingAmount)}
              </Text>
            </div>
            <Textarea
              label="Message"
              value={editedMessage}
              onChange={(e) => setEditedMessage(e.target.value)}
              minRows={4}
              mb="md"
            />
            <Text size="xs" c="dimmed" mb="md">
              Character count: {editedMessage.length} / 160 (SMS limit)
            </Text>
            <div className="flex gap-2 justify-end">
              <Button variant="light" onClick={() => setSelectedReminder(null)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSendReminder}
                leftSection={<IconSend size={16} />}
                className="bg-gradient-to-r from-teal-500 to-green-500"
              >
                Send Reminder
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
