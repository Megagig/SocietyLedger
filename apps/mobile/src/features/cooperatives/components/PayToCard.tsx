import * as Clipboard from 'expo-clipboard';
import { Building2, Copy } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { toast } from 'sonner-native';

import { ListItem } from '@/components/layout/ListItem';
import { SectionCard } from '@/components/layout/SectionCard';
import { usePaymentInfo } from '@/features/memberFinance/queries';
import { useThemeTokens } from '@/providers/ThemeProvider';

/**
 * "Pay to" — the cooperative's bank accounts with tap-to-copy, shown above the receipt upload on the deposit and
 * loan-payment screens. Renders nothing while loading, on error, or when no accounts are set up: the form still
 * works, and the member can ask an officer for the details.
 */
export function PayToCard() {
  const { color } = useThemeTokens();
  const { data } = usePaymentInfo();
  const accounts = data?.bankAccounts ?? [];

  if (accounts.length === 0) return null;

  const copy = async (accountNumber: string) => {
    try {
      await Clipboard.setStringAsync(accountNumber);
      toast.success('Account number copied');
    } catch {
      toast.error('Could not copy the account number.');
    }
  };

  return (
    <SectionCard title="Pay to">
      {accounts.map((account) => (
        <ListItem
          key={account.id}
          leading={<Building2 size={20} color={color.primary} strokeWidth={1.75} />}
          title={account.accountName}
          meta={`${account.bankName} · ${account.accountNumber}`}
          trailing={
            <Pressable onPress={() => copy(account.accountNumber)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Copy account number ${account.accountNumber}`}>
              <Copy size={18} color={color.textSecondary} strokeWidth={1.75} />
            </Pressable>
          }
        />
      ))}
    </SectionCard>
  );
}
