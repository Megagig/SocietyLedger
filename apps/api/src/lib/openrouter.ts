// ============================================
// PHASE 17: OPENROUTER CLIENT
// AI Provider Integration with Safety Guards
// ============================================

import axios, { AxiosInstance } from 'axios';

// ============================================
// TYPES
// ============================================

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterCompletionRequest {
  model: string;
  messages: OpenRouterMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
}

interface OpenRouterCompletionResponse {
  id: string;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenRouterEmbeddingRequest {
  model: string;
  input: string | string[];
}

interface OpenRouterEmbeddingResponse {
  data: {
    embedding: number[];
    index: number;
  }[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

// ============================================
// CONFIGURATION
// ============================================

const OPENROUTER_CONFIG = {
  baseUrl: 'https://openrouter.ai/api/v1',
  defaultModel: 'openai/gpt-4-turbo-preview',
  embeddingModel: 'openai/text-embedding-ada-002',
  maxRetries: 3,
  retryDelay: 1000,
  timeout: 60000,
};

// Model pricing per 1M tokens (approximate)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'openai/gpt-4-turbo-preview': { input: 10, output: 30 },
  'openai/gpt-4': { input: 30, output: 60 },
  'openai/gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  'anthropic/claude-3-opus': { input: 15, output: 75 },
  'anthropic/claude-3-sonnet': { input: 3, output: 15 },
  'anthropic/claude-3-haiku': { input: 0.25, output: 1.25 },
  'google/gemini-pro': { input: 0.5, output: 1.5 },
  'openai/text-embedding-ada-002': { input: 0.1, output: 0 },
};

// ============================================
// OPENROUTER CLIENT CLASS
// ============================================

class OpenRouterClient {
  private client: AxiosInstance;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    
    this.client = axios.create({
      baseURL: OPENROUTER_CONFIG.baseUrl,
      timeout: OPENROUTER_CONFIG.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': process.env.APP_URL || 'https://societyledger.com',
        'X-Title': 'SocietyLedger AI Assistant',
      },
    });
  }

