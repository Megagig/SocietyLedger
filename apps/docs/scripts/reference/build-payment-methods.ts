/**
 * Builds the payment methods reference table.
 *
 * There is no single canonical `PaymentMethod` enum in the backend — the
 * value is validated inline per module. `finance.controller.ts`'s
 * `paymentMethodTypes`, `welfare.validation.ts`'s `paymentMethods`, and the
 * dashboard's `PAYMENT_METHOD_CONFIG` all agree on the same six lowercase
 * values, so that's the canonical set documented here. `PAYMENT_METHOD_CONFIG`
 * is read because it also carries the display name for each value.
 *
 * `member-finance.controller.ts` (the member self-service payment endpoint)
 * validates against a different, uppercase set with no `cheque`/`other` and
 * an extra `POS` value nothing else recognises — a real backend
 * inconsistency, not reconciled here. See the gap logged in
 * `progress-tracker.md`.
 */
import path from 'node:path';
import { parseTsConst } from './parse-ts-const';

const apiRoot = (...parts: string[]) => path.join(__dirname, '..', '..', '..', 'api', ...parts);

export interface PaymentMethodRow {
  value: string;
  name: string;
}

export function buildPaymentMethods(): PaymentMethodRow[] {
  const config = parseTsConst(
    apiRoot('src/modules/dashboard/dashboard.types.ts'),
    'PAYMENT_METHOD_CONFIG',
  ) as Record<string, { name: string; color: string }>;

  return Object.entries(config).map(([value, { name }]) => ({ value, name }));
}
