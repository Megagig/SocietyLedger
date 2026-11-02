import { redirect } from 'next/navigation';

/** The old single-account deposits queue. Deposits are payment requests now, so bookmarks and old links land on the new queue. */
export default function SavingsDepositsRedirect() {
  redirect('/dashboard/cooperatives/payment-requests');
}
