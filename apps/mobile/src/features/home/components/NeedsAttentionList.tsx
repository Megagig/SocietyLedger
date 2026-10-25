import { useRouter } from 'expo-router';
import { CheckCircle2 } from 'lucide-react-native';
import { View } from 'react-native';
import type { UseQueryResult } from '@tanstack/react-query';

import type { AttentionItemDTO } from '@/api/endpoints/dashboard';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Section } from '@/components/layout/Section';
import { Badge } from '@/components/ui/Badge';
import { IconCircle } from '@/components/ui/IconCircle';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';
import { attentionRows } from '../attention';

type Props = {
  attentionQuery: UseQueryResult<AttentionItemDTO[], unknown>;
};

export function NeedsAttentionList({ attentionQuery }: Props) {
  const router = useRouter();
  const { color } = useThemeTokens();
  const rows = attentionRows(attentionQuery.data);

  if (attentionQuery.isLoading) {
    return (
      <Section title="Needs your attention">
        <Skeleton width="100%" height={64} radius="lg" />
      </Section>
    );
  }
  // A failed load shows nothing rather than a false "all clear".
  if (attentionQuery.isError) return null;

  return (
    <Section title="Needs your attention">
      {rows.length === 0 ? (
        <View className="flex-row items-center gap-3 rounded-2xl border border-border bg-surface-raised p-4" testID="attention-clear">
          <CheckCircle2 size={20} color={color.success} />
          <Text variant="body" tone="secondary" style={{ flex: 1 }}>
            You&apos;re all caught up. Nothing is waiting on you.
          </Text>
        </View>
      ) : (
        <ListGroup>
          {rows.map((row) => (
            <ListItem
              key={row.key}
              leading={<IconCircle icon={row.icon} tone={row.tone} />}
              title={row.label(row.count)}
              trailing={<Badge tone={row.urgent ? 'danger' : 'warning'}>{String(row.count)}</Badge>}
              showChevron
              onPress={() => router.push(row.href as never)}
              testID={`attention-${row.key}`}
            />
          ))}
        </ListGroup>
      )}
    </Section>
  );
}
