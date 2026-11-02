import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import { Layers, PiggyBank, Wallet } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Switch as NativeSwitch, View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconCircle } from '@/components/ui/IconCircle';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { AccountTypeSheet, LoanCategorySheet } from '@/features/coopEnhanced/components/TypeSheets';
import { ACCOUNT_CLASS_LABELS } from '@/features/coopEnhanced/labels';
import { COOP_MODULE, useAccountTypesV2, useCoopSettings, useLoanCategoriesV2, useSaveAccountTypeV2, useSaveCoopSettings, useSaveLoanCategoryV2 } from '@/features/coopEnhanced/queries';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { formatMoney } from '@/lib/money';
import type { CoopAccountTypeDTO, CoopLoanCategoryDTO } from '@/types/api/coopEnhanced';

/**
 * Cooperative setup: the savings types and loan categories your members see, and how withdrawals are approved. Nothing here is fixed in the
 * app: an officer creates the types their cooperative uses ("Christmas savings", "Emergency loan"), each with one behaviour class that decides
 * what it can do. Once members hold money in a type, its class can't change, so the rules never change under them.
 */
export default function CooperativeSetupScreen() {
  const router = useRouter();
  const allowed = useModuleAccess('COOPERATIVE_MANAGE_TYPES', COOP_MODULE);
  const types = useAccountTypesV2(true, allowed);
  const categories = useLoanCategoriesV2(true, allowed);
  const settings = useCoopSettings();
  const saveType = useSaveAccountTypeV2();
  const saveCategory = useSaveLoanCategoryV2();
  const saveSettings = useSaveCoopSettings();
  const typeRef = useRef<BottomSheetModal>(null);
  const categoryRef = useRef<BottomSheetModal>(null);
  const [editingType, setEditingType] = useState<CoopAccountTypeDTO | null>(null);
  const [editingCategory, setEditingCategory] = useState<CoopLoanCategoryDTO | null>(null);
  const back = () => router.back();

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Cooperative setup" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const fail = (error: unknown, fallback: string) => toast.error(error instanceof ApiError ? error.message : fallback);

  const openType = (t: CoopAccountTypeDTO | null) => {
    setEditingType(t);
    typeRef.current?.present();
  };
  const openCategory = (c: CoopLoanCategoryDTO | null) => {
    setEditingCategory(c);
    categoryRef.current?.present();
  };

  return (
    <Screen edges={['top']} refreshing={types.isRefetching || categories.isRefetching} onRefresh={() => { void types.refetch(); void categories.refetch(); void settings.refetch(); }}>
      <ScreenHeader title="Cooperative setup" onBack={back} />
      <View className="gap-6 pb-8">
        <Text variant="body" tone="secondary">
          The savings types and loan categories your members see, and how withdrawals are approved.
        </Text>

        <Section title="Savings account types">
          {types.isPending ? (
            <Skeleton width="100%" height={120} radius="lg" />
          ) : types.isError ? (
            <ErrorState error={types.error} onRetry={() => types.refetch()} />
          ) : (
            <>
              <ListGroup>
                {(types.data ?? []).map((t) => (
                  <ListItem
                    key={t.id}
                    leading={<IconCircle icon={PiggyBank} tone={t.isActive ? 'primary' : 'neutral'} />}
                    title={t.name}
                    meta={`${ACCOUNT_CLASS_LABELS[t.accountClass]}${t.isWithdrawable ? '' : ' · not withdrawable'}${t.monthlyWithdrawalLimit ? ` · limit ${formatMoney(t.monthlyWithdrawalLimit)}/month` : ''} · ${t.accountCount ?? 0} account${(t.accountCount ?? 0) === 1 ? '' : 's'}`}
                    trailing={t.isActive ? undefined : <Badge tone="neutral">Retired</Badge>}
                    showChevron
                    onPress={() => openType(t)}
                    testID={`type-${t.id}`}
                  />
                ))}
              </ListGroup>
              <View className="mt-3 flex-row">
                <Button variant="secondary" size="sm" onPress={() => openType(null)} testID="type-new">
                  New account type
                </Button>
              </View>
            </>
          )}
        </Section>

        <Section title="Loan categories">
          {categories.isPending ? (
            <Skeleton width="100%" height={100} radius="lg" />
          ) : categories.isError ? (
            <ErrorState error={categories.error} onRetry={() => categories.refetch()} />
          ) : (
            <>
              <ListGroup>
                {(categories.data ?? []).map((c) => (
                  <ListItem
                    key={c.id}
                    leading={<IconCircle icon={c.isGoods ? Layers : Wallet} tone={c.isActive ? 'primary' : 'neutral'} />}
                    title={c.name}
                    meta={`${c.isGoods ? 'Goods' : 'Cash'} · ${c.productCount ?? 0} loan product${(c.productCount ?? 0) === 1 ? '' : 's'}`}
                    trailing={c.isActive ? undefined : <Badge tone="neutral">Retired</Badge>}
                    showChevron
                    onPress={() => openCategory(c)}
                    testID={`category-${c.id}`}
                  />
                ))}
              </ListGroup>
              <View className="mt-3 flex-row">
                <Button variant="secondary" size="sm" onPress={() => openCategory(null)} testID="category-new">
                  New loan category
                </Button>
              </View>
            </>
          )}
        </Section>

        <Section title="Withdrawal approval">
          <Card>
            {settings.isPending ? (
              <Skeleton width="100%" height={48} radius="md" />
            ) : settings.isError || !settings.data ? (
              <ErrorState error={settings.error} onRetry={() => settings.refetch()} />
            ) : (
              <>
                <View className="flex-row items-center justify-between gap-3">
                  <Text variant="body-strong" className="flex-1">
                    Require two-stage approval for withdrawals
                  </Text>
                  <NativeSwitch
                    value={settings.data.requireTwoStageWithdrawal}
                    disabled={saveSettings.isPending}
                    accessibilityLabel="Require two-stage approval for withdrawals"
                    onValueChange={(value) =>
                      saveSettings.mutate(
                        { requireTwoStageWithdrawal: value },
                        {
                          onSuccess: () => toast.success(value ? 'Withdrawals now need a review and a separate approval' : 'Withdrawals now need one officer’s approval'),
                          onError: (e) => fail(e, 'Could not save the setting. Try again.'),
                        },
                      )
                    }
                    testID="setting-two-stage"
                  />
                </View>
                <Text variant="caption" tone="secondary" className="mt-2">
                  {settings.data.requireTwoStageWithdrawal
                    ? 'One officer reviews each request, and a different officer approves and pays it. The member, the reviewer and the approver are always three different people.'
                    : 'One officer decides each request. Use this only if your cooperative has too few officers to staff two stages. A request already waiting keeps the rule it was made under.'}
                </Text>
              </>
            )}
          </Card>
        </Section>
      </View>

      <AccountTypeSheet
        ref={typeRef}
        editing={editingType}
        loading={saveType.isPending}
        onSave={(id, body) => {
          if (body.name.length < 2) return toast.error('Give the account type a name');
          saveType.mutate({ id, body }, { onSuccess: () => { typeRef.current?.dismiss(); toast.success(id ? 'Account type updated' : 'Account type created'); }, onError: (e) => fail(e, 'Could not save the account type. Try again.') });
        }}
      />
      <LoanCategorySheet
        ref={categoryRef}
        editing={editingCategory}
        loading={saveCategory.isPending}
        onSave={(id, body) => {
          if (body.name.length < 2) return toast.error('Give the category a name');
          saveCategory.mutate({ id, body }, { onSuccess: () => { categoryRef.current?.dismiss(); toast.success(id ? 'Loan category updated' : 'Loan category created'); }, onError: (e) => fail(e, 'Could not save the loan category. Try again.') });
        }}
      />
    </Screen>
  );
}
