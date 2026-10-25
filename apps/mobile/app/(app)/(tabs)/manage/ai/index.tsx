import { useRouter } from 'expo-router';
import { Bell, FileText, Send, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { ScrollView, View } from 'react-native';

import { StickyFooter } from '@/components/layout/StickyFooter';
import { FieldInput } from '@/components/forms/FieldInput';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { AiGate } from '@/features/ai/components/AiGate';
import { MessageBubble, PromptChips, ThinkingBubble, UsageBar } from '@/features/ai/components/AiParts';
import { clearChat, historyFor, loadChat, saveChat, type ChatMessage } from '@/features/ai/history';
import { AI_BUY_ACCESS, AI_REPORT_ACCESS, SUGGESTED_PROMPTS, aiErrorMessage, canAfford, isOutOfRequests } from '@/features/ai/labels';
import { useAskAi } from '@/features/ai/mutations';
import { useAiCredits } from '@/features/ai/queries';
import { useCan } from '@/hooks/useCan';
import { useTenantKey } from '@/hooks/useTenantKey';
import { useThemeTokens } from '@/providers/ThemeProvider';
import { useSessionStore } from '@/stores/session';

const MAX_QUESTION = 1000;
const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/** project-overview.md §6.9 AI1 — ask about the association's money in plain words. The conversation is kept on this phone only. */
export default function AiAssistantScreen() {
  return (
    <AiGate title="AI assistant">
      <AssistantChat />
    </AiGate>
  );
}

function AssistantChat() {
  const router = useRouter();
  const { color } = useThemeTokens();
  const tenant = useTenantKey();
  const userId = useSessionStore((s) => s.user?.id ?? 0);
  const credits = useAiCredits();
  const canBuy = useCan(AI_BUY_ACCESS);
  const canReport = useCan(AI_REPORT_ACCESS);
  const ask = useAskAi();
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);

  const [messages, setMessages] = useState<ChatMessage[]>(() => loadChat(tenant, userId));
  const [draft, setDraft] = useState('');
  const [outOfRequests, setOutOfRequests] = useState(false);
  const [freshId, setFreshId] = useState<string | null>(null);

  const status = credits.data?.status;
  const affordable = status ? canAfford(status, 'question') : true;
  const switchedOff = status ? !status.enabled : false;

  const commit = useCallback(
    (next: ChatMessage[]) => {
      setMessages(next);
      saveChat(tenant, userId, next);
    },
    [tenant, userId],
  );

  useEffect(() => {
    scroller.current?.scrollToEnd({ animated: true });
  }, [messages.length, ask.isPending]);

  function send(text: string) {
    const question = text.trim();
    if (!question || ask.isPending) return;
    const mine: ChatMessage = { id: newId(), role: 'user', content: question, at: new Date().toISOString() };
    const before = messages;
    commit([...before, mine]);
    setDraft('');
    setOutOfRequests(false);
    ask.mutate(
      { question, history: historyFor(before) },
      {
        onSuccess: (answer) => {
          const reply: ChatMessage = { id: newId(), role: 'assistant', content: answer.answer, tables: answer.tables, period: answer.period, confidence: answer.confidence, at: new Date().toISOString() };
          setFreshId(reply.id);
          commit([...before, mine, reply]);
        },
        onError: (error) => {
          setOutOfRequests(isOutOfRequests(error));
          commit([...before, mine, { id: newId(), role: 'assistant', content: aiErrorMessage(error), failed: true, at: new Date().toISOString() }]);
        },
      },
    );
  }

  function startOver() {
    clearChat(tenant, userId);
    setMessages([]);
    setFreshId(null);
  }

  const buy = () => router.push('/(app)/(tabs)/manage/ai/credits' as never);
  const blocked = switchedOff || !affordable;

  return (
    <Screen edges={['top']} scroll={false} keyboard>
      <ScreenHeader
        title="AI assistant"
        onBack={() => router.back()}
        docsKey="AI1"
        rightActions={
          <>
            <IconButton icon={Bell} accessibilityLabel="Smart reminders" onPress={() => router.push('/(app)/(tabs)/manage/ai/reminders' as never)} testID="ai-reminders" />
            {canReport ? <IconButton icon={FileText} accessibilityLabel="AI report" onPress={() => router.push('/(app)/(tabs)/manage/ai/report' as never)} testID="ai-report" /> : null}
            {messages.length > 0 ? <IconButton icon={Trash2} accessibilityLabel="Clear the conversation" onPress={startOver} testID="ai-clear" /> : null}
          </>
        }
      />
      <ScrollView ref={scroller} className="flex-1" contentContainerStyle={{ gap: 12, paddingBottom: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <UsageBar status={status} canBuy={canBuy} onBuy={buy} />

        {messages.length === 0 ? (
          <View className="gap-3 pt-2">
            <Text variant="h3">Ask about your association&apos;s money</Text>
            <Text variant="body" tone="secondary">
              The answers come from the same figures as Reports and Accounting. Members&apos; names, phone numbers and emails are never sent to the AI.
            </Text>
            <PromptChips prompts={SUGGESTED_PROMPTS} onPick={send} disabled={blocked || ask.isPending} />
          </View>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} animate={m.id === freshId} />)
        )}

        {ask.isPending ? <ThinkingBubble /> : null}

        {switchedOff ? (
          <Text variant="body" tone="danger" testID="ai-off">
            The assistant is switched off right now. Try again later.
          </Text>
        ) : !affordable || outOfRequests ? (
          <View className="gap-2" testID="ai-out">
            <Text variant="body" tone="secondary">
              You have used today&apos;s free requests and have no credits left. Free requests start again tomorrow.
            </Text>
            {canBuy ? (
              <Button variant="primary" onPress={buy} testID="ai-buy-out">
                Buy credits to carry on
              </Button>
            ) : (
              <Text variant="caption" tone="secondary">
                Ask the Treasurer or Administrator to buy credits.
              </Text>
            )}
          </View>
        ) : null}
      </ScrollView>

      <StickyFooter>
        <View className="flex-1 flex-row items-end gap-3">
          <FieldInput
            testID="ai-input"
            value={draft}
            onChangeText={setDraft}
            placeholder={blocked ? 'No requests left' : 'Ask a question'}
            placeholderTextColor={color.textTertiary}
            multiline
            maxLength={MAX_QUESTION}
            editable={!blocked && !ask.isPending}
            returnKeyType="send"
            className="max-h-[120px] min-h-[52px] flex-1 rounded-md border border-border-strong bg-surface-sunken px-4 py-3 font-regular text-body text-text"
          />
          <IconButton icon={Send} accessibilityLabel="Send" onPress={() => send(draft)} disabled={blocked || ask.isPending || draft.trim() === ''} testID="ai-send" />
        </View>
      </StickyFooter>
    </Screen>
  );
}
