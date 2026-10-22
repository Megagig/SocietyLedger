import { forwardRef, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { FilterChip } from '@/components/ui/FilterChip';
import { Text } from '@/components/ui/Text';
import {
  CATEGORY_LABELS,
  CATEGORY_OPTIONS,
  countActiveFilters,
  LOGIN_STATUS_LABELS,
  LOGIN_STATUS_OPTIONS,
  STATUS_LABELS,
  STATUS_OPTIONS,
  type MemberFilterValues,
} from '../labels';

export type MemberFilterSheetProps = {
  values: MemberFilterValues;
  onChange: (values: MemberFilterValues) => void;
};

type GroupProps<T extends string> = {
  title: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T | undefined;
  onSelect: (next: T | undefined) => void;
};

/** One row of chips; pressing the selected chip again clears that filter. */
function ChipGroup<T extends string>({ title, options, labels, value, onSelect }: GroupProps<T>) {
  return (
    <View className="gap-2">
      <Text variant="body-strong">{title}</Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => (
          <FilterChip key={option} label={labels[option]} active={value === option} onPress={() => onSelect(value === option ? undefined : option)} />
        ))}
      </View>
    </View>
  );
}

/** ui-rules.md §5.10 — the members filters (status, category, login) in one sheet. Filters apply as you tap; "Show members" just closes it. */
export const MemberFilterSheet = forwardRef<BottomSheetModal, MemberFilterSheetProps>(function MemberFilterSheet({ values, onChange }, ref) {
  const localRef = useRef<BottomSheetModal>(null);
  useImperativeHandle(ref, () => localRef.current as BottomSheetModal, []);
  const active = countActiveFilters(values);

  return (
    <BottomSheet ref={localRef} title="Filter members" snapPoints={['60%']}>
      <View className="gap-5 pb-6">
        <ChipGroup title="Status" options={STATUS_OPTIONS} labels={STATUS_LABELS} value={values.status} onSelect={(status) => onChange({ ...values, status })} />
        <ChipGroup title="Category" options={CATEGORY_OPTIONS} labels={CATEGORY_LABELS} value={values.category} onSelect={(category) => onChange({ ...values, category })} />
        <ChipGroup
          title="Login"
          options={LOGIN_STATUS_OPTIONS}
          labels={LOGIN_STATUS_LABELS}
          value={values.loginStatus}
          onSelect={(loginStatus) => onChange({ ...values, loginStatus })}
        />
        <View className="flex-row gap-3">
          {active > 0 ? (
            <Button variant="secondary" fullWidth onPress={() => onChange({})}>
              Clear filters
            </Button>
          ) : null}
          <Button variant="primary" fullWidth onPress={() => localRef.current?.dismiss()}>
            Show members
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
});
