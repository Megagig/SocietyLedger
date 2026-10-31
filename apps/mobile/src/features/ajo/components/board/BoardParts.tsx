import { Check, CalendarClock, Circle, Clock, Minus, Search, TriangleAlert, X, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/cn';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { PaymentStatus } from '@/types/api/ajoBoard';
import { shortDay } from '../../boardFormat';

type Tone = { container: string; text: 'success' | 'accentText' | 'info' | 'secondary' | 'warning' | 'danger' | 'primary'; icon: LucideIcon; iconColor: 'success' | 'accentText' | 'info' | 'textSecondary' | 'warning' | 'danger' | 'primary' };

/**
 * The one place that turns a board status into words, an icon and a tone (spec §16.3). A status is always text plus an icon, never
 * colour alone, so it stays readable for colour-blind people. Same words as the web.
 */
const TONES: Record<PaymentStatus, Tone> = {
  PAID_ON_TIME: { container: 'bg-success-soft', text: 'success', icon: Check, iconColor: 'success' },
  PAID_LATE: { container: 'bg-accent-soft', text: 'accentText', icon: Check, iconColor: 'accentText' },
  REPORTED: { container: 'bg-info-soft', text: 'info', icon: Clock, iconColor: 'info' },
  DUE: { container: 'bg-surface-sunken', text: 'secondary', icon: Circle, iconColor: 'textSecondary' },
  OVERDUE: { container: 'bg-warning-soft', text: 'warning', icon: TriangleAlert, iconColor: 'warning' },
  MISSED: { container: 'bg-danger-soft', text: 'danger', icon: X, iconColor: 'danger' },
  UNDER_REVIEW: { container: 'bg-primary-soft', text: 'primary', icon: Search, iconColor: 'primary' },
  WAIVED: { container: 'bg-surface-sunken', text: 'secondary', icon: Minus, iconColor: 'textSecondary' },
  UPCOMING: { container: 'bg-surface-sunken', text: 'secondary', icon: CalendarClock, iconColor: 'textSecondary' },
};

export function StatusPill({ status, label, graceEndsOn, testID }: { status: PaymentStatus; label: string; graceEndsOn?: string | null; testID?: string }) {
  const { color } = useThemeTokens();
  const tone = TONES[status];
  const Glyph = tone.icon;
  return (
    <View testID={testID} accessibilityLabel={status === 'OVERDUE' && graceEndsOn ? `${label}, grace until ${shortDay(graceEndsOn)}` : label} className={cn('h-6 flex-row items-center gap-1 self-start rounded-sm px-2', tone.container)}>
      <Glyph size={12} color={color[tone.iconColor]} strokeWidth={2.25} />
      <Text variant="micro" tone={tone.text}>
        {label}
        {status === 'OVERDUE' && graceEndsOn ? ` · grace until ${shortDay(graceEndsOn)}` : ''}
      </Text>
    </View>
  );
}

/** One square of the payment history: the icon alone, with the status as its accessible name. */
export function StatusSquare({ status, label, active, onPress }: { status: PaymentStatus; label: string; active?: boolean; onPress?: () => void }) {
  const { color } = useThemeTokens();
  const tone = TONES[status];
  const Glyph = tone.icon;
  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      onTouchEnd={onPress}
      className={cn('h-8 w-8 items-center justify-center rounded-sm border', tone.container, active ? 'border-primary' : 'border-transparent')}
    >
      <Glyph size={14} color={color[tone.iconColor]} strokeWidth={2.25} />
    </View>
  );
}

export function BoardCard({ title, children, testID }: { title?: string; children: ReactNode; testID?: string }) {
  return (
    <Card testID={testID}>
      <View className="gap-2">
        {title ? <Text variant="h3">{title}</Text> : null}
        {children}
      </View>
    </Card>
  );
}

/** A label and its figure, side by side. */
export function FactRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text variant="body" tone="secondary" className="flex-1">
        {label}
      </Text>
      {children}
    </View>
  );
}
