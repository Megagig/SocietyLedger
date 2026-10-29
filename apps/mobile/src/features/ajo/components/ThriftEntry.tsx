import { useRouter } from 'expo-router';
import { PiggyBank } from 'lucide-react-native';

import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Section } from '@/components/layout/Section';
import { Badge } from '@/components/ui/Badge';
import { IconCircle } from '@/components/ui/IconCircle';
import { formatKobo, koboPositive } from '../format';
import { useMyMemberships } from '../queries';
import { useAjoNav } from '../useAjoNav';

/**
 * The "My thrift" entry on Home and Money. Shown to anyone who holds the contributor permission. When the add-on is not on the
 * account the entry still shows, marked "Locked", and the screen explains why — so people can find out instead of wondering.
 */
export function ThriftEntry() {
  const router = useRouter();
  const nav = useAjoNav();
  const mine = useMyMemberships(nav.member && !nav.locked);
  if (!nav.member) return null;

  const memberships = mine.data ?? [];
  const overdue = memberships.reduce((sum, m) => sum + (koboPositive(m.overdueKobo) ? BigInt(m.overdueKobo) : BigInt(0)), BigInt(0));
  const meta = nav.locked
    ? 'Not part of your association’s plan'
    : overdue > BigInt(0)
      ? `${formatKobo(overdue)} overdue`
      : memberships.length > 0
        ? `${memberships.length} ${memberships.length === 1 ? 'circle' : 'circles'}`
        : 'Your savings circles, what you owe and when you collect';

  return (
    <Section title="Thrift">
      <ListGroup>
        <ListItem
          leading={<IconCircle icon={PiggyBank} tone={overdue > BigInt(0) ? 'warning' : 'primary'} />}
          title="My thrift"
          meta={meta}
          trailing={nav.locked ? <Badge tone="neutral">Locked</Badge> : undefined}
          showChevron
          onPress={() => router.push('/(app)/(tabs)/money/thrift' as never)}
          testID="thrift-entry"
        />
      </ListGroup>
    </Section>
  );
}
