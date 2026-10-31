import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Search } from 'lucide-react-native';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner-native';

import { ajoApi } from '@/api/endpoints/ajo';
import { ApiError } from '@/api/errors';
import { ErrorState } from '@/components/feedback/ErrorState';
import { InlineEmpty } from '@/components/feedback/InlineEmpty';
import { AmountField } from '@/components/forms/AmountField';
import { SearchField } from '@/components/forms/SearchField';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useTenantKey } from '@/hooks/useTenantKey';
import { formatKobo, nairaToKoboString } from '../format';
import { useAjoAction } from '../mutations';
import { ajoKeys } from '../queries';
import { AjoLoading } from './AjoStates';

export type AddPersonSheetHandle = { open: () => void };

/** Find an association member and add them to the circle. They still need the circle's approval. */
export const AddPersonSheet = forwardRef<AddPersonSheetHandle, { groupId: number; rotating: boolean; maxShares: number; /** Collector thrift: the group's smallest amount a saver can choose. */ minAmountKobo?: string }>(function AddPersonSheet({ groupId, rotating, maxShares, minAmountKobo }, ref) {
  const sheet = useRef<BottomSheetModal>(null);
  const tenant = useTenantKey();
  const [search, setSearch] = useState('');
  const [shares, setShares] = useState(1);
  // Collector thrift: what the saver chose to pay each time. Empty means the group's smallest.
  const amountForm = useForm<{ amount: string }>({ defaultValues: { amount: '' } });
  const [problem, setProblem] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  useImperativeHandle(
    ref,
    () => ({
      open: () => {
        setOpened(true);
        setProblem(null);
        sheet.current?.present();
      },
    }),
    [],
  );
  const people = useQuery({ queryKey: ajoKeys.staff(tenant, 'search', search), queryFn: () => ajoApi.searchPeople(search), enabled: opened, placeholderData: (previous) => previous });
  const add = useAjoAction((input: { memberId: number; amountKobo?: string }) => ajoApi.addMember(groupId, input.memberId, rotating ? shares : undefined, input.amountKobo));

  const choose = async (memberId: number, name: string) => {
    setProblem(null);
    let amountKobo: string | undefined;
    const typed = amountForm.getValues('amount').trim();
    if (!rotating && typed) {
      const kobo = nairaToKoboString(typed);
      if (!kobo) {
        setProblem('Enter the amount in naira, for example 500 or 1,500.');
        return;
      }
      amountKobo = kobo;
    }
    try {
      await add.mutateAsync({ memberId, amountKobo });
      amountForm.reset();
      toast.success(`${name} was added. They need the circle to approve them.`);
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'Could not add that person.');
    }
  };

  return (
    <BottomSheet ref={sheet} title="Add a person" snapPoints={['90%']} onDismiss={() => setOpened(false)}>
      <View className="gap-4 pb-6">
        <SearchField value={search} onChangeText={setSearch} placeholder="Name, member number or phone" testID="ajo-add-search" />
        {rotating ? (
          <View className="flex-row items-center justify-between gap-3 rounded-lg bg-surface-sunken p-3">
            <View className="flex-1">
              <Text variant="body-strong">Shares: {shares}</Text>
              <Text variant="caption" tone="secondary">
                A person with two shares pays twice each round and collects twice.
              </Text>
            </View>
            <Button size="sm" variant="secondary" disabled={shares <= 1} onPress={() => setShares((s) => Math.max(1, s - 1))} accessibilityLabel="Fewer shares">
              −
            </Button>
            <Button size="sm" variant="secondary" disabled={shares >= maxShares} onPress={() => setShares((s) => Math.min(maxShares, s + 1))} accessibilityLabel="More shares">
              +
            </Button>
          </View>
        ) : (
          <AmountField control={amountForm.control} name="amount" label="What this person will save each time" helper={`They choose it and keep it for the whole cycle. Leave empty for the smallest (${formatKobo(minAmountKobo)}).`} testID="ajo-add-amount" />
        )}
        {problem ? (
          <Text variant="body" tone="danger">
            {problem}
          </Text>
        ) : null}
        {people.isPending ? (
          <AjoLoading rows={2} />
        ) : people.isError ? (
          <ErrorState error={people.error} onRetry={() => people.refetch()} />
        ) : people.data.length > 0 ? (
          <View className="gap-2">
            {people.data.map((p) => (
              <View key={p.id} className="flex-row items-center justify-between gap-3 rounded-lg bg-surface-sunken p-3" testID={`ajo-person-${p.id}`}>
                <View className="flex-1">
                  <Text variant="body-strong">{p.name}</Text>
                  <Text variant="caption" tone="tertiary">
                    {p.memberNumber}
                    {p.phone ? ` · ${p.phone}` : ' · no phone yet'}
                    {p.hasLogin ? '' : ' · no login'}
                  </Text>
                </View>
                <Button size="sm" variant="soft" loading={add.isPending && add.variables?.memberId === p.id} onPress={() => void choose(p.id, p.name)} testID={`ajo-add-${p.id}`}>
                  Add
                </Button>
              </View>
            ))}
          </View>
        ) : (
          <InlineEmpty icon={Search} message="Nobody matches. Only active association members can be added." />
        )}
      </View>
    </BottomSheet>
  );
});
