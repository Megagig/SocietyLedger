import { View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { cn } from '@/lib/cn';
import { useThemeTokens } from '@/providers/ThemeProvider';

export type IconCircleTone = 'primary' | 'accent' | 'success' | 'warning' | 'info' | 'neutral';

const TONES: Record<IconCircleTone, { container: string; icon: 'primary' | 'accentText' | 'success' | 'warning' | 'info' | 'textSecondary' }> = {
  primary: { container: 'bg-primary-soft', icon: 'primary' },
  accent: { container: 'bg-accent-soft', icon: 'accentText' },
  success: { container: 'bg-success-soft', icon: 'success' },
  warning: { container: 'bg-warning-soft', icon: 'warning' },
  info: { container: 'bg-info-soft', icon: 'info' },
  neutral: { container: 'bg-surface-sunken', icon: 'textSecondary' },
};

export type IconCircleProps = {
  icon: LucideIcon;
  tone?: IconCircleTone;
};

/** ui-rules.md §5.3 — the pre-wrapped 36dp leading circle `ListItem` expects. */
export function IconCircle({ icon: Icon, tone = 'primary' }: IconCircleProps) {
  const { color } = useThemeTokens();
  const t = TONES[tone];
  return (
    <View className={cn('h-[36px] w-[36px] items-center justify-center rounded-full', t.container)}>
      <Icon size={18} color={color[t.icon]} strokeWidth={1.75} />
    </View>
  );
}
