import { redirect } from 'next/navigation';

/** Bank transfers live in one place: Payments → Bank transfers. This older address now points there. */
export default function NigerianTransfersRedirect() {
  redirect('/dashboard/payments/bank-transfers');
}
