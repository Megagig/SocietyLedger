import { useState } from 'react';
import { useController, useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ajoApi } from '@/api/endpoints/ajo';
import { ApiError } from '@/api/errors';
import { Checkbox } from '@/components/forms/Checkbox';
import { DateField } from '@/components/forms/DateField';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { TextField } from '@/components/forms/TextField';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Text } from '@/components/ui/Text';
import type { GroupDetailDTO } from '@/types/api/ajo';
import { cadenceWords, formatDay, formatKobo, isoToLocalDay } from '../format';
import { buildGroup, defaultsForModel, FREQUENCY_OPTIONS, INITIAL_GROUP, type GroupFormValues } from '../groupForm';
import { useAjoAction } from '../mutations';
import { RulesFields } from './RulesFields';

const STEPS = ['Kind', 'Money', 'Collector', 'Account', 'Rules', 'Review'] as const;

function ModelPicker({ control, onChange }: { control: ReturnType<typeof useForm<GroupFormValues>>['control']; onChange: (model: GroupFormValues['model']) => void }) {
  const { field } = useController({ control, name: 'model' });
  return (
    <SegmentedControl
      options={[
        { label: 'Collector thrift', value: 'COLLECTOR_THRIFT' },
        { label: 'Rotating pot', value: 'ROTATING_POT' },
      ]}
      value={field.value}
      onChange={(value) => {
        field.onChange(value);
        onChange(value);
      }}
      testID="ajo-wizard-model"
    />
  );
}

/** Two plain examples, for someone who does not yet know which kind of circle they run. */
function ModelExamples() {
  return (
    <View className="gap-3">
      <Card>
        <Text variant="body-strong">Collector thrift</Text>
        <Text variant="caption" tone="secondary">
          Everyone pays ₦500.00 a day for 31 days. The collector keeps one day&apos;s payment. Everyone gets their savings back at the end.
        </Text>
      </Card>
      <Card>
        <Text variant="body-strong">Rotating pot</Text>
        <Text variant="caption" tone="secondary">
          10 people each pay ₦10,000.00 a month. Each month one person takes the full ₦100,000.00, in a drawn order.
        </Text>
      </Card>
    </View>
  );
}

/**
 * THO2: create a circle in six short steps, saved as a draft. Used by the Ajo "New circle" screen and by thrift onboarding, so a
 * circle made in either place is identical. The caller decides what happens next through `onCreated`.
 */
