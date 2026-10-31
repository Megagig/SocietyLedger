import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import type { GroupListItemDTO } from '@/types/api/ajo';
import { formatKobo, frequencyText, MODEL_LABEL } from '../../format';
import { AjoStatusBadge } from '../AjoStatusBadge';
import { GroupWizard } from '../GroupWizard';
import { TickRow } from '../TickRow';

/**
 * Step 2: the first circle, made with the same wizard as Ajo's "New circle". If the admin already has one (they skipped earlier and came
 * back) they are asked whether to use it, so setup never makes a second circle by accident.
 */
export function StepCircle({
  existing,
  chosenId,
  onChoose,
  onCreated,
  onSkip,
}: {
  existing: GroupListItemDTO[];
  chosenId: number | null;
  onChoose: (id: number) => void;
  onCreated: (id: number) => Promise<void>;
  onSkip: () => Promise<void>;
}) {
  const [makingAnother, setMakingAnother] = useState(false);
  const [busy, setBusy] = useState(false);
  const usable = existing.filter((g) => g.status !== 'CANCELLED' && g.status !== 'COMPLETED');
  const current = usable.find((g) => g.id === chosenId) ?? usable[0];

  if (current && !makingAnother) {
    return (
      <View className="gap-4" testID="ajo-step-circle">
        <Card>
          <View className="gap-2">
            <Text variant="caption" tone="secondary">
              You already have
            </Text>
            <View className="flex-row flex-wrap items-center gap-2">
              <Text variant="h3">{current.name}</Text>
              <AjoStatusBadge status={current.status} />
            </View>
            <Text variant="caption" tone="secondary">
              {MODEL_LABEL[current.model]} · {frequencyText(current)} · {formatKobo(current.contributionKobo)} each
            </Text>
          </View>
        </Card>
        {usable.length > 1 ? (
          <View className="gap-2">
            <Text variant="label" tone="secondary">
              Choose a circle
            </Text>
            {usable.map((g) => (
              <TickRow key={g.id} label={g.name} checked={g.id === current.id} onToggle={() => onChoose(g.id)} />
            ))}
          </View>
        ) : null}
        <View className="flex-row gap-3">
          <Button variant="secondary" fullWidth onPress={() => setMakingAnother(true)}>
            Create another circle
          </Button>
          <Button
            fullWidth
            loading={busy}
            onPress={() => {
              setBusy(true);
              void onCreated(current.id).finally(() => setBusy(false));
            }}
            testID="ajo-circle-use"
          >
            {`Use ${current.name}`}
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View className="gap-4" testID="ajo-step-circle-new">
      <GroupWizard
        examples
        onCreated={(g) => {
          setMakingAnother(false);
          void onCreated(g.id);
        }}
      />
      <View className="gap-2">
        {current ? (
          <Button variant="ghost" onPress={() => setMakingAnother(false)}>
            Use the circle I already have
          </Button>
        ) : null}
        <Button
          variant="ghost"
          disabled={busy}
          onPress={() => {
            setBusy(true);
            void onSkip().finally(() => setBusy(false));
          }}
          testID="ajo-circle-skip"
        >
          Skip this step
        </Button>
      </View>
    </View>
  );
}
