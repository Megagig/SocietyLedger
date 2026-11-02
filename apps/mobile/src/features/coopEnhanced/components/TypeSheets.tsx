import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';

import { AmountField } from '@/components/forms/AmountField';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { Switch } from '@/components/forms/Switch';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import type { CoopAccountClass, CoopAccountTypeDTO, CoopAccountTypePayload, CoopLoanCategoryDTO, CoopLoanCategoryPayload } from '@/types/api/coopEnhanced';
import { ACCOUNT_CLASS_HELP, ACCOUNT_CLASS_LABELS } from '../labels';

type TypeValues = {
  name: string;
  description: string;
  accountClass: CoopAccountClass;
  defaultMonthlyAmount: string;
  monthlyWithdrawalLimit: string;
  isActive: boolean;
};

const CLASS_OPTIONS = (Object.keys(ACCOUNT_CLASS_LABELS) as CoopAccountClass[]).map((value) => ({ label: `${ACCOUNT_CLASS_LABELS[value]}: ${ACCOUNT_CLASS_HELP[value]}`, value }));

const emptyType: TypeValues = { name: '', description: '', accountClass: 'CONTRIBUTION', defaultMonthlyAmount: '', monthlyWithdrawalLimit: '', isActive: true };

const toTypeValues = (t: CoopAccountTypeDTO): TypeValues => ({
  name: t.name,
  description: t.description ?? '',
  accountClass: t.accountClass,
  defaultMonthlyAmount: t.defaultMonthlyAmount ? String(Number(t.defaultMonthlyAmount)) : '',
  monthlyWithdrawalLimit: t.monthlyWithdrawalLimit ? String(Number(t.monthlyWithdrawalLimit)) : '',
  isActive: t.isActive,
});

/**
 * Create or edit a savings account type. Each type picks one behaviour class (what it can do); once members hold accounts of it the class
 * is locked, so the rules never change under them. Share capital can't be withdrawn, so it has no withdrawal limit to set.
 */
export const AccountTypeSheet = forwardRef<
  BottomSheetModal,
  { editing: CoopAccountTypeDTO | null; loading: boolean; onSave: (id: number | undefined, body: CoopAccountTypePayload) => void }
>(function AccountTypeSheet({ editing, loading, onSave }, ref) {
  const localRef = useRef<BottomSheetModal>(null);
  useImperativeHandle(ref, () => localRef.current as BottomSheetModal, []);
  const { control, handleSubmit, reset } = useForm<TypeValues>({ defaultValues: emptyType });
  useEffect(() => reset(editing ? toTypeValues(editing) : emptyType), [editing, reset]);
  const locked = (editing?.accountCount ?? 0) > 0;
  const accountClass = useWatch({ control, name: 'accountClass' });

  return (
    <BottomSheet ref={localRef} title={editing ? 'Edit account type' : 'New account type'} snapPoints={['90%']}>
      <View className="gap-4 pb-6">
        <TextField control={control} name="name" label="Name" placeholder="For example: Christmas savings" maxLength={80} />
        <TextField control={control} name="description" label="Description (optional)" maxLength={300} />
        {locked ? (
          <Text variant="caption" tone="secondary">
            {`Behaves like ${ACCOUNT_CLASS_LABELS[accountClass]}. Members already hold accounts of this type, so what it does can no longer change. Create a new type instead.`}
          </Text>
        ) : (
          <SelectSheet control={control} name="accountClass" label="Behaves like" options={CLASS_OPTIONS} />
        )}
        <AmountField control={control} name="defaultMonthlyAmount" label="Usual monthly amount (₦, optional)" />
        {accountClass !== 'SHARES' ? <AmountField control={control} name="monthlyWithdrawalLimit" label="Monthly withdrawal limit (₦, optional)" /> : null}
        {editing ? <Switch control={control} name="isActive" label="In use (members can pay into it)" /> : null}
        <View className="flex-row gap-3">
          <Button variant="secondary" fullWidth onPress={() => localRef.current?.dismiss()}>
            Cancel
          </Button>
          <Button
            variant="primary"
            fullWidth
            loading={loading}
            onPress={() => {
              void handleSubmit((v) =>
                onSave(editing?.id, {
                  name: v.name.trim(),
                  description: v.description.trim() || null,
                  accountClass: v.accountClass,
                  defaultMonthlyAmount: v.defaultMonthlyAmount ? Number(v.defaultMonthlyAmount) : null,
                  monthlyWithdrawalLimit: v.accountClass === 'SHARES' || !v.monthlyWithdrawalLimit ? null : Number(v.monthlyWithdrawalLimit),
                  ...(editing ? { isActive: v.isActive } : {}),
                }),
              )();
            }}
            testID="type-save"
          >
            Save
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
});

type CategoryValues = { name: string; description: string; isGoods: boolean; isActive: boolean };
const emptyCategory: CategoryValues = { name: '', description: '', isGoods: false, isActive: true };

/** Create or edit a loan category. A goods (commodity) loan asks the member what they want; the cash/goods switch locks once products use the category. */
export const LoanCategorySheet = forwardRef<
  BottomSheetModal,
  { editing: CoopLoanCategoryDTO | null; loading: boolean; onSave: (id: number | undefined, body: CoopLoanCategoryPayload) => void }
>(function LoanCategorySheet({ editing, loading, onSave }, ref) {
  const localRef = useRef<BottomSheetModal>(null);
  useImperativeHandle(ref, () => localRef.current as BottomSheetModal, []);
  const { control, handleSubmit, reset } = useForm<CategoryValues>({ defaultValues: emptyCategory });
  useEffect(() => reset(editing ? { name: editing.name, description: editing.description ?? '', isGoods: editing.isGoods, isActive: editing.isActive } : emptyCategory), [editing, reset]);
  const locked = (editing?.productCount ?? 0) > 0;
  const isGoods = useWatch({ control, name: 'isGoods' });

  return (
    <BottomSheet ref={localRef} title={editing ? 'Edit loan category' : 'New loan category'} snapPoints={['75%']}>
      <View className="gap-4 pb-6">
        <TextField control={control} name="name" label="Name" placeholder="For example: Commodity loans" maxLength={80} />
        <TextField control={control} name="description" label="Description (optional)" maxLength={300} />
        {locked ? (
          <Text variant="caption" tone="secondary">
            {`Paid out as ${isGoods ? 'goods' : 'cash'}. Loan products already use this category, so it can no longer switch between cash and goods.`}
          </Text>
        ) : (
          <Switch control={control} name="isGoods" label="A goods (commodity) loan" helper="Paid out as goods; the member describes what they want." />
        )}
        {editing ? <Switch control={control} name="isActive" label="In use" /> : null}
        <View className="flex-row gap-3">
          <Button variant="secondary" fullWidth onPress={() => localRef.current?.dismiss()}>
            Cancel
          </Button>
          <Button
            variant="primary"
            fullWidth
            loading={loading}
            onPress={() => {
              void handleSubmit((v) => onSave(editing?.id, { name: v.name.trim(), description: v.description.trim() || null, isGoods: v.isGoods, ...(editing ? { isActive: v.isActive } : {}) }))();
            }}
            testID="category-save"
          >
            Save
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
});
