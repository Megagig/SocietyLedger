import { Pressable, View } from 'react-native';
import { Landmark } from 'lucide-react-native';

import { Badge } from '@/components/ui/Badge';
import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { BankAccountDTO } from '@/types/api/bankManage';
import { formatAccountNumber } from '../labels';

export type BankAccountRowProps = {
  account: BankAccountDTO;
  /** Opens the account's actions. Omitted when the officer can only view accounts. */
  onPress?: (account: BankAccountDTO) => void;
};

/** One association bank account: bank, grouped account number and name, with Default / Inactive markers. */
export function BankAccountRow({ account, onPress }: BankAccountRowProps) {
  const { color } = useThemeTokens();

  const content = (
    <View className="min-h-[72px] flex-row items-center gap-3 px-4 py-3">
      <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-soft">
        <Landmark size={20} color={color.primary} strokeWidth={1.75} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="body-lg" numberOfLines={1}>
          {account.bankName}
        </Text>
        <Text variant="num" numberOfLines={1}>
          {formatAccountNumber(account.accountNumber)}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {account.accountName}
        </Text>
      </View>
      <View className="items-end gap-1">
        {account.isDefault ? <Badge tone="primary">Default</Badge> : null}
        {account.isActive ? null : <Badge tone="neutral">Inactive</Badge>}
      </View>
    </View>
  );

  if (!onPress) return <View testID={`bank-account-${account.id}`}>{content}</View>;

  return (
    <Pressable
      onPress={() => onPress(account)}
      accessibilityRole="button"
      accessibilityLabel={`${account.bankName}, ${account.accountName}${account.isDefault ? ', default account' : ''}`}
      android_ripple={{ color: `${color.primary}1F` }}
      testID={`bank-account-${account.id}`}
    >
      {content}
    </Pressable>
  );
}