  /**
   * Check if OpenRouter is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  /**
   * Generate chat completion
   */
  async chat(
    messages: OpenRouterMessage[],
    options: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
    } = {}
  ): Promise<{
    content: string;
    model: string;
    tokensUsed: { input: number; output: number; total: number };
    finishReason: string;
    costUsd: number;
  }> {
    if (!this.isConfigured()) {
      throw new Error('OpenRouter API key not configured');
    }

    const model = options.model || OPENROUTER_CONFIG.defaultModel;
    const request: OpenRouterCompletionRequest = {
      model,
      messages,
      max_tokens: options.maxTokens || 2000,
      temperature: options.temperature ?? 0.7,
      stream: false,
    };

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= OPENROUTER_CONFIG.maxRetries; attempt++) {
      try {
        const response = await this.client.post<OpenRouterCompletionResponse>(
          '/chat/completions',
          request
        );

        const data = response.data;
        const tokensUsed = {
          input: data.usage.prompt_tokens,
          output: data.usage.completion_tokens,
          total: data.usage.total_tokens,
        };

        // Calculate cost
        const pricing = MODEL_PRICING[model] || { input: 1, output: 2 };
        const costUsd = (tokensUsed.input * pricing.input + tokensUsed.output * pricing.output) / 1_000_000;

        return {
          content: data.choices[0]?.message?.content || '',
          model: data.model,
          tokensUsed,
          finishReason: data.choices[0]?.finish_reason || 'unknown',
          costUsd,
        };
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on client errors (4xx)
        if (error.response?.status >= 400 && error.response?.status < 500) {
          throw new Error(`OpenRouter API error: ${error.response?.data?.error?.message || error.message}`);
        }

        // Retry on server errors (5xx) or network errors
        if (attempt < OPENROUTER_CONFIG.maxRetries) {
          await this.delay(OPENROUTER_CONFIG.retryDelay * attempt);
          continue;
        }
      }
    }

    throw lastError || new Error('Failed to get AI response after retries');
  }

  /**
   * Generate embeddings for text
   */
  async embed(
    text: string | string[],
    options: { model?: string } = {}
  ): Promise<{
    embeddings: number[][];
    model: string;
    tokensUsed: number;
    costUsd: number;
  }> {
    if (!this.isConfigured()) {
      throw new Error('OpenRouter API key not configured');
    }

    const model = options.model || OPENROUTER_CONFIG.embeddingModel;
    const request: OpenRouterEmbeddingRequest = {
      model,
      input: text,
    };

    try {
      const response = await this.client.post<OpenRouterEmbeddingResponse>(
        '/embeddings',
        request
      );

      const data = response.data;
      const tokensUsed = data.usage.total_tokens;
      
      // Calculate cost
      const pricing = MODEL_PRICING[model] || { input: 0.1, output: 0 };
      const costUsd = (tokensUsed * pricing.input) / 1_000_000;

      return {
        embeddings: data.data.map(d => d.embedding),
        model: data.model,
        tokensUsed,
        costUsd,
      };
    } catch (error: any) {
      throw new Error(`OpenRouter embedding error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * List available models
   */
  async listModels(): Promise<{ id: string; name: string; pricing: any }[]> {
    if (!this.isConfigured()) {
      throw new Error('OpenRouter API key not configured');
    }

    try {
      const response = await this.client.get('/models');
      return response.data.data || [];
    } catch (error: any) {
      throw new Error(`Failed to list models: ${error.message}`);
    }
  }

  /**
   * Helper: Delay for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const openRouterClient = new OpenRouterClient();

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Build a system prompt for financial assistant
 */
export function buildFinancialSystemPrompt(): string {
  return `You are a helpful financial assistant for SocietyLedger, a platform for managing association finances.

CRITICAL RULES - YOU MUST FOLLOW THESE:
1. You ONLY explain and summarize financial data that is provided to you
2. You NEVER perform calculations - all numbers must come from the provided data
3. You NEVER suggest modifying any database records
4. You NEVER access data from other associations
5. You NEVER make up or infer data that wasn't provided
6. If you don't have enough information, say so clearly

Your role is to:
- Explain financial summaries in plain language
- Help users understand their association's financial status
- Answer questions about dues, payments, and member balances
- Provide insights based on the data provided

Always be helpful, accurate, and concise. Use Nigerian Naira (₦) for currency.`;
}

/**
 * Build a system prompt for document Q&A
 */
export function buildDocumentQASystemPrompt(): string {
  return `You are a document assistant for SocietyLedger, helping users find information in their association documents.

CRITICAL RULES - YOU MUST FOLLOW THESE:
1. You ONLY answer based on the document excerpts provided
2. If the answer is not in the provided documents, say "I don't have information about that in your documents"
3. You NEVER make up information or guess
4. You NEVER access documents from other associations
5. Always cite which document type the information comes from

Your role is to:
- Answer questions about association bylaws, constitution, and policies
- Help users find specific rules or procedures
- Explain document content in plain language

Be accurate and always reference the source document.`;
}

/**
 * Build a system prompt for smart reminders
 */
export function buildReminderSystemPrompt(): string {
  return `You are a reminder assistant for SocietyLedger, helping craft payment reminder messages.

CRITICAL RULES:
1. You ONLY suggest reminder messages - you NEVER send them automatically
2. All suggestions must be reviewed by an admin before sending
3. Be respectful and culturally appropriate for Nigerian associations
4. Never be threatening or aggressive

Generate reminder messages that are:
- Friendly but clear about the outstanding amount
- Appropriate for the level of urgency (days overdue)
- Professional and respectful
- Include the specific amount owed

Tone guidelines:
- 1-30 days overdue: Friendly reminder
- 31-60 days overdue: Formal follow-up
- 60+ days overdue: Urgent but respectful`;
}

export default openRouterClient;
