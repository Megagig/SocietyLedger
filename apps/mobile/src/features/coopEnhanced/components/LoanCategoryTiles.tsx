import { View } from 'react-native';

import { useCoopDashboardV2 } from '../queries';
import { CoopTile } from './CoopTile';

/**
 * Loans collected and still owed, for every loan category the cooperative offers (Normal, Commodity, or whatever its officers created).
 * Nothing is fixed: a new category appears on its own. It shows nothing while loading or if it can't load, because the loans themselves
 * are listed below it and a missing summary must not hide them.
 */
export function LoanCategoryTiles() {
  const dashboard = useCoopDashboardV2();
  const tiles = dashboard.data?.loanTiles ?? [];
  if (tiles.length === 0) return null;

  const cells = tiles.flatMap((t) => [
    { key: `c${t.loanCategoryId}`, label: `${t.name} collected`, value: t.totalCollected, tone: 'info' as const, hint: undefined },
    { key: `o${t.loanCategoryId}`, label: `${t.name} outstanding`, value: t.outstanding, tone: (Number(t.outstanding) > 0 ? 'danger' : 'neutral') as 'danger' | 'neutral', hint: t.activeLoans > 0 ? `${t.activeLoans} active` : undefined },
  ]);
  const rows: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += 2) rows.push(cells.slice(i, i + 2));

  return (
    <View className="gap-3" accessibilityLabel="Your loans by category">
      {rows.map((row) => (
        <View key={row.map((c) => c.key).join('-')} className="flex-row gap-3">
          {row.map((c) => (
            <CoopTile key={c.key} label={c.label} value={c.value} tone={c.tone} hint={c.hint} />
          ))}
          {row.length === 1 ? <View className="flex-1" /> : null}
        </View>
      ))}
    </View>
  );
}
