'use client';

import { useState } from 'react';
import { Button } from '@mantine/core';
import { IconCheck, IconCopy } from '@tabler/icons-react';
import { useCoopBankAccounts } from '@/lib/coop/hooks';
import { CoopEmpty, CoopError, CoopLoading } from '@/components/coop/CoopStates';
import { PageHead } from '@/components/coop/PageHead';

function CopyNumber({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="subtle"
      size="xs"
      aria-label={copied ? 'Account number copied' : `Copy account number ${value}`}
      leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* Clipboard blocked: the number is still on screen to copy by hand. */
        }
      }}
    >
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}

/**
 * Cooperative Bank Accounts: where to pay your contributions and loan repayments. Read-only: officers manage the list. Only active accounts
 * are shown, and only what you need to make a transfer.
 */
export default function CooperativeBankAccountsPage() {
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const accounts = useCoopBankAccounts(applied);

  return (
    <div className="space-y-6">
      <PageHead title="Bank details" subtitle="The cooperative's bank accounts, for your payments." />

      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(search.trim());
        }}
      >
        <label className="sr-only" htmlFor="bank-search">Search for an account</label>
        <input
          id="bank-search"
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!e.target.value) setApplied('');
          }}
          placeholder="Search for an account"
          className="h-12 w-full rounded-lg border border-line-strong bg-surface px-4 text-ink focus:border-success focus:outline-none focus:ring-2 focus:ring-success-focus"
        />
      </form>

      {accounts.isLoading ? (
        <CoopLoading />
      ) : accounts.isError ? (
        <CoopError error={accounts.error} onRetry={() => accounts.refetch()} />
      ) : !accounts.data || accounts.data.length === 0 ? (
        <CoopEmpty title="No bank accounts to show" hint={applied ? 'Nothing matches that search.' : 'Your cooperative has not added a bank account yet. Ask an officer.'} />
      ) : (
        <div className="relative overflow-x-auto rounded-lg border border-line">
          <table aria-label="Cooperative bank accounts" className="w-full min-w-[40rem] text-sm">
            <thead className="bg-surface-muted text-left text-ink-muted">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">S/N</th>
                <th scope="col" className="px-4 py-2 font-medium">Description</th>
                <th scope="col" className="px-4 py-2 font-medium">Account name</th>
                <th scope="col" className="px-4 py-2 font-medium">Account number</th>
                <th scope="col" className="px-4 py-2 font-medium">Bank name</th>
              </tr>
            </thead>
            <tbody>
              {accounts.data.map((a, i) => (
                <tr key={a.id} className="border-t border-line-soft">
                  <td className="px-4 py-2">{i + 1}</td>
                  <td className="px-4 py-2">{a.description || '—'}</td>
                  <td className="px-4 py-2 font-medium text-ink">{a.accountName}</td>
                  <td className="px-4 py-2">
                    <span className="font-mono tabular-nums">{a.accountNumber}</span> <CopyNumber value={a.accountNumber} />
                  </td>
                  <td className="px-4 py-2">{a.bankName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
