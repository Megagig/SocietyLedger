import type { PricingAddon } from '@/types/pricing';

/** The optional add-ons on offer, with their prices, straight from the published catalog. Shown only when there is at least one. */
export function AddonList({ addons, planNames }: { addons: PricingAddon[]; planNames?: Record<string, string> }) {
  if (addons.length === 0) return null;
  return (
    <section aria-labelledby="addons-heading" className="mt-16">
      <h2 id="addons-heading" className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-2">
        Add-ons
      </h2>
      <p className="text-center text-gray-600 dark:text-gray-300 mb-8">Extras you can add to your plan at any time. They renew together with your plan.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {addons.map((addon) => (
          <div key={addon.id} className="glass-strong p-6 rounded-2xl border border-gray-200/50 dark:border-gray-700/50">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{addon.name}</h3>
            {addon.description && <p className="mt-1 text-gray-600 dark:text-gray-300">{addon.description}</p>}
            <p className="mt-4 text-gray-900 dark:text-white">
              <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">{addon.prices.monthly}</span>
              <span className="text-gray-600 dark:text-gray-400">/month</span>
              <span className="mx-2 text-gray-400">or</span>
              <span className="text-xl font-semibold text-primary-600 dark:text-primary-400">{addon.prices.annual}</span>
              <span className="text-gray-600 dark:text-gray-400">/year</span>
            </p>
            {addon.eligiblePlanCodes.length > 0 && (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Available on: {addon.eligiblePlanCodes.map((c) => planNames?.[c] ?? c).join(', ')}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
