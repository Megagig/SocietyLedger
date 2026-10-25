import { getObject, remove, setObject } from '@/lib/storage';
import type { AiTableDTO, AiTurn } from '@/types/api/ai';

/** One message in the conversation. The history lives on this phone only; the server keeps none of it. */
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
const key = (tenant: string, userId: number | string) => `ai.chat.${tenant}.${userId}`;

export function loadChat(tenant: string, userId: number | string): ChatMessage[] {
  const saved = getObject<ChatMessage[]>(key(tenant, userId));
  return Array.isArray(saved) ? saved.filter((m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant')) : [];
}

export function saveChat(tenant: string, userId: number | string, messages: ChatMessage[]): void {
  setObject(key(tenant, userId), messages.slice(-KEEP));
}

export function clearChat(tenant: string, userId: number | string): void {
  remove(key(tenant, userId));
}

/** The last few turns sent with a question so a follow-up makes sense. Failures are left out. */
export function historyFor(messages: ChatMessage[], turns = 6): AiTurn[] {
  return messages
    .filter((m) => !m.failed)
    .slice(-turns)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1000) }));
}
