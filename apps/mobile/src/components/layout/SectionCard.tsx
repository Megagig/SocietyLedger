import { Children, Fragment, type ReactNode } from 'react';
import { View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Divider } from '@/components/ui/Divider';
import { Text } from '@/components/ui/Text';

export type SectionCardProps = {
  title: string;
  /** Right-aligned slot in the header, typically a `Badge` ("2 Active"). */
  trailing?: ReactNode;
  /** Full-width rows (`ListItem`s) or a single `InlineEmpty`; hairline dividers are inserted between children. */
  children: ReactNode;
};

/** ui-registry.md — titled card used by the web-parity member screens (My Voting, Welfare): title + trailing badge, then ledger rows (ui-rules.md §1 rule #2 — rows, not nested cards). */
export function SectionCard({ title, trailing, children }: SectionCardProps) {
  const items = Children.toArray(children).filter(Boolean);

  return (
    <Card noPadding>
      <View className="flex-row items-center justify-between gap-2 px-4 pb-1 pt-4">
        <Text variant="h3" className="flex-1">
          {title}
        </Text>
        {trailing}
      </View>
      {items.map((child, index) => (
        <Fragment key={index}>
          {index > 0 ? <Divider /> : null}
          {child}
        </Fragment>
      ))}
    </Card>
  );
}
