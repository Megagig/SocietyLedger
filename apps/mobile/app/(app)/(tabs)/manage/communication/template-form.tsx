import { zodResolver } from '@hookform/resolvers/zod';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ConfirmSheet } from '@/components/feedback/ConfirmSheet';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { COMMUNICATION_MODULE, SMS_TEMPLATE_ACCESS, TEMPLATE_CATEGORY_OPTIONS } from '@/features/communication/labels';
import { useCreateTemplate, useDeleteTemplate, useUpdateTemplate } from '@/features/communication/mutations';
import { useTemplatesInfinite } from '@/features/communication/queries';
import { emptyTemplateValues, templateFormSchema, toTemplatePayload, type TemplateFormValues } from '@/features/communication/schemas';
import { useModuleAccess } from '@/hooks/useModuleAccess';

/** project-overview.md §6.9 CM5 — add or change a message template. `{name}`-style words are filled in per member when it is used. */
export default function TemplateFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id ? Number(params.id) : undefined;
  const isEdit = editId !== undefined;
  const allowed = useModuleAccess(SMS_TEMPLATE_ACCESS, COMMUNICATION_MODULE);
  const templates = useTemplatesInfinite();
  const template = templates.data?.pages.flatMap((p) => p.templates).find((t) => t.id === editId);
  const create = useCreateTemplate();
  const update = useUpdateTemplate(editId ?? 0);
  const remove = useDeleteTemplate();
  const deleteRef = useRef<BottomSheetModal>(null);
  const { control, handleSubmit, reset } = useForm<TemplateFormValues>({ resolver: zodResolver(templateFormSchema), defaultValues: emptyTemplateValues(), mode: 'onTouched' });
  const back = () => router.back();
  const title = isEdit ? 'Edit template' : 'Add a template';

  useEffect(() => {
    if (template) reset({ name: template.name, content: template.content, category: template.category });
  }, [template, reset]);

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  if (isEdit && templates.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title={title} onBack={back} docsKey="CM5" />
        <View className="gap-4">
          <Skeleton width="100%" height={52} radius="md" />
          <Skeleton width="100%" height={120} radius="md" />
        </View>
      </Screen>
    );
  }

  if (isEdit && (templates.isError || !template)) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} docsKey="CM5" />
        <ErrorState error={templates.error} title={templates.isError ? undefined : 'Template not found'} onRetry={() => templates.refetch()} />
      </Screen>
    );
  }

  const fail = (fallback: string) => (error: unknown) => toast.error(error instanceof ApiError ? error.message : fallback);
  const done = (message: string) => ({
    onSuccess: () => {
      toast.success(message);
      router.back();
    },
    onError: fail('Could not save the template. Try again.'),
  });
  const submit = (values: TemplateFormValues) => {
    if (isEdit) update.mutate(toTemplatePayload(values), done('Template saved'));
    else create.mutate(toTemplatePayload(values), done('Template added'));
  };

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title={title} onBack={back} docsKey="CM5" />

      <View className="gap-6 pb-6">
        <Section title="The template">
          <View className="gap-4">
            <TextField control={control} name="name" label="Name" placeholder="Dues reminder" autoCapitalize="sentences" testID="template-name" />
            <SelectSheet control={control} name="category" label="Kind" options={TEMPLATE_CATEGORY_OPTIONS} placeholder="Choose" />
            <TextField
              control={control}
              name="content"
              label="Message"
              helper="Put {name} (or any word in braces) where the member’s own detail should go."
              multiline
              autoCapitalize="sentences"
              placeholder="Dear {name}, your dues are due."
              testID="template-content"
            />
          </View>
        </Section>
        {isEdit ? (
          <Button variant="danger" fullWidth loading={remove.isPending} onPress={() => deleteRef.current?.present()} testID="template-delete">
            Delete template
          </Button>
        ) : null}
      </View>

      <StickyFooter>
        <View className="flex-1">
          <Button
            variant="primary"
            fullWidth
            loading={create.isPending || update.isPending}
            onPress={() => {
              void handleSubmit(submit)();
            }}
            testID="template-save"
          >
            {isEdit ? 'Save changes' : 'Add template'}
          </Button>
        </View>
      </StickyFooter>

      <ConfirmSheet
        ref={deleteRef}
        title="Delete this template?"
        description="Campaigns that used it keep their own copy of the message."
        confirmLabel="Delete template"
        onConfirm={() => {
          deleteRef.current?.dismiss();
          remove.mutate(editId ?? 0, done('Template deleted'));
        }}
      />
    </Screen>
  );
}
