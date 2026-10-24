import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { zodResolver } from '@hookform/resolvers/zod';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Pressable, View } from 'react-native';

import { TextField } from '@/components/forms/TextField';
import { SearchField } from '@/components/forms/SearchField';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import type { CandidateMemberDTO } from '@/types/api/electionsManage';
import { useCandidateMemberSearch } from '../queries';
import {
  candidateSchema,
  pollOptionSchema,
  positionSchema,
  type CandidateValues,
  type PollOptionValues,
  type PositionValues,
} from '../schemas';

/**
 * Pick a member to put forward, then add a manifesto if they have one. The committee can't list members, so the search goes through
 * the voting module. Whoever is added is waiting for a decision from another committee member.
 */
export const CandidateSheet = forwardRef<BottomSheetModal, { positionTitle?: string; enabled: boolean; loading: boolean; onAdd: (member: CandidateMemberDTO, manifesto: string) => void; onDismiss?: () => void }>(
  function CandidateSheet({ positionTitle, enabled, loading, onAdd, onDismiss }, ref) {
    const localRef = useRef<BottomSheetModal>(null);
    useImperativeHandle(ref, () => localRef.current as BottomSheetModal, []);
    const [search, setSearch] = useState('');
    const [picked, setPicked] = useState<CandidateMemberDTO | null>(null);
    const query = useCandidateMemberSearch(search, enabled);
    const { control, handleSubmit, reset } = useForm<CandidateValues>({ resolver: zodResolver(candidateSchema), defaultValues: { manifesto: '' }, mode: 'onTouched' });

    const close = () => {
      setSearch('');
      setPicked(null);
      reset();
      onDismiss?.();
    };

    return (
      <BottomSheet ref={localRef} title={picked ? 'Add this candidate' : 'Choose a member'} snapPoints={['75%']} onDismiss={close}>
        {picked ? (
          <View className="gap-4 pb-6">
            <View className="gap-0.5">
              <Text variant="body-lg">{`${picked.firstName} ${picked.lastName}`}</Text>
              <Text variant="caption" tone="secondary">
                {positionTitle ? `${picked.memberId} · standing for ${positionTitle}` : picked.memberId}
              </Text>
            </View>
            <TextField control={control} name="manifesto" label="Manifesto (optional)" placeholder="What they stand for" multiline autoCapitalize="sentences" testID="candidate-manifesto" />
            <Text variant="caption" tone="secondary">
              They will be waiting for approval from another member of the committee.
            </Text>
            <View className="flex-row gap-3">
              <Button variant="secondary" fullWidth onPress={() => setPicked(null)}>
                Someone else
              </Button>
              <Button variant="primary" fullWidth loading={loading} onPress={() => { void handleSubmit((v) => onAdd(picked, v.manifesto.trim()))(); }} testID="candidate-add">
                Add candidate
              </Button>
            </View>
          </View>
        ) : (
          <View className="gap-3 pb-6">
            <SearchField value={search} onChangeText={setSearch} placeholder="Search name or member number" />
            {query.isPending ? (
              <View className="items-center py-6">
                <Spinner />
              </View>
            ) : query.isError ? (
              <Text variant="caption" tone="secondary">
                We couldn&apos;t load the members. Try again.
              </Text>
            ) : query.data.length === 0 ? (
              <Text variant="caption" tone="secondary">
                {search.trim() ? 'No active members match.' : 'There are no active members.'}
              </Text>
            ) : (
              query.data.map((member) => (
                <Pressable
                  key={member.id}
                  onPress={() => setPicked(member)}
                  accessibilityRole="button"
                  accessibilityLabel={`${member.firstName} ${member.lastName}`}
                  className="min-h-[52px] justify-center px-1 py-2"
                  testID={`pick-candidate-${member.id}`}
                >
                  <Text variant="body-lg" numberOfLines={1}>{`${member.firstName} ${member.lastName}`}</Text>
                  <Text variant="caption" tone="secondary" numberOfLines={1}>
                    {member.memberId}
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        )}
      </BottomSheet>
    );
  },
);

/** A position (President, Secretary…): its title and, if useful, what it does. Used to add one and to rename one. */
export const PositionSheet = forwardRef<BottomSheetModal, { initial?: { title: string; description: string | null }; loading: boolean; onSave: (values: PositionValues) => void; onDismiss?: () => void }>(
  function PositionSheet({ initial, loading, onSave, onDismiss }, ref) {
    const localRef = useRef<BottomSheetModal>(null);
    useImperativeHandle(ref, () => localRef.current as BottomSheetModal, []);
    const { control, handleSubmit, reset } = useForm<PositionValues>({ resolver: zodResolver(positionSchema), defaultValues: { title: '', description: '' }, mode: 'onTouched' });

    useEffect(() => {
      reset({ title: initial?.title ?? '', description: initial?.description ?? '' });
    }, [initial, reset]);

    return (
      <BottomSheet ref={localRef} title={initial ? 'Change this position' : 'Add a position'} snapPoints={['65%']} onDismiss={onDismiss}>
        <View className="gap-4 pb-6">
          <TextField control={control} name="title" label="Position" placeholder="President" autoCapitalize="words" testID="position-title" />
          <TextField control={control} name="description" label="What it involves (optional)" multiline autoCapitalize="sentences" />
          <Button variant="primary" fullWidth loading={loading} onPress={() => { void handleSubmit(onSave)(); }} testID="position-save">
            {initial ? 'Save position' : 'Add position'}
          </Button>
        </View>
      </BottomSheet>
    );
  },
);

/** One more answer for a poll that has not started. */
export const PollOptionSheet = forwardRef<BottomSheetModal, { loading: boolean; onSave: (values: PollOptionValues) => void }>(function PollOptionSheet({ loading, onSave }, ref) {
  const localRef = useRef<BottomSheetModal>(null);
  useImperativeHandle(ref, () => localRef.current as BottomSheetModal, []);
  const { control, handleSubmit, reset } = useForm<PollOptionValues>({ resolver: zodResolver(pollOptionSchema), defaultValues: { optionText: '' }, mode: 'onTouched' });

  return (
    <BottomSheet ref={localRef} title="Add an answer" snapPoints={['45%']} onDismiss={() => reset()}>
      <View className="gap-4 pb-6">
        <TextField control={control} name="optionText" label="Answer" placeholder="Saturday mornings" autoCapitalize="sentences" testID="option-text" />
        <Button variant="primary" fullWidth loading={loading} onPress={() => { void handleSubmit((v) => { onSave(v); reset(); })(); }} testID="option-save">
          Add answer
        </Button>
      </View>
    </BottomSheet>
  );
});
