// The AI assistant (project-overview.md §6.9 AI1–AI4). Money in these answers is already written in full by the server.

export type AiKind = 'question' | 'reminders' | 'report';
export type AiPeriod = 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'this_year' | 'last_year';

/** What is left today and in credits, and the price. Every answer and every purchase brings a fresh one. */
export type AiStatusDTO = {
  enabled: boolean;
  tier: string;
  allowancePerDay: number;
  allowanceUsed: number;
  allowanceLeft: number;
  credits: number;
  totalPurchased: number;
  weights: Record<AiKind, number>;
  creditPriceNaira: number;
  minPurchaseNaira: number;
  minimumCredits: number;
  canAsk: boolean;
  /** When the day's allowance starts again. */
  resetsAt: string;
};

export type AiTableDTO = { id: 'owing' | 'income' | 'spending' | 'asked'; title: string; columns: string[]; rows: string[][] };

export type AiAnswerDTO = {
  answer: string;
  tables: AiTableDTO[];
  dataUsed: { type: string; summary: string }[];
  confidence: 'high' | 'medium' | 'low';
  period: string;
  units: number;
  usage: AiStatusDTO;
};

export type AiTurn = { role: 'user' | 'assistant'; content: string };
export type AskPayload = { question: string; history?: AiTurn[]; period?: AiPeriod };

export type ReminderTone = 'friendly' | 'formal' | 'urgent';
export type ReminderSuggestionDTO = {
  memberId: number;
  memberName: string;
  outstandingAmount: string;
  daysOverdue: number;
  suggestedTone: ReminderTone;
  suggestedMessage: string;
  reasoning: string;
  transactionIds?: number[];
};
export type ReminderSuggestionsDTO = {
  suggestions: ReminderSuggestionDTO[];
  totalOwingMembers: number;
  totalOutstanding: string;
  /** False when the model could not be reached and the built-in words were used (nothing is charged then). */
  aiWritten: boolean;
  units: number;
  usage: AiStatusDTO;
};

export type AiReportType = 'monthly_summary' | 'quarterly_review' | 'annual_report' | 'treasurer_handover';
export type AiReportDTO = {
  title: string;
  summary: string;
  sections: { heading: string; content: string }[];
  highlights: string[];
  recommendations?: string[];
  generatedAt: string;
  period: string;
  units: number;
  usage: AiStatusDTO;
};

export type AiPurchaseStatus = 'pending' | 'success' | 'failed';
export type AiPurchaseDTO = { id: number; reference: string; credits: number; amount: string; status: AiPurchaseStatus; paidAt: string | null; createdAt: string };
export type AiCreditsDTO = { status: AiStatusDTO; purchases: AiPurchaseDTO[] };
export type StartPurchaseDTO = { reference: string; authorizationUrl: string; credits: number; amount: number };
export type VerifyPurchaseDTO = { status: 'success' | 'pending' | 'failed'; credits: number; usage: AiStatusDTO };
