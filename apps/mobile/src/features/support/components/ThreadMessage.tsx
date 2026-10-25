import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { formatDate } from '@/lib/dates';
import type { TicketAttachmentDTO } from '@/types/api/support';
import { TicketAttachmentChips } from './TicketAttachmentChips';

export type ThreadMessageProps = {
  /** Who wrote it, as shown above the bubble. */
  author: string;
  message: string;
  createdAt: string;
  /** From the support side (staff) rather than from the person who opened the ticket. */
  fromStaff: boolean;
  /** Whose screen this is: the member (default) sees support on the left and themselves on the right; staff see the reverse. */
  perspective?: 'member' | 'staff';
  /** A staff-only note — tinted, and labelled, so it can't be mistaken for a reply the member will see. */
  internal?: boolean;
  attachments?: TicketAttachmentDTO[];
  testID?: string;
};

/** One chat bubble: your own messages on the right in the primary tint, the other side's on the left on the surface. */
export function ThreadMessage({ author, message, createdAt, fromStaff, perspective = 'member', internal = false, attachments, testID }: ThreadMessageProps) {
  const mine = perspective === 'staff' ? fromStaff : !fromStaff;

  return (
    <View testID={testID} className={mine ? 'items-end' : 'items-start'}>
      <View
        className={[
          'max-w-[88%] rounded-xl px-4 py-3',
          internal
            ? 'rounded-tr-sm border border-warning bg-warning-soft'
            : mine
              ? 'rounded-tr-sm bg-primary-soft'
              : 'rounded-tl-sm border border-border bg-surface dark:border-transparent',
        ].join(' ')}
      >
        <Text variant="caption" tone={internal ? 'warning' : mine ? 'onPrimarySoft' : 'secondary'}>
          {internal ? `${author} · internal note` : author}
        </Text>
        <Text variant="body" tone={mine && !internal ? 'onPrimarySoft' : 'default'} className="mt-0.5">
          {message}
        </Text>
        <TicketAttachmentChips attachments={attachments} />
        <Text variant="micro" tone="secondary" className="mt-1.5">
          {`${formatDate(createdAt, 'long')} · ${formatDate(createdAt, 'time')}`}
        </Text>
      </View>
    </View>
  );
}
