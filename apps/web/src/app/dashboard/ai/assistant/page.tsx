'use client';

import { useState, useRef, useEffect } from 'react';
import { TextInput, Button, Paper, Text, Badge, Loader, Select, Progress } from '@mantine/core';
import { IconSend, IconRobot, IconUser, IconSparkles, IconAlertCircle, IconInfoCircle } from '@tabler/icons-react';
import { aiApi, FinancialQueryResponse, RateLimitStatus } from '@/lib/api/ai';
import { toast } from '@/lib/toast';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  tokensUsed?: { input: number; output: number };
  confidence?: 'high' | 'medium' | 'low';
  processingTimeMs?: number;
}

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitStatus | null>(null);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check AI status on mount
  useEffect(() => {
    checkAIStatus();
  }, []);

  const checkAIStatus = async () => {
    try {
      const response = await aiApi.getStatus();
      setAiAvailable(response.data.available);
      setRateLimitStatus(response.data.rateLimit);
    } catch (error) {
      setAiAvailable(false);
      console.error('Failed to check AI status:', error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await aiApi.askFinancialQuestion({ question: userMessage.content });
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data.answer,
        timestamp: new Date(),
        tokensUsed: response.data.tokensUsed,
        confidence: response.data.confidence,
        processingTimeMs: response.data.processingTimeMs,
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // Refresh rate limit status
      checkAIStatus();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to get AI response';
      toast.error(errorMessage);
      
      // Add error message to chat
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${errorMessage}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedQuestions = [
    "What's our total income this month?",
    "Who hasn't paid their dues?",
    "What's our collection rate?",
    "Summarize our financial position",
    "How many members are overdue?",
  ];

  const getConfidenceBadge = (confidence: string) => {
    const colors: Record<string, string> = {
      high: 'green',
      medium: 'yellow',
      low: 'red',
    };
    return <Badge size="xs" color={colors[confidence]}>{confidence} confidence</Badge>;
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
              AI Financial Assistant
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Ask questions about your association&apos;s finances in plain English
            </p>
          </div>
          {aiAvailable !== null && (
            <Badge 
              size="lg" 
              color={aiAvailable ? 'green' : 'red'}
              leftSection={aiAvailable ? <IconSparkles size={14} /> : <IconAlertCircle size={14} />}
              className="self-start sm:self-auto"
            >
              {aiAvailable ? 'AI Online' : 'AI Offline'}
            </Badge>
          )}
        </div>

        {/* Rate Limit Status */}
        {rateLimitStatus && (
          <Paper className="mt-4 p-3 glass-card" withBorder>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
              <Text size="sm" c="dimmed">Daily Usage</Text>
              <Text size="sm" fw={500}>
                {rateLimitStatus.requestsUsed} / {rateLimitStatus.requestsUsed + rateLimitStatus.requestsRemaining} requests
              </Text>
            </div>
            <Progress 
              value={(rateLimitStatus.requestsUsed / (rateLimitStatus.requestsUsed + rateLimitStatus.requestsRemaining)) * 100} 
              color={rateLimitStatus.isLimited ? 'red' : 'teal'}
              size="sm"
            />
            {rateLimitStatus.isLimited && (
              <Text size="xs" c="red" mt="xs">
                Rate limit reached. Resets at {new Date(rateLimitStatus.resetsAt).toLocaleTimeString()}
              </Text>
            )}
          </Paper>
        )}
      </div>

      {/* Chat Messages */}
      <Paper className="flex-1 overflow-y-auto p-4 glass-card mb-4" withBorder>
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <IconRobot size={48} className="text-teal-500 mb-4 sm:hidden" />
            <IconRobot size={64} className="text-teal-500 mb-4 hidden sm:block" />
            <Text size="lg" fw={500} mb="xs">How can I help you today?</Text>
            <Text size="sm" c="dimmed" mb="lg">
              Ask me anything about your association&apos;s finances. I can explain data, summarize reports, and answer questions.
            </Text>
            
            {/* Suggested Questions */}
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {suggestedQuestions.map((question, index) => (
                <Button
                  key={index}
                  variant="light"
                  size="xs"
                  onClick={() => setInput(question)}
                  className="text-xs"
                >
                  {question}
                </Button>
              ))}
            </div>

            {/* Safety Notice */}
            <Paper className="mt-6 p-3 max-w-md" withBorder>
              <div className="flex items-start gap-2">
                <IconInfoCircle size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <Text size="xs" fw={500}>AI Safety Notice</Text>
                  <Text size="xs" c="dimmed">
                    This AI assistant only explains existing data. It cannot perform calculations, 
                    modify records, or access data from other associations.
                  </Text>
                </div>
              </div>
            </Paper>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[90%] sm:max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-teal-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-800'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {message.role === 'user' ? (
                      <IconUser size={16} />
                    ) : (
                      <IconRobot size={16} className="text-teal-500" />
                    )}
                    <Text size="xs" c={message.role === 'user' ? 'white' : 'dimmed'}>
                      {message.role === 'user' ? 'You' : 'AI Assistant'}
                    </Text>
                    {message.confidence && getConfidenceBadge(message.confidence)}
                  </div>
                  <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                    {message.content}
                  </Text>
                  {message.tokensUsed && (
                    <Text size="xs" c="dimmed" mt="xs">
                      {message.tokensUsed.input + message.tokensUsed.output} tokens • {message.processingTimeMs}ms
                    </Text>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Loader size="xs" />
                    <Text size="sm" c="dimmed">AI is thinking...</Text>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </Paper>

      {/* Input Area */}
      <div className="flex gap-2">
        <TextInput
          placeholder="Ask a question about your finances..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isLoading || !aiAvailable || rateLimitStatus?.isLimited}
          className="flex-1"
          size="md"
          rightSection={
            isLoading ? <Loader size="xs" /> : null
          }
        />
        <Button
          onClick={handleSend}
          disabled={!input.trim() || isLoading || !aiAvailable || rateLimitStatus?.isLimited}
          size="md"
          className="bg-gradient-to-r from-teal-500 to-green-500"
        >
          <IconSend size={18} />
        </Button>
      </div>
    </div>
  );
}
