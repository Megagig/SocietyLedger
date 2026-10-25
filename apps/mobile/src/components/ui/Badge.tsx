import { View } from 'react-native';

import { Text } from '@/components/ui/Text';

export type BadgeTone = 'neutral' | 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

const TONE_CLASSES: Record<BadgeTone, { container: string; text: string }> = {
  neutral: { container: 'bg-surface-sunken', text: 'text-text-secondary' },
  primary: { container: 'bg-primary-soft', text: 'text-on-primary-soft' },
  accent: { container: 'bg-accent-soft', text: 'text-accent-text' },
  success: { container: 'bg-success-soft', text: 'text-success' },
  warning: { container: 'bg-warning-soft', text: 'text-warning' },
  danger: { container: 'bg-danger-soft', text: 'text-danger' },
  info: { container: 'bg-info-soft', text: 'text-info' },
};

export type LabelBadgeProps = {
  variant?: 'label';
  tone?: BadgeTone;
  children: string;
  testID?: string;
};

export type CountBadgeProps = {
  variant: 'count';
  /** ui-rules.md §5.5 — min 18dp circle, danger fill, "99+" cap. */
  count: number;
  testID?: string;
};

export type DotBadgeProps = {
  variant: 'dot';
  testID?: string;
};

export type BadgeProps = LabelBadgeProps | CountBadgeProps | DotBadgeProps;

export function Badge(props: BadgeProps) {
  if (props.variant === 'count') {
    if (props.count <= 0) return null;
    const display = props.count > 99 ? '99+' : String(props.count);
    return (
      <View testID={props.testID} className="h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1">
        <Text variant="micro" tone="inverse">
          {display}
        </Text>
      </View>
    );
  }

  if (props.variant === 'dot') {
    return <View testID={props.testID} className="h-2 w-2 rounded-full bg-accent" />;
  }

  const toneClasses = TONE_CLASSES[props.tone ?? 'neutral'];
  return (
    <View testID={props.testID} className={['h-6 flex-row items-center self-start rounded-sm px-2', toneClasses.container].join(' ')}>
      <Text variant="micro" className={toneClasses.text}>
        {props.children}
      </Text>
    </View>
  );
}
