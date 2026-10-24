import { useRouter } from 'expo-router';
import { FileText, Plus } from 'lucide-react-native';
import { useMemo } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { IconButton } from '@/components/ui/IconButton';
import { TemplateRow } from '@/features/communication/components/Rows';
import { COMMUNICATION_MODULE, SMS_TEMPLATE_ACCESS, SMS_VIEW_ACCESS } from '@/features/communication/labels';
import { useTemplatesInfinite } from '@/features/communication/queries';
import { positionOf } from '@/features/financeSetup/components/GroupedRow';
import { PagedList } from '@/features/financeSetup/components/PagedList';
import { useCan } from '@/hooks/useCan';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import type { SmsTemplateDTO } from '@/types/api/communication';

/** project-overview.md §6.9 CM5 — message wordings kept to use again: payment reminders, meeting notices and the like. */
export default function TemplatesScreen() {
  const router = useRouter();
  const allowed = useModuleAccess([SMS_TEMPLATE_ACCESS, SMS_VIEW_ACCESS], COMMUNICATION_MODULE);
  const canManage = useCan(SMS_TEMPLATE_ACCESS);
  const query = useTemplatesInfinite();
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.templates) ?? [], [query.data]);
  const back = () => router.back();
  const open = (id?: number) => router.push((id ? `/(app)/(tabs)/manage/communication/template-form?id=${id}` : '/(app)/(tabs)/manage/communication/template-form') as never);

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Message templates" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader
        title="Message templates"
        onBack={back}
        docsKey="CM5"
        rightActions={canManage ? <IconButton icon={Plus} accessibilityLabel="Add a template" onPress={() => open()} testID="templates-new" /> : undefined}
      />
      <PagedList
        query={query}
        items={items}
        keyOf={(t) => String(t.id)}
        skeletonHeight={72}
        renderItem={(t: SmsTemplateDTO, i, n) => <TemplateRow item={t} position={positionOf(i, n)} onPress={canManage ? (item) => open(item.id) : undefined} />}
        empty={
          <EmptyState
            icon={FileText}
            title="No templates yet"
            description="A template is a message you use often, like a dues reminder. Use {name} to put a member’s name in."
            actionLabel={canManage ? 'Add a template' : undefined}
            onAction={canManage ? () => open() : undefined}
          />
        }
      />
    </Screen>
  );
}
