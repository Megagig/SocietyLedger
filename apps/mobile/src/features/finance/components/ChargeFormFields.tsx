import { View } from 'react-native';
import type { Control, FieldValues, Path } from 'react-hook-form';

import { AmountField } from '@/components/forms/AmountField';
import { DateField } from '@/components/forms/DateField';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { TextField } from '@/components/forms/TextField';
import type { FinanceCategoryDTO } from '@/types/api/financeManage';

/** The category, amount, due date and note every charge form shares (single, bulk, edit and void-and-replace). */
export function ChargeFormFields<T extends FieldValues>({
  control,
  categories,
  lockCategory = false,
}: {
  control: Control<T>;
  categories: FinanceCategoryDTO[];
  lockCategory?: boolean;
}) {
  const options = categories.map((c) => ({ label: c.name, value: String(c.id) }));
  return (
    <View className="gap-4">
      {lockCategory ? null : <SelectSheet control={control} name={'categoryId' as Path<T>} label="Category" options={options} placeholder="Choose the category" />}
      <AmountField control={control} name={'amount' as Path<T>} label="Amount" presets={[1000, 5000, 10000, 20000]} />
      <DateField control={control} name={'dueDate' as Path<T>} label="Due date (optional)" />
      <TextField control={control} name={'notes' as Path<T>} label="Note (optional)" multiline />
    </View>
  );
}
