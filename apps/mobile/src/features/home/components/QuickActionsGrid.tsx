import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { Banknote, FileText, FileUp, HandCoins, LifeBuoy, PiggyBank, type LucideIcon } from 'lucide-react-native';
import { router } from 'expo-router';
import { toast } from 'sonner-native';

import { Text } from '@/components/ui/Text';
import { t, type TranslationKey } from '@/lib/i18n';
import { can, canAny, COOPERATIVE_LOANS_APPLY_ACCESS, COOPERATIVE_SAVINGS_VIEW_ACCESS, type PermissionAlias } from '@/lib/permissions';
import { useThemeTokens } from '@/providers/ThemeProvider';
import { useSessionStore } from '@/stores/session';
import type { ColorToken } from '@/theme/tokens';

type QuickAction = {
  key: string;
  icon: LucideIcon;
  label: string;
  permission?: PermissionAlias | PermissionAlias[];
  route?: string;
  comingSoonKey: TranslationKey;
  /** Token name for the icon background — e.g. 'successSoft'. */
  iconBgToken: ColorToken;
  /** Token name for the icon color. */
  iconColorToken: ColorToken;
};

const ACTIONS: QuickAction[] = [
  {
    key: 'pay',
    icon: Banknote,
    label: t('home.quickActions.pay'),
    permission: ['MEMBER_FINANCE_VIEW', 'LEDGER_VIEW', 'LEDGER_VIEW_ALL'],
    route: '/(app)/(tabs)/money',
    comingSoonKey: 'home.quickActions.payComingSoon',
    iconBgToken: 'successSoft',
    iconColorToken: 'success',
  },
  {
    key: 'uploadProof',
    icon: FileUp,
    label: t('home.quickActions.uploadProof'),
    permission: ['MEMBER_FINANCE_VIEW', 'LEDGER_VIEW', 'LEDGER_VIEW_ALL'],
    route: '/(app)/(tabs)/money/levies',
    comingSoonKey: 'home.quickActions.uploadProofComingSoon',
    iconBgToken: 'infoSoft',
    iconColorToken: 'info',
  },
  {
    key: 'statement',
    icon: FileText,
    label: t('home.quickActions.statement'),
    permission: ['MEMBER_FINANCE_VIEW', 'LEDGER_VIEW', 'LEDGER_VIEW_ALL'],
    route: '/money/ledger/statement',
    comingSoonKey: 'home.quickActions.statementComingSoon',
    iconBgToken: 'accentSoft',
    iconColorToken: 'accent',
  },
  {
    key: 'savings',
    icon: PiggyBank,
    label: t('home.quickActions.savings'),
    permission: COOPERATIVE_SAVINGS_VIEW_ACCESS,
    route: '/money/savings',
    comingSoonKey: 'home.quickActions.savingsComingSoon',
    iconBgToken: 'warningSoft',
    iconColorToken: 'warning',
  },
  {
    key: 'applyLoan',
    icon: HandCoins,
    label: t('home.quickActions.applyLoan'),
    permission: COOPERATIVE_LOANS_APPLY_ACCESS,
    route: '/money/loans/apply',
    comingSoonKey: 'home.quickActions.applyLoanComingSoon',
    iconBgToken: 'primarySoft',
    iconColorToken: 'primary',
  },
  {
    key: 'support',
    icon: LifeBuoy,
    label: t('home.quickActions.support'),
    comingSoonKey: 'home.quickActions.supportComingSoon',
    iconBgToken: 'dangerSoft',
    iconColorToken: 'danger',
  },
];

const COLUMNS = 3;
const GAP = 10;

const EMPTY_PERMISSIONS: string[] = [];

/**
 * ui-rules.md §5.4 — "3-column grid, tile = icon in primary-soft tile + caption label, max 6
 * tiles." Each tile gets its own color scheme via `iconBgToken`/`iconColorToken` so the grid
 * reads as a palette rather than a monochrome block.
 */
export function QuickActionsGrid() {
  const permissions = useSessionStore((state) => state.user?.permissions ?? EMPTY_PERMISSIONS);

  const rows = useMemo(() => {
    const visible = ACTIONS.filter((action) => {
      if (!action.permission) return true;
      return Array.isArray(action.permission) ? canAny(permissions, action.permission) : can(permissions, action.permission);
    });

    return Array.from({ length: Math.ceil(visible.length / COLUMNS) }, (_, index) =>
      visible.slice(index * COLUMNS, index * COLUMNS + COLUMNS),
    );
  }, [permissions]);

  return (
    <View style={{ gap: GAP }}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={{ flexDirection: 'row', gap: GAP }}>
          {row.map((action) => (
            <View key={action.key} style={{ flex: 1 }}>
              <QuickActionTile action={action} />
            </View>
          ))}
          {Array.from({ length: COLUMNS - row.length }, (_, index) => (
            <View key={`filler-${index}`} style={{ flex: 1 }} />
          ))}
        </View>
      ))}
    </View>
  );
}

function QuickActionTile({ action }: { action: QuickAction }) {
  const { color } = useThemeTokens();

  const iconBg = color[action.iconBgToken];
  const iconColor = color[action.iconColorToken];

  return (
    <Pressable
      onPress={() => action.route ? router.push(action.route as never) : toast(t(action.comingSoonKey))}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      testID={`quick-action-${action.key}`}
      style={({ pressed }) => ({
        opacity: pressed ? 0.72 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <View
        style={{
          alignItems: 'center',
          paddingVertical: 18,
          paddingHorizontal: 6,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: color.border,
          backgroundColor: color.surfaceRaised,
          // Subtle shadow to lift the tile
          shadowColor: color.overlay,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 6,
          shadowOpacity: 0.05,
          elevation: 2,
        }}
      >
        <View
          style={{
            height: 50,
            width: 50,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 16,
            backgroundColor: iconBg,
          }}
        >
          <action.icon size={24} color={iconColor} strokeWidth={1.8} />
        </View>
        <Text
          variant="caption"
          align="center"
          numberOfLines={2}
          style={{ marginTop: 10, minHeight: 30, color: color.text }}
        >
          {action.label}
        </Text>
      </View>
    </Pressable>
  );
}
