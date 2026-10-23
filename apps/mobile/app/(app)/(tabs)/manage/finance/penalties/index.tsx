import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import { Gavel, Plus, ScrollText, Scale } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ConfirmSheet } from '@/components/feedback/ConfirmSheet';
import { EmptyState } from '@/components/feedback/EmptyState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { StatTile } from '@/components/ui/StatTile';
import { Text } from '@/components/ui/Text';
import { RuleRow, WaiverRow } from '@/features/donationsPenalties/components/Rows';
import { penaltyCanWaive } from '@/features/donationsPenalties/labels';
import { useDeleteRule, useUpdateRule } from '@/features/donationsPenalties/mutations';
import { FINANCE_VIEW_ACCESS, FUND_CREATE_ACCESS, FUND_EDIT_ACCESS, PENALTY_APPROVE_ACCESS, RULE_DELETE_ACCESS, usePenaltyRules, usePenaltyStats, useWaivers } from '@/features/donationsPenalties/queries';
import { ChargeRow } from '@/features/finance/components/ChargeRow';
import { CHARGE_CREATE_ACCESS, useCharges } from '@/features/finance/queries';
import { CategoryRow } from '@/features/financeSetup/components/CategoryRow';
import { positionOf } from '@/features/financeSetup/components/GroupedRow';
import { PagedList } from '@/features/financeSetup/components/PagedList';
import { SETUP_CREATE_ACCESS, SETUP_EDIT_ACCESS, useCategories } from '@/features/financeSetup/queries';
import { useCan } from '@/hooks/useCan';
import { formatMoney } from '@/lib/money';
import type { ChargeListItemDTO } from '@/types/api/financeManage';
import type { PenaltyRuleDTO } from '@/types/api/donationsPenalties';
import type { CategoryDTO } from '@/types/api/financeSetup';

type Tab = 'types' | 'rules' | 'applied' | 'waivers';

/**
 * project-overview.md §6.9 FN11 — penalties: the kinds of penalty, the late-fee rules, the penalties charged, and the waivers granted.
 * Late fees only go to real overdue dues and levies, and are previewed before anyone is charged.
 */
