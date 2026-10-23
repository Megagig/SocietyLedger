import { useRef, useState } from 'react';
import { View } from 'react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Bell, CircleHelp, Receipt } from 'lucide-react-native';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner-native';
import { z } from 'zod';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button, type ButtonVariant } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Divider } from '@/components/ui/Divider';
import { IconButton } from '@/components/ui/IconButton';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text, type TextVariant } from '@/components/ui/Text';
import { AmountField } from '@/components/forms/AmountField';
import { Checkbox } from '@/components/forms/Checkbox';
import { DateField } from '@/components/forms/DateField';
import { FileAttachField } from '@/components/forms/FileAttachField';
import { OtpInput } from '@/components/forms/OtpInput';
import { PasswordField } from '@/components/forms/PasswordField';
import { SearchField } from '@/components/forms/SearchField';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { Switch } from '@/components/forms/Switch';
import { TextField } from '@/components/forms/TextField';
import { ConfirmSheet } from '@/components/feedback/ConfirmSheet';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { ModuleLocked } from '@/components/feedback/ModuleLocked';
import { NoPermission } from '@/components/feedback/NoPermission';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { SubscriptionInactive } from '@/components/feedback/SubscriptionInactive';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { useThemeMode, useThemeTokens } from '@/providers/ThemeProvider';

const demoFormSchema = z.object({
  fullName: z.string().min(2, 'Enter your full name'),
  password: z.string().min(8, 'At least 8 characters'),
  amount: z.string().min(1, 'Enter an amount'),
  category: z.string().min(1, 'Select a category'),
  dueDate: z.string().min(1, 'Select a date'),
  otp: z.string().length(6, 'Enter the 6-digit code'),
  agreeToTerms: z.boolean().refine((v) => v === true, { message: 'You must agree to continue' }),
  notifyByEmail: z.boolean(),
  receipt: z.unknown().nullable(),
});
type DemoFormValues = z.infer<typeof demoFormSchema>;

const BUTTON_VARIANTS: ButtonVariant[] = ['primary', 'secondary', 'soft', 'ghost', 'danger', 'danger-ghost'];
const TEXT_VARIANTS: TextVariant[] = ['display', 'h1', 'h2', 'h3', 'body-lg', 'body', 'body-strong', 'label', 'caption', 'micro', 'num-lg'];
const EXAMPLE_STATUSES = ['paid', 'pending', 'overdue', 'draft', 'scheduled'];

function LeadingIcon() {
  const { color } = useThemeTokens();
  return (
    <View className="h-9 w-9 items-center justify-center rounded-full bg-surface-sunken">
      <Receipt size={18} color={color.textSecondary} />
    </View>
  );
}

