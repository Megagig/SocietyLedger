'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@mantine/core';
import { IconDownload, IconSearch } from '@tabler/icons-react';
import { StatusTabs } from '@/components/coop/StatusTabs';
import { downloadCollection, exportErrorMessage, type CollectionScreen, type SettlementFilter } from '@/lib/finance/collections';
import { toast } from '@/lib/toast';

interface Props {
  screen: CollectionScreen;
  /** The campaign (levy) this list belongs to; other screens leave it out. */
  id?: number;
  allocationId?: number;
  search: string;
  onSearch: (value: string) => void;
  status: SettlementFilter;
  onStatus: (value: SettlementFilter) => void;
  tabs: Array<{ value: SettlementFilter; label: string }>;
  placeholder?: string;
  /** Label for the strip of tabs, for screen readers. */
  tabsLabel?: string;
  /** How many tabs there are, for the phone grid. */
  columns?: string;
}

/**
 * Search, the paid / yet-to-pay filter and the Excel and PDF buttons, the same on every "who has paid" screen. The export asks the server for
 * exactly this filter and search, so a "yet to pay" file holds only the people who still owe, and all of them, not just the page on screen.
 */
export function CollectionToolbar({ screen, id, allocationId, search, onSearch, status, onStatus, tabs, placeholder = 'Search by name or member number', tabsLabel = 'Who has paid', columns = 'grid-cols-3 sm:inline-flex' }: Props) {
  const [text, setText] = useState(search);
  const [busy, setBusy] = useState<'xlsx' | 'pdf' | null>(null);

  // Wait for a pause in typing before searching, so a long list is not re-asked on every key. The callback is read through a ref so a parent
  // that passes a new function on every render cannot restart the wait; nothing is sent when the text already matches the current search.
  const latest = useRef(onSearch);
  latest.current = onSearch;
  useEffect(() => {
    if (text.trim() === search) return;
    const handle = setTimeout(() => latest.current(text.trim()), 300);
    return () => clearTimeout(handle);
  }, [text, search]);

  const exportAs = async (format: 'xlsx' | 'pdf') => {
    setBusy(format);
    try {
      await downloadCollection({ screen, format, status, search: search || undefined, id, allocationId });
    } catch (error) {
      toast.error(await exportErrorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative block min-w-[12rem] flex-1">
          <span className="sr-only">Search members</span>
          <IconSearch size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            className="h-11 w-full rounded-md border border-line-strong bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-ink-muted focus:border-success focus:outline-none focus:ring-2 focus:ring-success-focus"
          />
        </label>
        <div className="flex gap-2">
          <Button variant="default" leftSection={<IconDownload size={16} />} loading={busy === 'xlsx'} disabled={busy !== null} onClick={() => exportAs('xlsx')}>
            Excel
          </Button>
          <Button variant="default" leftSection={<IconDownload size={16} />} loading={busy === 'pdf'} disabled={busy !== null} onClick={() => exportAs('pdf')}>
            PDF
          </Button>
        </div>
      </div>
      <StatusTabs label={tabsLabel} tabs={tabs} value={status} onChange={onStatus} columns={columns} />
    </div>
  );
}