export default function PenaltiesScreen() {
  const router = useRouter();
  const canView = useCan(FINANCE_VIEW_ACCESS);
  const canApprove = useCan(PENALTY_APPROVE_ACCESS);
  const canCreateType = useCan(SETUP_CREATE_ACCESS);
  const canEditType = useCan(SETUP_EDIT_ACCESS);
  const canCreateRule = useCan(FUND_CREATE_ACCESS);
  const canEditRule = useCan(FUND_EDIT_ACCESS);
  const canDeleteRule = useCan(RULE_DELETE_ACCESS);
  const canCharge = useCan(CHARGE_CREATE_ACCESS);
  const [tab, setTab] = useState<Tab>('types');
  const [pickedType, setPickedType] = useState<CategoryDTO | null>(null);
  const [pickedRule, setPickedRule] = useState<PenaltyRuleDTO | null>(null);
  const [pickedCharge, setPickedCharge] = useState<ChargeListItemDTO | null>(null);
  const typeSheetRef = useRef<BottomSheetModal>(null);
  const ruleSheetRef = useRef<BottomSheetModal>(null);
  const chargeSheetRef = useRef<BottomSheetModal>(null);
  const deleteRef = useRef<BottomSheetModal>(null);
  const stats = usePenaltyStats().data;
  const typesQuery = useCategories({ type: 'penalty' });
  const rulesQuery = usePenaltyRules();
  const appliedQuery = useCharges({ type: 'penalty' });
  const waiversQuery = useWaivers();
  const updateRule = useUpdateRule(pickedRule?.id ?? 0);
  const deleteRule = useDeleteRule();
  const types = useMemo(() => typesQuery.data?.pages.flatMap((p) => p.categories) ?? [], [typesQuery.data]);
  const rules = useMemo(() => rulesQuery.data?.pages.flatMap((p) => p.rules) ?? [], [rulesQuery.data]);
  const applied = useMemo(() => appliedQuery.data?.pages.flatMap((p) => p.transactions) ?? [], [appliedQuery.data]);
  const waivers = useMemo(() => waiversQuery.data?.pages.flatMap((p) => p.waivers) ?? [], [waiversQuery.data]);
  const back = () => router.back();
  const go = (path: string) => router.push(`/(app)/(tabs)/manage/finance/${path}` as never);

  if (!canView) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Penalties" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const canAdd = tab === 'types' ? canCreateType : tab === 'rules' ? canCreateRule : false;
  const addLabel = tab === 'types' ? 'Add a penalty type' : 'Add a late-fee rule';
  const onAdd = () => (tab === 'types' ? go('categories/form?type=penalty') : go('penalties/rule-form'));

  const toggleRule = () => {
    if (!pickedRule) return;
    updateRule.mutate(
      { isActive: !pickedRule.isActive },
      {
        onSuccess: () => {
          ruleSheetRef.current?.dismiss();
          toast.success(pickedRule.isActive ? 'Rule switched off' : 'Rule switched on');
        },
        onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not change the rule. Try again.'),
      },
    );
  };

  const removeRule = () => {
    if (!pickedRule) return;
    deleteRule.mutate(pickedRule.id, {
      onSuccess: () => {
        deleteRef.current?.dismiss();
        toast.success((pickedRule._count?.appliedPenalties ?? 0) > 0 ? 'Rule switched off — its history is kept' : 'Rule deleted');
      },
      onError: (error) => {
        deleteRef.current?.dismiss();
        toast.error(error instanceof ApiError ? error.message : 'Could not delete the rule. Try again.');
      },
    });
  };

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader
        title="Penalties"
        onBack={back}
        docsKey="FN11"
        rightActions={canAdd ? <IconButton icon={Plus} accessibilityLabel={addLabel} onPress={onAdd} testID="penalties-new" /> : undefined}
      />

      <View className="gap-3 pb-3">
        {stats ? (
          <View className="flex-row gap-2">
            <StatTile label="Charged" value={formatMoney(stats.penalties.totalAmount)} tone="info" />
            <StatTile label="Still owed" value={formatMoney(stats.penalties.totalOutstanding)} tone="warning" />
            <StatTile label="Waived" value={formatMoney(stats.waivers.totalWaived)} tone="success" />
          </View>
        ) : null}
        {canApprove ? (
          <Button variant="secondary" onPress={() => go('penalties/late-fees')} testID="penalties-apply">
            Apply late fees now
          </Button>
        ) : null}
        <SegmentedControl<Tab>
          options={[
            { label: 'Types', value: 'types' },
            { label: 'Rules', value: 'rules' },
            { label: 'Charged', value: 'applied' },
            { label: 'Waivers', value: 'waivers' },
          ]}
          value={tab}
          onChange={setTab}
          testID="penalties-tab"
        />
      </View>

      {tab === 'types' ? (
        <PagedList
          query={typesQuery}
          items={types}
          keyOf={(c) => String(c.id)}
          renderItem={(c, i, n) => (
            <CategoryRow
              category={c}
              position={positionOf(i, n)}
              onPress={canCharge || canEditType ? (type) => { setPickedType(type); typeSheetRef.current?.present(); } : undefined}
            />
          )}
          empty={
            <EmptyState
              icon={Gavel}
              title="No penalty types yet"
              description="A penalty type is a kind of fine, like a late-payment fee or a missed-meeting fine. Add one to charge it."
              actionLabel={canCreateType ? 'Add a penalty type' : undefined}
              onAction={canCreateType ? onAdd : undefined}
            />
          }
        />
      ) : tab === 'rules' ? (
        <PagedList
          query={rulesQuery}
          items={rules}
          keyOf={(r) => String(r.id)}
          skeletonHeight={88}
          renderItem={(r, i, n) => (
            <RuleRow item={r} position={positionOf(i, n)} onPress={canEditRule || canDeleteRule ? (rule) => { setPickedRule(rule); ruleSheetRef.current?.present(); } : undefined} />
          )}
          empty={
            <EmptyState
              icon={ScrollText}
              title="No late-fee rules yet"
              description="A rule adds a fee to a dues or levy charge that is overdue, after a grace period. Add one to start."
              actionLabel={canCreateRule ? 'Add a late-fee rule' : undefined}
              onAction={canCreateRule ? onAdd : undefined}
            />
          }
        />
      ) : tab === 'applied' ? (
        <PagedList
          query={appliedQuery}
          items={applied}
          keyOf={(c) => String(c.id)}
          renderItem={(c, i, n) => (
            <ChargeRow charge={c} position={positionOf(i, n)} onPress={(charge) => { setPickedCharge(charge); chargeSheetRef.current?.present(); }} />
          )}
          empty={<EmptyState icon={Scale} title="No penalties charged yet" description="Penalties charged to members, by a rule or by hand, show up here." />}
        />
      ) : (
        <PagedList
          query={waiversQuery}
          items={waivers}
          keyOf={(w) => String(w.id)}
          renderItem={(w, i, n) => <WaiverRow item={w} position={positionOf(i, n)} />}
          empty={<EmptyState icon={Scale} title="No waivers yet" description="When you forgive a penalty it is recorded here with the reason." />}
        />
      )}

      <BottomSheet ref={typeSheetRef} title={pickedType?.name ?? 'Penalty type'} snapPoints={['40%']}>
        <View className="gap-3 pb-6">
          {pickedType && canCharge && pickedType.isActive ? (
            <Button
              variant="primary"
              onPress={() => {
                typeSheetRef.current?.dismiss();
                go(`dues?categoryId=${pickedType.id}`);
              }}
              testID="penalty-type-charge"
            >
              Charge members
            </Button>
          ) : null}
          {pickedType && canEditType ? (
            <Button
              variant="secondary"
              onPress={() => {
                typeSheetRef.current?.dismiss();
                go(`categories/form?id=${pickedType.id}`);
              }}
              testID="penalty-type-edit"
            >
              Edit penalty type
            </Button>
          ) : null}
        </View>
      </BottomSheet>

      <BottomSheet ref={ruleSheetRef} title={pickedRule?.name ?? 'Rule'} snapPoints={['45%']}>
        <View className="gap-3 pb-6">
          {pickedRule && canEditRule ? (
            <>
              <Button
                variant="secondary"
                onPress={() => {
                  ruleSheetRef.current?.dismiss();
                  go(`penalties/rule-form?id=${pickedRule.id}`);
                }}
                testID="rule-edit"
              >
                Edit rule
              </Button>
              <Button variant="secondary" loading={updateRule.isPending} onPress={toggleRule} testID="rule-toggle">
                {pickedRule.isActive ? 'Switch off' : 'Switch on'}
              </Button>
            </>
          ) : null}
          {pickedRule && canDeleteRule ? (
            <Button
              variant="danger"
              onPress={() => {
                ruleSheetRef.current?.dismiss();
                deleteRef.current?.present();
              }}
              testID="rule-delete"
            >
              Delete rule
            </Button>
          ) : null}
        </View>
      </BottomSheet>

      <ConfirmSheet
        ref={deleteRef}
        title="Delete this rule?"
        description={
          (pickedRule?._count?.appliedPenalties ?? 0) > 0
            ? 'This rule has already charged members, so it is switched off instead of removed. The penalties it charged and their history stay.'
            : 'It is removed. No penalties have been charged by it.'
        }
        confirmLabel="Delete rule"
        onConfirm={removeRule}
      />

      <BottomSheet ref={chargeSheetRef} title="Penalty" snapPoints={['40%']}>
        <View className="gap-3 pb-6">
          {pickedCharge && canApprove && penaltyCanWaive(pickedCharge) ? (
            <Button
              variant="primary"
              onPress={() => {
                chargeSheetRef.current?.dismiss();
                go(`penalties/waive?id=${pickedCharge.id}`);
              }}
              testID="penalty-waive"
            >
              Waive this penalty
            </Button>
          ) : null}
          {pickedCharge ? (
            <Button
              variant="secondary"
              onPress={() => {
                chargeSheetRef.current?.dismiss();
                go(`transactions/${pickedCharge.id}`);
              }}
              testID="penalty-open"
            >
              Open the charge
            </Button>
          ) : null}
          {pickedCharge && !penaltyCanWaive(pickedCharge) ? (
            <Text variant="caption" tone="secondary">
              Only a penalty that is still owed can be waived.
            </Text>
          ) : null}
        </View>
      </BottomSheet>
    </Screen>
  );
}
