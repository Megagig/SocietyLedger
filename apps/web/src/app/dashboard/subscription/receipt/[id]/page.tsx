'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { subscriptionsApi, type PaymentReceipt } from '@/lib/api/subscriptions';
import { formatKobo } from '@/lib/pricing';

const date = (iso: string) => new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });
const purposeLabel = (purpose: string) => (purpose === 'ADDON' ? 'Add-on' : purpose === 'PLAN_CHANGE' ? 'Plan change' : 'Subscription');

export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    subscriptionsApi
      .receipt(Number(id))
      .then(setReceipt)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load the receipt'));
  }, [id]);

  if (error) return <div className="max-w-2xl mx-auto p-6 text-red-600 dark:text-red-400">{error}</div>;
  if (!receipt) return <div className="max-w-2xl mx-auto p-6 text-gray-600 dark:text-gray-400">Loading receipt...</div>;

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 sm:p-8 print:shadow-none">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Receipt</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{receipt.receiptNumber}</p>
          </div>
          <div className="text-right text-sm text-gray-600 dark:text-gray-300">
            <div className="font-medium text-gray-900 dark:text-white">SocietyLedger</div>
            <div>Paid on {date(receipt.paidAt)}</div>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-y-2 text-sm mb-6">
          <dt className="text-gray-500 dark:text-gray-400">Billed to</dt>
          <dd className="text-gray-900 dark:text-white text-right">{receipt.association}</dd>
          <dt className="text-gray-500 dark:text-gray-400">For</dt>
          <dd className="text-gray-900 dark:text-white text-right">
            {purposeLabel(receipt.purpose)}
            {receipt.planName ? ` · ${receipt.planName}` : ''}
            {receipt.billingCycle ? ` (${receipt.billingCycle === 'ANNUAL' ? 'annual' : 'monthly'})` : ''}
          </dd>
          {receipt.periodEndsAt && (
            <>
              <dt className="text-gray-500 dark:text-gray-400">Paid until</dt>
              <dd className="text-gray-900 dark:text-white text-right">{date(receipt.periodEndsAt)}</dd>
            </>
          )}
          {receipt.reference && (
            <>
              <dt className="text-gray-500 dark:text-gray-400">Payment reference</dt>
              <dd className="text-gray-900 dark:text-white text-right break-all">{receipt.reference}</dd>
            </>
          )}
        </dl>

        {receipt.lines.length > 0 && (
          <ul className="border-t border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 mb-4">
            {receipt.lines.map((line, i) => (
              <li key={i} className="flex justify-between py-2 text-sm">
                <span className="text-gray-700 dark:text-gray-300">{line.label}</span>
                <span className="text-gray-900 dark:text-white">{formatKobo(line.amountKobo)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-between border-t border-gray-300 dark:border-gray-600 pt-4 text-lg font-bold text-gray-900 dark:text-white">
          <span>Total paid</span>
          <span>{formatKobo(receipt.totalKobo)}</span>
        </div>

        <button onClick={() => window.print()} className="mt-6 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 print:hidden">
          Print or save as PDF
        </button>
      </div>
    </div>
  );
}
