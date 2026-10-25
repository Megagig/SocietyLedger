import { useController, useWatch, type Control } from 'react-hook-form';
import { View } from 'react-native';

import { Switch } from '@/components/forms/Switch';
import { TextField } from '@/components/forms/TextField';
import { Section } from '@/components/layout/Section';
import { FilterChip } from '@/components/ui/FilterChip';
import { Text } from '@/components/ui/Text';
import { categoryLabel, hasAnyRule, formValuesToRules, type RulesFormValues } from '../eligibility';

function CategoryChips({ control, name, categories }: { control: Control<RulesFormValues>; name: 'voters.categories' | 'candidates.categories'; categories: string[] }) {
  const { field } = useController({ control, name });
  const chosen = (field.value as string[]) ?? [];
  return (
    <View className="flex-row flex-wrap gap-2">
      {categories.map((c) => {
        const on = chosen.includes(c);
        return <FilterChip key={c} label={categoryLabel(c)} active={on} onPress={() => field.onChange(on ? chosen.filter((x) => x !== c) : [...chosen, c])} />;
      })}
    </View>
  );
}

/** The conditions voters and candidates can both be held to. Each is a switch; what is off isn't checked at all. */
function MemberConditions({ control, scope, word, categories }: { control: Control<RulesFormValues>; scope: 'voters' | 'candidates'; word: string; categories: string[] }) {
  const financialOn = useWatch({ control, name: `${scope}.financialOn` });
  const monthsOn = useWatch({ control, name: `${scope}.monthsOn` });
  const categoriesOn = useWatch({ control, name: `${scope}.categoriesOn` });
  const chosen = useWatch({ control, name: `${scope}.categories` }) as string[];

  return (
    <View className="gap-3">
      <Switch control={control} name={`${scope}.financialOn`} label={`Only members in good financial standing can ${word}`} testID={`rules-${scope}-financial`} />
      {financialOn ? (
        <TextField control={control} name={`${scope}.financialMax`} label="Most a member may owe on overdue charges (₦)" helper="0 means nothing overdue." keyboardType="number-pad" />
      ) : null}

      <Switch control={control} name={`${scope}.monthsOn`} label={`Only members of a minimum length can ${word}`} testID={`rules-${scope}-months`} />
      {monthsOn ? <TextField control={control} name={`${scope}.months`} label="At least this many months a member" keyboardType="number-pad" /> : null}

      <Switch control={control} name={`${scope}.categoriesOn`} label={`Only some kinds of member can ${word}`} testID={`rules-${scope}-categories`} />
      {categoriesOn ? (
        <View className="gap-2">
          <CategoryChips control={control} name={`${scope}.categories`} categories={categories} />
          {chosen.length === 0 ? (
            <Text variant="caption" tone="danger">
              Choose at least one
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Who can vote and who can stand. Nothing is switched on to begin with, which means every active member can do both, as always; each
 * switch adds a condition. The parent owns the form (`useForm<RulesFormValues>`), so the same editor serves an election and the
 * association's template.
 */
export function RulesEditor({ control, categories }: { control: Control<RulesFormValues>; categories: string[] }) {
  const values = useWatch({ control }) as RulesFormValues;
  const restricted = hasAnyRule(values);
  const candidateMaxOn = useWatch({ control, name: 'candidates.maxPositionsOn' });

  return (
    <View className="gap-6" testID="rules-editor">
      <Text variant="body" tone="secondary">
        {restricted ? 'Only members who meet these conditions can vote or stand.' : 'Every active member can vote and stand. Switch a condition on to narrow it.'}
      </Text>

      <Section title="Who can vote">
        <MemberConditions control={control} scope="voters" word="vote" categories={categories} />
      </Section>

      <Section title="Who can stand">
        <View className="gap-3">
          <MemberConditions control={control} scope="candidates" word="stand" categories={categories} />
          <Switch control={control} name="candidates.mustBeVoter" label="A candidate must also be allowed to vote" testID="rules-candidates-voter" />
          <Switch control={control} name="candidates.maxPositionsOn" label="Limit how many positions one person can stand for" testID="rules-candidates-max" />
          {candidateMaxOn ? <TextField control={control} name="candidates.maxPositions" label="Most positions one person can stand for" keyboardType="number-pad" /> : null}
        </View>
      </Section>
    </View>
  );
}

/** What the rule in this form amounts to, for a summary line. */
export const rulesAreSet = (values: RulesFormValues): boolean => formValuesToRules(values) !== null;
