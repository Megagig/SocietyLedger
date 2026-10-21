import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { Banknote, FileText, FileUp, HandCoins, LifeBuoy, PiggyBank, type LucideIcon } from 'lucide-react-native';
import { router } from 'expo-router';
import { toast } from 'sonner-native';

import { Text } from '@/components/ui/Text';
import { t, type TranslationKey } from '@/lib/i18n';
import { can, canAny, type PermissionAlias } from '@/lib/permissions';
import { useThemeTokens } from '@/providers/ThemeProvider';
import { useSessionStore } from '@/stores/session';

type QuickAction = {
  key: string;
  icon: LucideIcon;
  label: string;
  /** Omitted = visible to every member (e.g. Support) — never gated on an empty alias list. */
  permission?: PermissionAlias | PermissionAlias[];
  /** When set, pressing this tile navigates instead of showing a coming-soon toast. */
  route?: string;
  comingSoonKey: TranslationKey;
};

// F2.8/F2.9 done: pay, uploadProof, and statement now navigate to real screens.
// Savings, loans, and support are still genuinely unbuilt (F4.x) — kept as toasts.
const ACTIONS: QuickAction[] = [
  {
    key: 'pay',
    icon: Banknote,
    label: t('home.quickActions.pay'),
    permission: ['MEMBER_FINANCE_VIEW', 'LEDGER_VIEW', 'LEDGER_VIEW_ALL'],
    route: '/(app)/(tabs)/money',
    comingSoonKey: 'home.quickActions.payComingSoon',
  },
  {
    key: 'uploadProof',
    icon: FileUp,
    label: t('home.quickActions.uploadProof'),
    permission: ['MEMBER_FINANCE_VIEW', 'LEDGER_VIEW', 'LEDGER_VIEW_ALL'],
    route: '/(app)/(tabs)/money/levies',
    comingSoonKey: 'home.quickActions.uploadProofComingSoon',
  },
  {
    key: 'statement',
    icon: FileText,
    label: t('home.quickActions.statement'),
    permission: ['MEMBER_FINANCE_VIEW', 'LEDGER_VIEW', 'LEDGER_VIEW_ALL'],
    route: '/money/ledger/statement',
    comingSoonKey: 'home.quickActions.statementComingSoon',
  },
  {
    key: 'savings',
    icon: PiggyBank,
    label: t('home.quickActions.savings'),
    permission: 'COOPERATIVE_SAVINGS_VIEW',
    comingSoonKey: 'home.quickActions.savingsComingSoon',
  },
  {
    key: 'applyLoan',
    icon: HandCoins,
    label: t('home.quickActions.applyLoan'),
    permission: 'COOPERATIVE_LOANS_APPLY',
    comingSoonKey: 'home.quickActions.applyLoanComingSoon',
  },
  { key: 'support', icon: LifeBuoy, label: t('home.quickActions.support'), comingSoonKey: 'home.quickActions.supportComingSoon' },
];

const COLUMNS = 3;
const GAP = 12;

// Stable reference — see useCan's own note: `?? []` would allocate per call and break
// useSyncExternalStore's referential-stability requirement.
const EMPTY_PERMISSIONS: string[] = [];

/**
 * ui-rules.md §5.4 — "3-column grid, tile = icon in primary-soft tile + caption label, max 6
 * tiles."
 *
 * Laid out as explicit rows of three with each cell `flex: 1`, rather than a wrapping container
 * of percentage-width tiles. Percentage widths do not resolve reliably for these children — they
 * were silently ignored, letting the tiles size to content and pack five to a row — and adding a
 * `gap` on a wrapping container pushes the track past 100% so the last tile drops to its own row.
 * Equal-flex cells inside a fixed row avoid both failure modes.
 *
 * Permissions are resolved from the session store once here instead of a `useCan` per tile, so
 * the visible set is known before layout; a hook per tile would have to run inside the row map.
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
          {/* Keeps the final row's tiles the same width as a full row's instead of stretching. */}
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

  return (
    <Pressable
      onPress={() => action.route ? router.push(action.route as never) : toast(t(action.comingSoonKey))}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      testID={`quick-action-${action.key}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
    >
      {/* Column layout, and the label never gets `flex: 1` — inside a row that sizes it to zero
       * and the text disappears. `minHeight` keeps one- and two-line labels the same tile height. */}
      <View
        style={{
          alignItems: 'center',
          paddingVertical: 16,
          paddingHorizontal: 6,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: color.border,
          backgroundColor: color.surfaceRaised,
        }}
      >
        <View
          style={{
            height: 46,
            width: 46,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 15,
            backgroundColor: color.primarySoft,
          }}
        >
          <action.icon size={23} color={color.primary} strokeWidth={1.9} />
        </View>
        <Text variant="caption" align="center" numberOfLines={2} style={{ marginTop: 10, minHeight: 32 }}>
          {action.label}
        </Text>
      </View>
    </Pressable>
  );
}
