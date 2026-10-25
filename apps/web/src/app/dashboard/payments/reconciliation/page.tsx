import { redirect } from 'next/navigation';

/** The reconciliation screen lives under Nigerian payments; this older address goes there. */
export default function OldReconciliationPage() {
  redirect('/dashboard/payments/nigerian/reconciliation');
}
