import { View } from 'react-native';
import { Image } from 'expo-image';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { resolveAssetUrl } from '@/lib/assets';
import { t } from '@/lib/i18n';
import type { CheckSubdomainResponseDTO } from '@/types/api/associations';

export type AssociationConfirmationCardProps = {
  tenant: CheckSubdomainResponseDTO;
  onContinue: () => void;
};

/** A3 — "Debounced lookup shows a confirmation card with logo + name." `SUSPENDED` isn't an HTTP
 * error (`check-subdomain` still returns `success: true` for it, per `associations.controller.ts`
 * — only `CANCELLED` is rejected server-side), so this card is also where that state is rendered:
 * no Continue button, just the explanation. */
export function AssociationConfirmationCard({ tenant, onContinue }: AssociationConfirmationCardProps) {
  const logoUrl = resolveAssetUrl(tenant.logo);
  const isActive = tenant.status === 'ACTIVE';

  return (
    <Card testID="association-confirmation-card">
      <View className="flex-row items-center gap-3">
        {logoUrl ? (
          <Image source={{ uri: logoUrl }} style={{ width: 48, height: 48, borderRadius: 8 }} contentFit="contain" />
        ) : (
          <Avatar name={tenant.name} shape="square" size={40} tintColor={tenant.primaryColor ?? undefined} />
        )}
        <View className="flex-1">
          <Text variant="body-strong" numberOfLines={1}>
            {tenant.name}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {t('auth.association.domain', { subdomain: tenant.subdomain })}
          </Text>
        </View>
      </View>
      {isActive ? (
        <View className="mt-4">
          <Button fullWidth onPress={onContinue} testID="association-continue">
            {t('common.continue')}
          </Button>
        </View>
      ) : (
        <Text variant="caption" tone="danger" className="mt-3">
          {t('auth.association.suspended')}
        </Text>
      )}
    </Card>
  );
}
