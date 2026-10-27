import { View } from 'react-native';
import { Building2, CreditCard, Lock, ShieldAlert, Users, type LucideIcon } from 'lucide-react-native';
import { accessCopy, type AccessProblemKind } from '@societyledger/shared';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';

const ICONS: Record<AccessProblemKind, LucideIcon> = {
  permission: ShieldAlert,
  plan: Lock,
  subscription: CreditCard,
  suspended: Building2,
  cancelled: Building2,
  limit: Users,
  association: Building2,
};

export type AccessStateProps = {
  kind: AccessProblemKind;
  /** For a plan that does not include a module: its name, e.g. "Meetings". Without it the copy says "This feature". */
  moduleName?: string;
  /** Shows "Check again" for the kinds an administrator can fix (plan, subscription, limit). Never a purchase action: ui-rules.md rule #16. */
  onRetry?: () => void;
  /** An extra action under the message, for example "Go home". */
  action?: { label: string; onPress: () => void };
};

/**
 * ui-rules.md §5.11 — what a person sees when they are refused because of their role or what their association has paid for,
 * instead of a generic "couldn't load this". The wording is shared with the web (`@societyledger/shared`), names who can fix it,
 * and never mentions prices or offers a way to buy (the app may not sell subscriptions).
 */
export function AccessState({ kind, moduleName, onRetry, action }: AccessStateProps) {
  const { color } = useThemeTokens();
  const copy = accessCopy(kind, { moduleName });
  const Icon = ICONS[kind];
  const canCheckAgain = onRetry && (kind === 'plan' || kind === 'subscription' || kind === 'limit');

  return (
    <View className="items-center gap-3 px-8 py-12" accessibilityRole="summary" testID={`access-state-${kind}`}>
      <Icon size={48} color={color.textTertiary} strokeWidth={1.5} />
      <Text variant="h3" align="center">
        {copy.title}
      </Text>
      <Text variant="body" tone="secondary" align="center">
        {copy.description}
      </Text>
      {canCheckAgain ? (
        <Button variant="secondary" onPress={onRetry}>
          Check again
        </Button>
      ) : null}
      {action ? (
        <Button variant="primary" onPress={action.onPress}>
          {action.label}
        </Button>
      ) : null}
    </View>
  );
}
