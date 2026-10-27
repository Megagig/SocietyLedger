import { AccessState } from '@/components/feedback/AccessState';

/** ui-rules.md §5.11 — explains the state + admin guidance; read-only cached data still shown where available (the caller's job, not this component's). */
export function SubscriptionInactive() {
  return <AccessState kind="subscription" />;
}