export default function GalleryScreen() {
  const { preference, setPreference } = useThemeMode();
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [filterValue, setFilterValue] = useState<'upcoming' | 'past'>('upcoming');
  const confirmSheetRef = useRef<BottomSheetModal>(null);

  const { control, handleSubmit, formState } = useForm<DemoFormValues>({
    resolver: zodResolver(demoFormSchema),
    mode: 'onTouched',
    defaultValues: {
      fullName: '',
      password: '',
      amount: '',
      category: '',
      dueDate: '',
      otp: '',
      agreeToTerms: false,
      notifyByEmail: false,
      receipt: null,
    },
  });

  const onSubmit = handleSubmit(() => {
    toast.success('Form validated');
  });

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader
        title="Component gallery"
        large
        rightActions={<IconButton icon={CircleHelp} accessibilityLabel="About this screen" onPress={() => {}} />}
      />

      <Screen edges={['bottom']}>
        <View className="gap-8 pb-8 pt-4">
          <Section title="Theme">
            <View className="flex-row gap-2">
              {(['system', 'light', 'dark'] as const).map((mode) => (
                <Button key={mode} variant={preference === mode ? 'primary' : 'secondary'} size="sm" onPress={() => setPreference(mode)}>
                  {mode}
                </Button>
              ))}
            </View>
          </Section>

          <Section title="Text">
            <View className="gap-2">
              {TEXT_VARIANTS.map((variant) => (
                <Text key={variant} variant={variant}>
                  {variant} — Aa 0123456789
                </Text>
              ))}
            </View>
          </Section>

          <Section title="Button">
            <View className="gap-3">
              {BUTTON_VARIANTS.map((variant) => (
                <Button key={variant} variant={variant} onPress={() => {}}>
                  {variant}
                </Button>
              ))}
              <View className="rounded-lg bg-passbook p-4">
                <Button variant="onPassbook" onPress={() => {}}>
                  On passbook
                </Button>
              </View>
              <Button variant="primary" loading={loading} onPress={() => setLoading((v) => !v)}>
                Toggle loading
              </Button>
              <Button variant="primary" disabled onPress={() => {}}>
                Disabled
              </Button>
              <View className="flex-row gap-2">
                <Button size="sm" onPress={() => {}}>
                  sm
                </Button>
                <Button size="md" onPress={() => {}}>
                  md
                </Button>
                <Button size="lg" onPress={() => {}}>
                  lg
                </Button>
              </View>
            </View>
          </Section>

          <Section title="IconButton">
            <View className="flex-row gap-2">
              <IconButton icon={Bell} accessibilityLabel="Notifications" onPress={() => {}} />
              <IconButton icon={Bell} variant="soft" accessibilityLabel="Notifications (soft)" onPress={() => {}} />
              <IconButton icon={Bell} accessibilityLabel="Notifications (disabled)" disabled onPress={() => {}} />
            </View>
          </Section>

          <Section title="Badge">
            <View className="flex-row flex-wrap items-center gap-3">
              <Badge tone="neutral">Neutral</Badge>
              <Badge tone="primary">Primary</Badge>
              <Badge tone="accent">New</Badge>
              <Badge variant="count" count={3} />
              <Badge variant="count" count={128} />
              <Badge variant="count" count={0} />
              <Badge variant="dot" />
            </View>
          </Section>

          <Section title="StatusChip">
            <View className="flex-row flex-wrap gap-2">
              {EXAMPLE_STATUSES.map((status) => (
                <StatusChip key={status} status={status} />
              ))}
            </View>
          </Section>

          <Section title="Card">
            <Card>
              <Text variant="body-strong">A generic card</Text>
              <Text variant="caption" tone="secondary">
                Surface, radius lg, 1dp border, no shadow.
              </Text>
            </Card>
          </Section>

          <Section title="Avatar">
            <View className="flex-row items-center gap-4">
              <Avatar name="Ada Eze" size={32} colorSeed={1} />
              <Avatar name="Tunde Bakare" size={40} colorSeed={2} />
              <Avatar name="Ngozi Eze" size={64} colorSeed={3} />
              <Avatar name="Opuogun State Union" shape="square" size={40} tintColor="#178678" />
            </View>
          </Section>

          <Section title="Divider">
            <Divider />
          </Section>

          <Section title="Skeleton">
            <View className="gap-2">
              <Skeleton width="60%" height={16} />
              <Skeleton width={120} height={40} radius="md" />
            </View>
          </Section>

          <Section title="Money">
            <View className="gap-2">
              <Money value={25000} size="display" />
              <Money value={-2000} />
              <Money value={1250000} size="num-lg" />
              <Money value="25.5" tone="danger" />
            </View>
          </Section>

          <Section title="Spinner">
            <View className="flex-row gap-4">
              <Spinner />
              <Spinner size="lg" tone="danger" />
            </View>
          </Section>

          <Section title="ListItem / ListGroup">
            <ListGroup>
              <ListItem leading={<LeadingIcon />} title="October dues" meta="Due 31 Oct" trailing={<Money value={25000} />} onPress={() => {}} />
              <ListItem leading={<LeadingIcon />} title="Building fund levy" meta="Overdue" trailing={<StatusChip status="overdue" />} showChevron onPress={() => {}} />
              <ListItem title="Not pressable row" meta="No leading icon" />
            </ListGroup>
          </Section>

          <Section title="Forms (react-hook-form + zod)">
            <View className="gap-4">
              <TextField control={control} name="fullName" label="Full name" placeholder="Ada Eze" autoCapitalize="words" />
              <PasswordField control={control} name="password" label="Password" placeholder="••••••••" showStrength />
              <AmountField control={control} name="amount" label="Amount" presets={[1000, 5000, 10000]} />
              <SelectSheet
                control={control}
                name="category"
                label="Category"
                options={[
                  { label: 'Dues', value: 'dues' },
                  { label: 'Levy', value: 'levy' },
                  { label: 'Donation', value: 'donation' },
                ]}
              />
              <DateField control={control} name="dueDate" label="Due date" />
              <OtpInput control={control} name="otp" label="Verification code" />
              <FileAttachField control={control} name="receipt" label="Payment receipt" helper="JPG, PNG or PDF, up to 5MB" />
              <Switch control={control} name="notifyByEmail" label="Email notifications" helper="Get a copy of receipts by email" />
              <Checkbox control={control} name="agreeToTerms" label="I agree to the terms" />
              <Button variant="primary" loading={formState.isSubmitting} onPress={() => onSubmit()}>
                Validate form
              </Button>
            </View>
          </Section>

          <Section title="SearchField">
            <SearchField value={searchValue} onChangeText={setSearchValue} placeholder="Search members" />
          </Section>

          <Section title="SegmentedControl">
            <SegmentedControl
              options={[
                { label: 'Upcoming', value: 'upcoming' },
                { label: 'Past', value: 'past' },
              ]}
              value={filterValue}
              onChange={setFilterValue}
            />
          </Section>

          <Section title="Feedback states">
            <View className="gap-4">
              <OfflineBanner lastUpdatedLabel="10:42" />
              <View className="overflow-hidden rounded-lg border border-border">
                <EmptyState title="No payments yet" description="Payments you make will show up here." actionLabel="Make a payment" onAction={() => {}} />
              </View>
              <View className="overflow-hidden rounded-lg border border-border">
                <ErrorState description="Check your connection and try again." onRetry={() => {}} />
              </View>
              <View className="overflow-hidden rounded-lg border border-border">
                <ModuleLocked moduleName="Welfare" />
              </View>
              <View className="overflow-hidden rounded-lg border border-border">
                <SubscriptionInactive />
              </View>
              <View className="overflow-hidden rounded-lg border border-border">
                <NoPermission onGoHome={() => {}} />
              </View>
            </View>
          </Section>

          <Section title="ConfirmSheet">
            <Button variant="danger-ghost" onPress={() => confirmSheetRef.current?.present()}>
              Delete this transaction
            </Button>
          </Section>
        </View>
      </Screen>

      <ConfirmSheet
        ref={confirmSheetRef}
        title="Delete this transaction?"
        description="This can't be undone after 30 seconds."
        confirmLabel="Delete transaction"
        onConfirm={() => {
          confirmSheetRef.current?.dismiss();
          toast.success('Transaction deleted');
        }}
      />

      <StickyFooter>
        <Button variant="secondary" fullWidth onPress={() => {}}>
          Cancel
        </Button>
        <Button variant="primary" fullWidth onPress={() => {}}>
          Save
        </Button>
      </StickyFooter>
    </View>
  );
}
