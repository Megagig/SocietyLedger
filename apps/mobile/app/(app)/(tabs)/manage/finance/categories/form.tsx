import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ConfirmSheet } from '@/components/feedback/ConfirmSheet';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { AmountField } from '@/components/forms/AmountField';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { Switch } from '@/components/forms/Switch';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { CATEGORY_KIND_OPTIONS, CATEGORY_KIND_SINGULAR, categoryTypeLocked, FREQUENCY_OPTIONS } from '@/features/financeSetup/labels';
import { useCreateCategory, useUpdateCategory } from '@/features/financeSetup/mutations';
import { SETUP_CREATE_ACCESS, SETUP_EDIT_ACCESS, useCategory } from '@/features/financeSetup/queries';
import { categoryFormSchema, categoryToFormValues, emptyCategoryValues, toCategoryPayload, type CategoryFormValues } from '@/features/financeSetup/schemas';
import { useCan } from '@/hooks/useCan';
import type { CategoryKind } from '@/types/api/financeSetup';

const KIND_OPTIONS = CATEGORY_KIND_OPTIONS.map((value) => ({ value, label: CATEGORY_KIND_SINGULAR[value] }));

/** project-overview.md §6.9 FN6 — add a category, or change one (`?id=`). The type can't change once charges or campaigns use it. */
export default function CategoryFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; type?: string }>();
  const editId = params.id ? Number(params.id) : undefined;
  const isEdit = editId !== undefined;
  const canCreate = useCan(SETUP_CREATE_ACCESS);
  const canEdit = useCan(SETUP_EDIT_ACCESS);
  const categoryQuery = useCategory(editId ?? null);
  const create = useCreateCategory();
  const update = useUpdateCategory(editId ?? 0);
  const offRef = useRef<BottomSheetModal>(null);
  const startType = (CATEGORY_KIND_OPTIONS as string[]).includes(params.type ?? '') ? (params.type as CategoryKind) : 'due';
  const { control, handleSubmit, reset } = useForm<CategoryFormValues>({ resolver: zodResolver(categoryFormSchema), defaultValues: emptyCategoryValues(startType), mode: 'onTouched' });
  const type = useWatch({ control, name: 'type' });
  const back = () => router.back();
  const title = isEdit ? 'Edit category' : 'Add a category';
  const category = categoryQuery.data;
  const locked = categoryTypeLocked(category);

  useEffect(() => {
    if (category) reset(categoryToFormValues(category));
  }, [category, reset]);

  if (isEdit ? !canEdit : !canCreate) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  if (isEdit && categoryQuery.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title={title} onBack={back} />
        <View className="gap-4">
          <Skeleton width="100%" height={52} radius="md" />
          <Skeleton width="100%" height={52} radius="md" />
          <Skeleton width="100%" height={52} radius="md" />
        </View>
      </Screen>
    );
  }

  if (isEdit && (categoryQuery.isError || !category)) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <ErrorState error={categoryQuery.error} onRetry={() => categoryQuery.refetch()} />
      </Screen>
    );
  }

  const fail = (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Could not save the category. Try again.');

  const onSubmit = (values: CategoryFormValues) => {
    const payload = toCategoryPayload(values);
    if (isEdit) {
      // A type that cannot change is not sent, so an unchanged form never trips the API's lock.
      const body = locked ? { ...payload, type: undefined } : payload;
      update.mutate(body, {
        onSuccess: () => {
          toast.success('Category updated');
          router.back();
        },
        onError: fail,
      });
      return;
    }
    create.mutate(payload, {
      onSuccess: () => {
        toast.success('Category added');
        router.back();
      },
      onError: fail,
    });
  };

  const switchOff = () => {
    update.mutate(
      { isActive: false },
      {
        onSuccess: () => {
          offRef.current?.dismiss();
          toast.success('Category switched off');
          router.back();
        },
        onError: (error) => {
          offRef.current?.dismiss();
          fail(error);
        },
      },
    );
  };

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title={title} onBack={back} docsKey="FN6" />

      <View className="gap-6 pb-6">
        <Section title="The category">
          <View className="gap-4">
            <TextField control={control} name="name" label="Name" placeholder="Monthly dues" autoCapitalize="sentences" testID="category-name" />
            {locked ? (
              <View className="gap-1">
                <Text variant="label">Type</Text>
                <Text variant="body">{CATEGORY_KIND_SINGULAR[type as CategoryKind] ?? type}</Text>
                <Text variant="caption" tone="secondary">
                  {`The type can't change because ${category?.usageCount} ${category?.usageCount === 1 ? 'charge or campaign uses' : 'charges and campaigns use'} this category.`}
                </Text>
              </View>
            ) : (
              <SelectSheet control={control} name="type" label="Type" options={KIND_OPTIONS} placeholder="Choose the type" testID="category-type" />
            )}
            <TextField control={control} name="description" label="Description (optional)" multiline />
          </View>
        </Section>

        <Section title="Default charge">
          <View className="gap-4">
            <AmountField control={control} name="amount" label="Amount (optional)" helper="What a charge of this kind starts at. Changing it only affects charges raised afterwards." presets={[1000, 5000, 10000, 20000]} />
            <SelectSheet control={control} name="frequency" label="How often" options={FREQUENCY_OPTIONS} placeholder="Choose how often" />
          </View>
        </Section>

        {isEdit ? (
          <Section title="Status">
            <Switch control={control} name="isActive" label="Active" helper="A switched-off category can't be chosen for new charges. Charges already raised are not affected." />
          </Section>
        ) : null}

        {isEdit && category?.isActive ? (
          <Button variant="danger" onPress={() => offRef.current?.present()} testID="category-off">
            Switch this category off
          </Button>
        ) : null}
      </View>

      <StickyFooter>
        <View className="flex-1">
          <Button variant="primary" fullWidth loading={create.isPending || update.isPending} onPress={() => { void handleSubmit(onSubmit)(); }} testID="category-save">
            {isEdit ? 'Save changes' : 'Add category'}
          </Button>
        </View>
      </StickyFooter>

      <ConfirmSheet
        ref={offRef}
        title="Switch this category off?"
        description="It can't be chosen for new charges any more. It won't switch off while members still owe charges of this kind."
        confirmLabel="Switch off"
        onConfirm={switchOff}
      />
    </Screen>
  );
}
