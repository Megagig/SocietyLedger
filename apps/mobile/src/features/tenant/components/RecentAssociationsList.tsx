import { View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Text } from '@/components/ui/Text';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { t } from '@/lib/i18n';
import type { TenantSummary } from '@/stores/tenant';

export type RecentAssociationsListProps = {
  items: TenantSummary[];
  onSelect: (tenant: TenantSummary) => void;
};

/** A3 — "Recent associations list (max 5) as tappable cards." `stores/tenant.ts` already caps
 * `recent` at 5, most-recent-first. Picking one sets it current and continues straight to Login
 * without re-fetching — if its status changed server-side since it was last used, `/auth/login`
 * surfaces that through the tenant middleware the same way it would for a freshly-looked-up one. */
export function RecentAssociationsList({ items, onSelect }: RecentAssociationsListProps) {
  if (items.length === 0) return null;

  return (
    <View className="gap-2">
      <Text variant="label" tone="secondary">
        {t('auth.association.recentLabel')}
      </Text>
      <ListGroup>
        {items.map((item) => (
          <ListItem
            key={item.subdomain}
            leading={<Avatar name={item.name} shape="square" size={32} tintColor={item.primaryColor ?? undefined} />}
            title={item.name}
            meta={t('auth.association.domain', { subdomain: item.subdomain })}
            showChevron
            onPress={() => onSelect(item)}
          />
        ))}
      </ListGroup>
    </View>
  );
}
