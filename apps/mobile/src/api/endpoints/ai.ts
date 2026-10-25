import { client } from '../client';
import { unwrap } from '../envelope';
import type { AiAnswerDTO, AiCreditsDTO, AiReportDTO, AiReportType, AskPayload, ReminderSuggestionsDTO, StartPurchaseDTO, VerifyPurchaseDTO } from '@/types/api/ai';

// The model can take half a minute to answer, well past the app's usual wait.
const SLOW = { timeout: 60_000 };

/**
 * The AI assistant. Reading and asking need `payments`-level finance access (`ledger.view`); buying credits needs `payments.approve` or
 * `settings.billing`. Out of free requests and credits answers 429 `AI_ALLOWANCE_EXHAUSTED`; the assistant switched off answers 503
 * `AI_DISABLED`. A request that fails costs nothing.
 */
export const aiApi = {
  /** GET /ai/credits — what is left today and in credits, the price, and the last purchases. */
  async getCredits(): Promise<AiCreditsDTO> {
    return unwrap<AiCreditsDTO>(client.get('/ai/credits'));
  },

  /** POST /ai/financial/ask — a question about the association's money, with the conversation so far. */
  async ask(payload: AskPayload): Promise<AiAnswerDTO> {
    return unwrap<AiAnswerDTO>(client.post('/ai/financial/ask', payload, SLOW));
  },

  /** GET /ai/reminders/suggestions — who to remind and the words to use. */
  async reminders(params: { limit?: number; minDaysOverdue?: number } = {}): Promise<ReminderSuggestionsDTO> {
    return unwrap<ReminderSuggestionsDTO>(client.get('/ai/reminders/suggestions', { params, ...SLOW }));
  },

  /** POST /ai/reports/generate — a written report; costs more than a question. */
  async report(payload: { reportType: AiReportType; includeRecommendations?: boolean }): Promise<AiReportDTO> {
    return unwrap<AiReportDTO>(client.post('/ai/reports/generate', payload, SLOW));
  },

  /** POST /ai/credits/purchase — starts a Paystack payment for this many credits (`platform: 'mobile'` returns to the app). */
  async startPurchase(credits: number): Promise<StartPurchaseDTO> {
    return unwrap<StartPurchaseDTO>(client.post('/ai/credits/purchase', { credits, platform: 'mobile' }));
  },

  /** GET /ai/credits/verify/:reference — asks Paystack whether the payment went through, and adds the credits if it did. */
  async verifyPurchase(reference: string): Promise<VerifyPurchaseDTO> {
    return unwrap<VerifyPurchaseDTO>(client.get(`/ai/credits/verify/${encodeURIComponent(reference)}`));
  },
};
