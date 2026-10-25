import type { Control } from 'react-hook-form';
import { View } from 'react-native';

import { DateField } from '@/components/forms/DateField';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { TextField } from '@/components/forms/TextField';
import { Section } from '@/components/layout/Section';
import { CATEGORY_LABELS, CATEGORY_OPTIONS, STATUS_LABELS } from '../labels';
import type { MemberFormValues } from '../schemas';

const GENDER_OPTIONS = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
];

export type MemberFormFieldsProps = {
  control: Control<MemberFormValues>;
  /** Show the member ID field — only when creating with automatic IDs turned off (the ID never changes afterwards). */
  askMemberId: boolean;
  /** Offer the Disabled status — only for a member who already is. Disabling someone is its own action. */
  allowDisabledStatus: boolean;
};

/** MG3 — the sectioned member form (personal, contact, membership, emergency contact, notes), shared by create and edit. */
export function MemberFormFields({ control, askMemberId, allowDisabledStatus }: MemberFormFieldsProps) {
  const statusOptions = (['active', 'inactive', 'suspended', ...(allowDisabledStatus ? (['terminated'] as const) : [])] as const).map((value) => ({
    label: STATUS_LABELS[value],
    value,
  }));

  return (
    <View className="gap-6">
      <Section title="Personal">
        <View className="gap-4">
          <TextField control={control} name="firstName" label="First name" autoCapitalize="words" returnKeyType="next" testID="member-first-name" />
          <TextField control={control} name="lastName" label="Last name" autoCapitalize="words" returnKeyType="next" testID="member-last-name" />
          {askMemberId ? (
            <TextField
              control={control}
              name="memberId"
              label="Member ID"
              helper="Automatic IDs are turned off, so enter this member's ID. It can't be changed later."
              autoCapitalize="characters"
              testID="member-id"
            />
          ) : null}
          <SelectSheet control={control} name="gender" label="Gender" options={GENDER_OPTIONS} />
          <DateField control={control} name="dateOfBirth" label="Date of birth (optional)" placeholder="Select a date" maximumDate={new Date()} />
          <TextField control={control} name="occupation" label="Occupation (optional)" autoCapitalize="sentences" />
        </View>
      </Section>

      <Section title="Contact">
        <View className="gap-4">
          <TextField control={control} name="email" label="Email (optional)" keyboardType="email-address" helper="Needed to invite them to sign in." testID="member-email" />
          <TextField control={control} name="phone" label="Phone (optional)" keyboardType="phone-pad" testID="member-phone" />
          <TextField control={control} name="address" label="Address (optional)" autoCapitalize="sentences" multiline />
          <TextField control={control} name="city" label="City (optional)" autoCapitalize="words" />
          <TextField control={control} name="state" label="State (optional)" autoCapitalize="words" />
          <TextField control={control} name="country" label="Country (optional)" autoCapitalize="words" />
        </View>
      </Section>

      <Section title="Membership">
        <View className="gap-4">
          <SelectSheet control={control} name="category" label="Category" options={CATEGORY_OPTIONS.map((value) => ({ label: CATEGORY_LABELS[value], value }))} />
          <SelectSheet control={control} name="status" label="Status" options={statusOptions} />
          <DateField control={control} name="joinDate" label="Join date" />
        </View>
      </Section>

      <Section title="Emergency contact">
        <View className="gap-4">
          <TextField control={control} name="emergencyContactName" label="Name (optional)" autoCapitalize="words" />
          <TextField control={control} name="emergencyContactPhone" label="Phone (optional)" keyboardType="phone-pad" />
          <TextField control={control} name="emergencyContactRelationship" label="Relationship (optional)" autoCapitalize="sentences" />
        </View>
      </Section>

      <Section title="Notes">
        <TextField control={control} name="notes" label="Notes (optional)" autoCapitalize="sentences" multiline />
      </Section>
    </View>
  );
}
