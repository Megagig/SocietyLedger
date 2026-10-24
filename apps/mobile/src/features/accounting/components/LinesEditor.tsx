import { Trash2 } from 'lucide-react-native';
import { useFieldArray, useWatch, type Control } from 'react-hook-form';
import { View } from 'react-native';

import { AmountField } from '@/components/forms/AmountField';
import { SelectSheet, type SelectOption } from '@/components/forms/SelectSheet';
import { TextField } from '@/components/forms/TextField';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Money } from '@/components/ui/Money';
import { Text } from '@/components/ui/Text';
import { totalsOf } from '../labels';
import type { JournalFormValues } from '../schemas';

/**
 * The lines of a journal entry. Each line is an account and either a debit or a credit; underneath, a live check says whether the
 * debits and credits match, and by how much they differ if not. An entry cannot be saved until they match to the kobo.
 */
export function LinesEditor({ control, accountOptions, error }: { control: Control<JournalFormValues>; accountOptions: SelectOption[]; error?: string }) {
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const lines = useWatch({ control, name: 'lines' }) ?? [];
  const totals = totalsOf(lines);
  const started = totals.debit.gt(0) || totals.credit.gt(0);

  return (
    <View className="gap-4">
      {fields.map((field, index) => (
        <View key={field.id} className="gap-3 rounded-lg border border-border bg-surface p-4 dark:border-transparent" testID={`line-${index}`}>
          <View className="flex-row items-center justify-between">
            <Text variant="label" tone="secondary">
              Line {index + 1}
            </Text>
            {fields.length > 2 ? <IconButton icon={Trash2} accessibilityLabel={`Remove line ${index + 1}`} onPress={() => remove(index)} testID={`line-remove-${index}`} /> : null}
          </View>
          <SelectSheet control={control} name={`lines.${index}.accountId`} label="Account" options={accountOptions} placeholder="Choose an account" testID={`line-account-${index}`} />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <AmountField control={control} name={`lines.${index}.debit`} label="Debit" testID={`line-debit-${index}`} />
            </View>
            <View className="flex-1">
              <AmountField control={control} name={`lines.${index}.credit`} label="Credit" testID={`line-credit-${index}`} />
            </View>
          </View>
          <TextField control={control} name={`lines.${index}.description`} label="Note (optional)" autoCapitalize="sentences" />
        </View>
      ))}

      <Button variant="secondary" fullWidth onPress={() => append({ accountId: '', debit: '', credit: '', description: '' })} testID="line-add">
        Add a line
      </Button>

      <View className="gap-2 rounded-lg bg-surface-sunken p-4" testID="entry-totals">
        <View className="flex-row justify-between">
          <Text variant="body">Debits</Text>
          <Money value={totals.debit.toFixed(2)} size="body-strong" />
        </View>
        <View className="flex-row justify-between">
          <Text variant="body">Credits</Text>
          <Money value={totals.credit.toFixed(2)} size="body-strong" />
        </View>
        <Text variant="caption" tone={totals.balanced ? 'success' : started ? 'danger' : 'secondary'} testID="entry-balance-note">
          {totals.balanced ? 'Balanced. Debits equal credits.' : started ? `Out by ₦${totals.difference.toFixed(2)}. Debits and credits must match.` : 'Enter the amounts. Debits must equal credits.'}
        </Text>
        {error ? (
          <Text variant="caption" tone="danger">
            {error}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
