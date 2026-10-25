import { redirect } from 'next/navigation';

/** Statement import lives under Nigerian payments; this older address goes there. */
export default function OldImportPage() {
  redirect('/dashboard/payments/nigerian/statements');
}
