/**
 * A charge's category, with the real campaign, due, cause or penalty it is for underneath.
 * The category only says the kind ("Levy"); `purpose` says which one ("Levy For Emma Wedding").
 */
export function ChargeName({ name, purpose, className = '' }: { name?: string | null; purpose?: string | null; className?: string }) {
  return (
    <>
      <span className={className}>{name}</span>
      {purpose ? (
        <span className="block text-xs font-medium text-ink-soft" data-testid="charge-purpose">
          {purpose}
        </span>
      ) : null}
    </>
  );
}
