'use client';

import { useCoopDashboard } from '@/lib/coop/hooks';
import { CoopLoading } from './CoopStates';
import { StatTile } from './StatTile';

/**
 * Loans collected and still owed, for every loan category the cooperative offers (Normal, Commodity, or whatever its officers have set up).
 * Nothing here is fixed: a new category shows up on its own the day an officer creates it. A failed load shows nothing, because the loans
 * themselves are listed below it and a missing summary must not hide them.
 */
export function LoanTiles() {
  const dashboard = useCoopDashboard();
  if (dashboard.isLoading) return <CoopLoading rows={1} height={96} />;
  const tiles = dashboard.data?.loanTiles ?? [];
  if (tiles.length === 0) return null;

  return (
    <section aria-label="Your loans by category" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.flatMap((tile) => [
        <StatTile key={`c${tile.loanCategoryId}`} label={`${tile.name} collected`} value={tile.totalCollected} tone="info" />,
        <StatTile key={`o${tile.loanCategoryId}`} label={`${tile.name} outstanding`} value={tile.outstanding} tone={Number(tile.outstanding) > 0 ? 'danger' : 'neutral'} hint={tile.activeLoans > 0 ? `${tile.activeLoans} active` : undefined} />,
      ])}
    </section>
  );
}
