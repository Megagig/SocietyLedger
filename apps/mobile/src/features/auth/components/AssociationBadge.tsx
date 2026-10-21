import { Image } from 'expo-image';

import { Avatar } from '@/components/ui/Avatar';
import { ListItem } from '@/components/layout/ListItem';
import { resolveAssetUrl } from '@/lib/assets';
import { t } from '@/lib/i18n';
import type { TenantSummary } from '@/stores/tenant';

export type AssociationBadgeProps = {
  tenant: TenantSummary;
  onPress: () => void;
};

/** A4 — "Association card at top (tap to change)." A `ListItem` rather than a bespoke layout —
 * same leading-logo/title/chevron shape `RecentAssociationsList` already uses. */
export function AssociationBadge({ tenant, onPress }: AssociationBadgeProps) {
  const logoUrl = resolveAssetUrl(tenant.logo);

  return (
    <ListItem
      testID="association-badge"
      leading={
        logoUrl ? (
          <Image source={{ uri: logoUrl }} style={{ width: 32, height: 32, borderRadius: 6 }} contentFit="contain" />
        ) : (
          <Avatar name={tenant.name} shape="square" size={32} tintColor={tenant.primaryColor ?? undefined} />
        )
      }
      title={tenant.name}
      meta={t('auth.association.domain', { subdomain: tenant.subdomain })}
      showChevron
      onPress={onPress}
    />
  );
}
