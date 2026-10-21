import { Pressable } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { cn } from '@/lib/cn';
import { useThemeTokens } from '@/providers/ThemeProvider';

export type IconButtonVariant = 'default' | 'soft';

export type IconButtonProps = {
  icon: LucideIcon;
  onPress?: () => void;
  /** Required — IconButton has no visible text, so a11y must come from here (code-standards.md §12). */
  accessibilityLabel: string;
  variant?: IconButtonVariant;
  tone?: 'default' | 'secondary' | 'primary' | 'inverse' | 'danger';
  disabled?: boolean;
  testID?: string;
};

const CONTAINER_CLASSES: Record<IconButtonVariant, string> = {
  default: 'bg-transparent',
  soft: 'bg-surface-sunken',
};

export function IconButton({
  icon: Icon,
  onPress,
  accessibilityLabel,
  variant = 'default',
  tone = 'default',
  disabled = false,
  testID,
}: IconButtonProps) {
  const { color } = useThemeTokens();

  const resolvedColor = {
    default: color.text,
    secondary: color.textSecondary,
    primary: color.primary,
    inverse: color.textInverse,
    danger: color.danger,
  }[tone];

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      testID={testID}
      hitSlop={8}
      style={({ pressed }) => ({ transform: [{ scale: pressed && !disabled ? 0.97 : 1 }] })}
      className={cn('h-11 w-11 items-center justify-center rounded-full', CONTAINER_CLASSES[variant], disabled && 'opacity-40')}
    >
      <Icon size={20} color={resolvedColor} strokeWidth={1.75} />
    </Pressable>
  );
}
