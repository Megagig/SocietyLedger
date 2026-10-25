import type { ReactNode } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { ONBOARDING_STEPS, type OnboardingStepKey } from '@societyledger/shared';

import { StickyFooter } from '@/components/layout/StickyFooter';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Text } from '@/components/ui/Text';
import { SETUP_HREF } from '@/features/session/landing';
import { STEP_DOCS_KEY } from '../steps';

export type StepFrameProps = {
  stepKey: OnboardingStepKey;
  title: string;
  description: string;
  children: ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  primaryLoading?: boolean;
  primaryDisabled?: boolean;
  /** "Skip this step" — leave it out on the last step. */
  onSkip?: () => void;
  skipLoading?: boolean;
};

/** The frame every setup step shares: header, "Step n of 5" with a progress bar, the step's own content, and the sticky Continue / Skip row. */
export function StepFrame({
  stepKey,
  title,
  description,
  children,
  primaryLabel,
  onPrimary,
  primaryLoading = false,
  primaryDisabled = false,
  onSkip,
  skipLoading = false,
}: StepFrameProps) {
  const step = ONBOARDING_STEPS.find((s) => s.key === stepKey);
  const position = step?.id ?? 1;

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title={title} onBack={() => router.replace(SETUP_HREF)} docsKey={STEP_DOCS_KEY[stepKey]} />
      <View className="gap-2 pb-4">
        <Text variant="caption" tone="secondary">{`Step ${position} of ${ONBOARDING_STEPS.length}`}</Text>
        <ProgressBar percent={(position / ONBOARDING_STEPS.length) * 100} label={`Step ${position} of ${ONBOARDING_STEPS.length}`} />
        <Text variant="body" tone="secondary" className="mt-2">
          {description}
        </Text>
      </View>
      <View className="gap-6 pb-6">{children}</View>
      <StickyFooter>
        {onSkip ? (
          <View className="flex-1">
            <Button variant="secondary" fullWidth loading={skipLoading} disabled={primaryLoading} onPress={onSkip} testID="setup-skip-step">
              Skip this step
            </Button>
          </View>
        ) : null}
        <View className="flex-1">
          <Button variant="primary" fullWidth loading={primaryLoading} disabled={primaryDisabled || skipLoading} onPress={onPrimary} testID="setup-continue">
            {primaryLabel}
          </Button>
        </View>
      </StickyFooter>
    </Screen>
  );
}
