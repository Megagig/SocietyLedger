import { useState } from 'react';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { SearchField } from '@/components/forms/SearchField';
import { FilterChip } from '@/components/ui/FilterChip';
import { Button } from '@/components/ui/Button';
import { useCan } from '@/hooks/useCan';
import type { CollectionExportParams, CollectionScreen, SettlementFilter } from '@/types/api/collections';
import { EXPORT_ACCESS, shareCollection } from '../queries';
import { SETTLEMENT_OPTIONS } from '../labels';

type Props = {
  screen: CollectionScreen;
  id?: number;
  allocationId?: number;
  search: string;
  onSearch: (value: string) => void;
  status: SettlementFilter;
  onStatus: (value: SettlementFilter) => void;
  options?: { value: SettlementFilter; label: string }[];
  placeholder?: string;
};

/**
 * Search, the paid / yet-to-pay choice and the Excel and PDF buttons, the same on every "who has paid" screen. The export asks the server
 * for exactly this filter and search, so a "yet to pay" file holds only the people who still owe, and all of them.
 */
export function CollectionBar({ screen, id, allocationId, search, onSearch, status, onStatus, options = SETTLEMENT_OPTIONS, placeholder = 'Search name or member number' }: Props) {
  const canExport = useCan(EXPORT_ACCESS);
  const [busy, setBusy] = useState<'xlsx' | 'pdf' | null>(null);

  const exportAs = async (format: 'xlsx' | 'pdf') => {
    const params: CollectionExportParams = { screen, format, status, search: search || undefined, id, allocationId };
    setBusy(format);
    try {
      await shareCollection(params);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create the file. Try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <View className="gap-3">
      <SearchField value={search} onChangeText={onSearch} placeholder={placeholder} testID="collection-search" />
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => (
          <FilterChip key={option.value} label={option.label} active={status === option.value} onPress={() => onStatus(option.value)} />
        ))}
      </View>
      {canExport ? (
        <View className="flex-row gap-2">
          <Button variant="secondary" size="sm" loading={busy === 'xlsx'} disabled={busy !== null} onPress={() => void exportAs('xlsx')} testID="collection-excel">
            Excel
          </Button>
          <Button variant="secondary" size="sm" loading={busy === 'pdf'} disabled={busy !== null} onPress={() => void exportAs('pdf')} testID="collection-pdf">
            PDF
          </Button>
        </View>
      ) : null}
    </View>
  );
}
