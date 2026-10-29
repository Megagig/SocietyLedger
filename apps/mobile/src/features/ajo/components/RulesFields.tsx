import type { Control, FieldValues, Path } from 'react-hook-form';
import { useWatch } from 'react-hook-form';
import { View } from 'react-native';

import { Checkbox } from '@/components/forms/Checkbox';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { TextField } from '@/components/forms/TextField';

/**
 * The circle's rules, bound to a react-hook-form form. `prefix` is where the rules sit in the form ('rules' inside the create-circle
 * wizard, empty when the form is only the rules). Used by the wizard, the onboarding circle step and "publish a new version".
 */
export function RulesFields<T extends FieldValues>({ control, prefix = '', rotating = true }: { control: Control<T>; prefix?: string; rotating?: boolean }) {
  const name = (field: string) => (prefix ? `${prefix}.${field}` : field) as Path<T>;
  const lateFeeType = useWatch({ control, name: name('lateFeeType') }) as string;
  const visibility = useWatch({ control, name: name('memberVisibility') }) as string;

  return (
    <View className="gap-4">
      <SelectSheet
        control={control}
        name={name('lateFeeType')}
        label="Late fee"
        helper="Charged once for each missed payment, after the grace days. Members are told first and it only becomes payable 48 hours later."
        options={[
          { value: 'NONE', label: 'No late fee' },
          { value: 'FIXED', label: 'A fixed amount' },
          { value: 'PERCENT', label: 'A percentage of the contribution' },
        ]}
        testID="ajo-rules-late-type"
      />
      {lateFeeType !== 'NONE' ? (
        <>
          <TextField control={control} name={name('lateFeeValue')} label={lateFeeType === 'FIXED' ? 'Fee (₦)' : 'Fee (% of the contribution)'} keyboardType="decimal-pad" testID="ajo-rules-late-value" />
          <TextField control={control} name={name('lateFeeCap')} label="Most a fee can reach (₦, optional)" keyboardType="decimal-pad" testID="ajo-rules-late-cap" />
        </>
      ) : null}
      <TextField control={control} name={name('graceDays')} label="Grace days" helper="Days after the due date before a payment counts as late." keyboardType="number-pad" maxLength={2} testID="ajo-rules-grace" />
      <SelectSheet
        control={control}
        name={name('guarantorPolicy')}
        label="Guarantor"
        options={[
          { value: 'NOT_REQUIRED', label: 'Not needed' },
          { value: 'OPTIONAL', label: 'Optional' },
          { value: 'REQUIRED', label: 'Required before joining' },
        ]}
        testID="ajo-rules-guarantor"
      />
      <SelectSheet
        control={control}
        name={name('defaultProcedure')}
        label="If someone stops paying after they were paid"
        helper="Only for a rotating pot. Nothing is ever taken from other members or guarantors."
        options={[
          { value: 'NOTIFY_ADMIN', label: 'Tell the admins' },
          { value: 'REPAYMENT_PLAN', label: 'Offer the member a repayment plan' },
          { value: 'CASE_AND_PLAN', label: 'Open a case and offer a plan' },
        ]}
        testID="ajo-rules-default"
      />
      <Checkbox control={control} name={name('remindersEnabled')} label="Send payment reminders" testID="ajo-rules-reminders" />
      <Checkbox control={control} name={name('blockAtRiskEarly')} label="Keep people with a poor record out of the first payout positions" testID="ajo-rules-block-risk" />
      {rotating ? (
        <>
          <SelectSheet
            control={control}
            name={name('memberVisibility')}
            label="Circle board"
            helper="Each member sees who has paid, when, who is next and who is behind. Others see a member's name, payment status and dates, and payout position, never their phone, email, address, bank account or trust score. Every member accepts this with the rules."
            options={[
              { value: 'FULL', label: "Members can see each other's progress" },
              { value: 'OFF', label: 'Keep members private' },
            ]}
            testID="ajo-rules-visibility"
          />
          {visibility === 'FULL' ? (
            <SelectSheet control={control} name={name('nameDisplay')} label="How names are shown" options={[{ value: 'FIRST_INITIAL', label: 'First name and last initial (Adaeze O.)' }, { value: 'FULL', label: 'Full names' }]} testID="ajo-rules-name-display" />
          ) : null}
        </>
      ) : null}
    </View>
  );
}
