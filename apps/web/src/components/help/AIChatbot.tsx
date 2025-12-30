'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  IconMessageCircle,
  IconX,
  IconSend,
  IconSparkles,
  IconArticle,
  IconTicket,
  IconRefresh,
  IconChevronDown,
} from '@tabler/icons-react';
import { askAI, suggestArticles, HelpArticle } from '@/lib/api/help';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: HelpArticle[];
  confidence?: number;
  timestamp: Date;
}

interface AIChatbotProps {
  defaultOpen?: boolean;
}

export function AIChatbot({ defaultOpen = false }: AIChatbotProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedArticles, setSuggestedArticles] = useState<HelpArticle[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Add welcome message
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: 'Hi! I\'m your AI assistant. I can help you find answers about using SocietyLedger. What would you like to know?',
        timestamp: new Date(),
      }]);
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
    setSuggestedArticles([]);

    try {
      // Get AI response
      const response = await askAI(userMessage.content);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.answer,
        sources: response.sources,
        confidence: response.confidence,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // If confidence is low, suggest creating a ticket
      if (response.confidence && response.confidence < 0.5) {
        setSuggestedArticles([]);
      } else if (response.sources && response.sources.length > 0) {
        setSuggestedArticles(response.sources.slice(0, 3));
      }
    } catch (error) {
      console.error('AI chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I\'m having trouble processing your request right now. Please try again or create a support ticket for assistance.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleQuickQuestion(question: string) {
    setInput(question);
    inputRef.current?.focus();
  }

  function resetChat() {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: 'Hi! I\'m your AI assistant. I can help you find answers about using SocietyLedger. What would you like to know?',
      timestamp: new Date(),
    }]);
    setSuggestedArticles([]);
  }

  const quickQuestions = [
    'How do I add a new member?',
    'How do I record a payment?',
    'How do I generate a report?',
  ];

  return (
    <>
      {/* Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
          aria-label="Open AI Assistant"
        >
          <IconSparkles size={24} />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] h-[32rem] max-h-[calc(100vh-6rem)] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <div className="flex items-center gap-2">
              <IconSparkles size={20} />
              <span className="font-semibold">AI Assistant</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={resetChat}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                title="Reset chat"
              >
                <IconRefresh size={18} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                title="Close"
              >
                <IconX size={18} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                    message.role === 'user'
                      ? 'bg-purple-500 text-white rounded-br-md'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-md'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  
                  {/* Sources */}
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-600">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Related articles:</p>
                      <div className="space-y-1">
                        {message.sources.slice(0, 2).map((source) => (
                          <Link
                            key={source.id}
                            href={`/dashboard/help/articles/${source.slug}`}
                            className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 hover:underline"
                            onClick={() => setIsOpen(false)}
                          >
                            <IconArticle size={12} />
                            {source.title}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Low confidence indicator */}
                  {message.role === 'assistant' && message.confidence !== undefined && message.confidence < 0.5 && (
                    <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-600">
                      <Link
                        href="/dashboard/help/tickets/new"
                        className="flex items-center gap-1.5 text-xs text-teal-600 dark:text-teal-400 hover:underline"
                        onClick={() => setIsOpen(false)}
                      >
                        <IconTicket size={12} />
                        Create a support ticket for more help
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Questions (show only at start) */}
          {messages.length <= 1 && !isLoading && (
            <div className="px-4 pb-2">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Quick questions:</p>
              <div className="flex flex-wrap gap-2">
                {quickQuestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleQuickQuestion(q)}
                    className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question..."
                disabled={isLoading}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="px-4 py-2.5 bg-purple-500 text-white rounded-xl hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <IconSend size={18} />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

export default AIChatbot;
