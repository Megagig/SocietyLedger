/**
 * Financial category rules. A category's type decides how its charges behave (dues, levy, donation, penalty), so it can't change
 * once any charge or levy campaign uses it. Changing the default amount only affects charges raised afterwards.
 */
export function categoryTypeChangeError(currentType: string, nextType: string | undefined, usage: { charges: number; campaigns: number }): string | null {
  if (nextType === undefined || nextType === currentType) return null;
  if (usage.charges + usage.campaigns === 0) return null;
  return `This category is already used by ${usage.charges} charge(s) and ${usage.campaigns} levy campaign(s), so it can't change from ${currentType} to ${nextType}. Create a new category instead.`;
}

/** Deactivating hides a category from new charges, so it is refused while charges for it are still owed. */
export function categoryDeactivateError(openCharges: number): string | null {
  return openCharges > 0 ? `Cannot deactivate a category with ${openCharges} pending transaction(s)` : null;
}
