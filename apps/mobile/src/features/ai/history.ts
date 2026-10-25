import type { AiTableDTO, AiTurn } from '@/types/api/ai';

/** One message in the conversation. The history lives in this phone's memory only; the server keeps none of it. */
export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tables?: AiTableDTO[];
  period?: string;
  confidence?: 'high' | 'medium' | 'low';
  at: string;
  /** An assistant message that is an error and not an answer. */
  failed?: boolean;
};

const KEEP = 40;

// Answers hold real member names and balances, so they are never written to the phone's storage (it is not encrypted): they stay in
// memory, survive leaving the screen, and are gone when the app closes.
const chats = new Map<string, ChatMessage[]>();
const key = (tenant: string, userId: number | string) => `${tenant}:${userId}`;

export function loadChat(tenant: string, userId: number | string): ChatMessage[] {
  return chats.get(key(tenant, userId)) ?? [];
}

export function saveChat(tenant: string, userId: number | string, messages: ChatMessage[]): void {
  chats.set(key(tenant, userId), messages.slice(-KEEP));
}

export function clearChat(tenant: string, userId: number | string): void {
  chats.delete(key(tenant, userId));
}

/** Forgets every conversation, for example when the person signs out. */
export function clearAllChats(): void {
  chats.clear();
}

/** The last few turns sent with a question so a follow-up makes sense. Failures are left out. */
export function historyFor(messages: ChatMessage[], turns = 6): AiTurn[] {
  return messages
    .filter((m) => !m.failed)
    .slice(-turns)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1000) }));
}