export function GroupWizard({ onCreated, examples = false }: { onCreated: (group: GroupDetailDTO) => void; examples?: boolean }) {
  const [step, setStep] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const { control, getValues, setValue } = useForm<GroupFormValues>({ defaultValues: { ...INITIAL_GROUP, startDate: new Date().toISOString() } });
  const create = useAjoAction(ajoApi.createGroup);
  const values = useWatch({ control }) as GroupFormValues;
  const rotating = values.model === 'ROTATING_POT';

  const next = () => {
    const built = buildGroup(getValues());
    if ('error' in built && built.step <= step) {
      setProblem(built.error);
      return;
    }
    setProblem(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const submit = async () => {
    const built = buildGroup(getValues());
    if ('error' in built) {
      setStep(built.step);
      setProblem(built.error);
      return;
    }
    setProblem(null);
    try {
      const group = await create.mutateAsync(built.body);
      toast.success('Circle created as a draft.');
      onCreated(group);
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'Could not create the circle.');
    }
  };

  const built = buildGroup(values);
  return (
    <View className="gap-5" testID="ajo-wizard">
      {examples ? <ModelExamples /> : null}

      <View className="gap-2">
        <Text variant="label" tone="secondary">
          Step {step + 1} of {STEPS.length}: {STEPS[step]}
        </Text>
        <ProgressBar percent={((step + 1) / STEPS.length) * 100} label={`Step ${step + 1} of ${STEPS.length}`} />
      </View>

      <View className="gap-4">
        {step === 0 ? (
          <>
            <ModelPicker control={control} onChange={(model) => Object.entries(defaultsForModel(model)).forEach(([k, v]) => setValue(k as keyof GroupFormValues, v as never))} />
            <Text variant="body" tone="secondary">
              {rotating
                ? 'Everyone pays the same amount each round and one person collects the whole pot in turn, in a drawn order.'
                : 'A collector goes round and collects a set amount each day or week. Everyone gets their savings back at the end of the cycle, less the collector’s fee.'}
            </Text>
            <TextField control={control} name="name" label="Circle name" maxLength={80} testID="ajo-wizard-name" />
          </>
        ) : null}

        {step === 1 ? (
          <>
            <TextField control={control} name="contribution" label="Each person pays (₦)" helper={rotating ? 'Every round, for each share they hold.' : 'Every time (each day, week or month).'} keyboardType="decimal-pad" testID="ajo-wizard-contribution" />
            <SelectSheet control={control} name="frequency" label="How often" options={FREQUENCY_OPTIONS.filter((o) => !(rotating && o.value === 'DAILY'))} testID="ajo-wizard-frequency" />
            {values.frequency === 'CUSTOM' ? (
              <View className="gap-3 rounded-lg bg-surface-sunken p-3">
                <TextField control={control} name="customCount" label="Every how many" keyboardType="number-pad" maxLength={2} testID="ajo-wizard-custom-count" />
                <SelectSheet
                  control={control}
                  name="customUnit"
                  label="Days, weeks or months"
                  options={[
                    { value: 'DAYS', label: 'days' },
                    { value: 'WEEKS', label: 'weeks' },
                    { value: 'MONTHS', label: 'months' },
                  ]}
                />
                <Text variant="caption" tone="secondary">
                  For example bi-weekly is every 2 weeks, and every two months is 2 months. For twice a month, choose 15 days or 2 weeks.
                </Text>
                {Number.isInteger(Number(values.customCount)) && Number(values.customCount) >= 1 ? (
                  <Text variant="body-strong">
                    Everyone pays {cadenceWords('CUSTOM', Number(values.customCount), values.customUnit)}
                    {values.startDate ? `, starting ${formatDay(isoToLocalDay(values.startDate) + 'T00:00:00.000Z')}` : ''}.
                  </Text>
                ) : null}
              </View>
            ) : null}
            <DateField control={control} name="startDate" label="First payment date" minimumDate={new Date(new Date().setHours(0, 0, 0, 0))} testID="ajo-wizard-start" />
            {!rotating ? <TextField control={control} name="cycleLength" label="Number of payments in the cycle" helper="For example 31 daily payments." keyboardType="number-pad" maxLength={3} /> : null}
            <TextField control={control} name="maxParticipants" label="Most people in the circle" keyboardType="number-pad" maxLength={4} testID="ajo-wizard-max" />
            {rotating ? <TextField control={control} name="maxShares" label="Most shares one person can hold" helper="A person with two shares pays twice and collects twice." keyboardType="number-pad" maxLength={1} /> : null}
            <Checkbox control={control} name="allowLateJoin" label="People may join after the circle has started" />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <SelectSheet
              control={control}
              name="collectorFeeType"
              label="How the collector is paid"
              options={[
                { value: 'NONE', label: 'No collector fee' },
                { value: 'DAYS', label: 'Days of contribution (for example 1 day’s payment)' },
                { value: 'FIXED', label: 'A fixed amount' },
                { value: 'PERCENT', label: 'A percentage of the pot' },
              ]}
            />
            {values.collectorFeeType !== 'NONE' ? (
              <TextField
                control={control}
                name="collectorFeeValue"
                label={values.collectorFeeType === 'DAYS' ? 'Number of days (1 to 31)' : values.collectorFeeType === 'FIXED' ? 'Amount (₦)' : 'Percentage'}
                keyboardType="decimal-pad"
              />
            ) : null}
            <TextField control={control} name="cutoffTime" label="Cut-off time each day" helper="A payment recorded after this time counts for the next day." placeholder="18:00" testID="ajo-wizard-cutoff" />
            <Checkbox control={control} name="requirePhoneConfirm" label="Members must confirm their phone number before they can join" />
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Text variant="body" tone="secondary">
              This is the circle&apos;s own bank account, where members send their contributions. SocietyLedger never holds the money. Only the last four digits are shown to officers.
            </Text>
            <TextField control={control} name="bankName" label="Bank" testID="ajo-wizard-bank" />
            <TextField control={control} name="accountNumber" label="Account number" keyboardType="number-pad" maxLength={10} testID="ajo-wizard-account-number" />
            <TextField control={control} name="accountName" label="Account name" testID="ajo-wizard-account-name" />
          </>
        ) : null}

        {step === 4 ? <RulesFields control={control} prefix="rules" /> : null}

        {step === 5 && 'body' in built ? (
          <Card testID="ajo-wizard-review">
            <View className="gap-2">
              {(
                [
                  ['Name', values.name],
                  ['Kind', rotating ? 'Rotating pot' : 'Collector thrift'],
                  ['Each pays', formatKobo(built.body.contributionKobo)],
                  ['How often', cadenceWords(values.frequency, Number(values.customCount), values.customUnit)],
                  ['Starts', built.body.startDate ?? ''],
                  [rotating ? 'Shares per person' : 'Payments in the cycle', String(rotating ? values.maxShares : values.cycleLength)],
                  ['Up to', `${values.maxParticipants} people`],
                  ['Collector fee', values.collectorFeeType === 'NONE' ? 'None' : values.collectorFeeType === 'DAYS' ? `${values.collectorFeeValue} day(s) of contribution` : values.collectorFeeType === 'FIXED' ? formatKobo(built.body.collectorFeeValue) : `${values.collectorFeeValue}%`],
                  ['Account', `${values.bankName} · ${values.accountName}`],
                  ['Late fee', values.rules.lateFeeType === 'NONE' ? 'None' : values.rules.lateFeeType === 'FIXED' ? `₦${values.rules.lateFeeValue}` : `${values.rules.lateFeeValue}%`],
                  ['Grace days', values.rules.graceDays],
                ] as const
              ).map(([label, value]) => (
                <View key={label} className="flex-row items-start justify-between gap-3">
                  <Text variant="caption" tone="tertiary">
                    {label}
                  </Text>
                  <Text variant="body-strong" className="flex-1" align="right">
                    {value}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        {problem ? (
          <Text variant="body" tone="danger" testID="ajo-wizard-problem">
            {problem}
          </Text>
        ) : null}
      </View>

      <View className="flex-row gap-3">
        <Button
          variant="secondary"
          fullWidth
          disabled={step === 0}
          onPress={() => {
            setProblem(null);
            setStep((s) => s - 1);
          }}
          testID="ajo-wizard-back"
        >
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button fullWidth onPress={next} testID="ajo-wizard-next">
            Next
          </Button>
        ) : (
          <Button fullWidth loading={create.isPending} onPress={() => void submit()} testID="ajo-wizard-create">
            Create circle
          </Button>
        )}
      </View>
      <Text variant="caption" tone="tertiary">
        The circle is saved as a draft. You add people, then open it for joining, then start it when you are ready.
      </Text>
    </View>
  );
}
