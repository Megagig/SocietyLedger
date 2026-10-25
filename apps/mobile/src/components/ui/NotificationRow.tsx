import { Pressable, View } from 'react-native';
import { Bell, Check, CheckCircle2, CreditCard, Info, Megaphone, UserCheck, type LucideIcon } from 'lucide-react-native';
import { formatDistanceToNow } from 'date-fns';

import { cn } from '@/lib/cn';
import { useThemeTokens } from '@/providers/ThemeProvider';
import { Text } from './Text';

type KindStyle = { icon: LucideIcon; tint: string; iconColor: 'warning' | 'success' | 'info' | 'primary' | 'accentText' | 'textSecondary' };

// Mirrors the web's per-type icon + tint (payment_due amber, received green, system blue, approval purple, announcement orange).
const KIND_STYLES: Record<string, KindStyle> = {
  payment_due: { icon: CreditCard, tint: 'bg-warning-soft', iconColor: 'warning' },
  payment_received: { icon: CheckCircle2, tint: 'bg-success-soft', iconColor: 'success' },
  system: { icon: Info, tint: 'bg-info-soft', iconColor: 'info' },
  approval: { icon: UserCheck, tint: 'bg-primary-soft', iconColor: 'primary' },
  announcement: { icon: Megaphone, tint: 'bg-accent-soft', iconColor: 'accentText' },
};
const FALLBACK_STYLE: KindStyle = { icon: Bell, tint: 'bg-surface-sunken', iconColor: 'textSecondary' };

export type NotificationRowProps = {
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  /** Stored `Notification.type` kind — drives the leading icon and tint. */
  type?: string;
  /** When true the leading icon becomes a checkbox (inbox selection mode). */
  selectionMode?: boolean;
  selected?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
};

/** ui-registry.md — Notification inbox row: type icon, title, message, relative time, unread dot, selectable. */
export function NotificationRow({
  title,
  message,
  createdAt,
  isRead,
  type,
  selectionMode = false,
  selected = false,
  onPress,
  onLongPress,
}: NotificationRowProps) {
  const { color } = useThemeTokens();
  const style = (type && KIND_STYLES[type]) || FALLBACK_STYLE;
  const Icon = style.icon;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole={selectionMode ? 'checkbox' : 'button'}
      accessibilityState={selectionMode ? { checked: selected } : undefined}
      className={cn('flex-row items-start gap-3 px-4 py-3', (selected || !isRead) && 'bg-primary-soft')}
    >
      {selectionMode ? (
        <View className="h-10 w-10 items-center justify-center">
          <View
            className={cn(
              'h-5 w-5 items-center justify-center rounded-xs border',
              selected ? 'border-primary bg-primary' : 'border-border-strong bg-surface',
            )}
          >
            {selected ? <Check size={14} color={color.textInverse} strokeWidth={2.5} /> : null}
          </View>
        </View>
      ) : (
        <View className={cn('h-10 w-10 items-center justify-center rounded-lg', style.tint)}>
          <Icon size={20} color={color[style.iconColor]} strokeWidth={1.75} />
        </View>
      )}
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <Text variant={isRead ? 'body' : 'body-strong'} numberOfLines={1} className="flex-1">
            {title}
          </Text>
          {!isRead && <View className="size-2 rounded-full bg-primary" />}
        </View>
        <Text variant="body" tone="secondary" numberOfLines={2}>
          {message}
        </Text>
        <Text variant="caption" tone="tertiary">
          {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
        </Text>
      </View>
    </Pressable>
  );
}
