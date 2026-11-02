import * as Clipboard from 'expo-clipboard';
import { Landmark } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { SearchField } from '@/components/forms/SearchField';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { OwnPage } from '@/features/coopEnhanced/components/OwnPage';
import { useCoopBankAccounts } from '@/features/coopEnhanced/queries';
import { COOPERATIVE_OWN_PAGES_ACCESS } from '@/lib/permissions';

/**
 * Cooperative Bank Accounts: where to pay your contributions and loan repayments. Read-only (officers manage the list), only active
 * accounts, and only what you need to make a transfer. Tap Copy to copy an account number.
 */
export default function CooperativeBankAccountsScreen() {
  const [search, setSearch] = useState('');
  const query = useCoopBankAccounts(search.trim());

  const copy = async (accountNumber: string) => {
    try {
      await Clipboard.setStringAsync(accountNumber);
      toast.success('Account number copied');
    } catch {
      toast.error('Could not copy the account number.');
    }
  };

  return (
    <OwnPage
      title="Bank details"
      subject="bank details"
      access={COOPERATIVE_OWN_PAGES_ACCESS}
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
    >
      <View className="gap-4 pb-8">
        <Text variant="body" tone="secondary">
          The cooperative&apos;s bank accounts, for your payments.
        </Text>
        <SearchField value={search} onChangeText={setSearch} placeholder="Search for an account" testID="bank-search" />

        {query.isPending ? (
          <Skeleton width="100%" height={120} radius="lg" />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : (query.data ?? []).length === 0 ? (
          <EmptyState icon={Landmark} title="No bank accounts to show" description={search ? 'Nothing matches that search.' : 'Your cooperative has not added a bank account yet. Ask an officer.'} />
        ) : (
          <View className="gap-3">
            {query.data?.map((a, i) => (
              <Card key={a.id}>
                <Text variant="caption" tone="secondary">{`${i + 1}${a.description ? ` · ${a.description}` : ''}`}</Text>
                <Text variant="body-lg" className="mt-1">{a.accountName}</Text>
                <Text variant="body" tone="secondary">{a.bankName}</Text>
                <View className="mt-2 flex-row items-center justify-between">
                  <Text variant="num-lg">{a.accountNumber}</Text>
                  <Button variant="soft" size="sm" onPress={() => void copy(a.accountNumber)} accessibilityLabel={`Copy account number ${a.accountNumber}`} testID={`bank-copy-${a.id}`}>
                    Copy
                  </Button>
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>
    </OwnPage>
  );
}
