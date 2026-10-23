import { redirect } from 'next/navigation';

/** Recording a transfer lives in one place: Payments → Bank transfers → Record. This older address now points there. */
export default function NigerianNewTransferRedirect() {
  redirect('/dashboard/payments/bank-transfers/new');
}
