import { useRouter } from 'expo-router';
import { Plus, ScrollText } from 'lucide-react-native';
import { useMemo } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { IconButton } from '@/components/ui/IconButton';
import { ProductRow } from '@/features/coopManage/components/Rows';
import { COOP_LOANS_ACCESS, COOP_MODULE, useLoanProducts } from '@/features/coopManage/queries';
import { positionOf } from '@/features/financeSetup/components/GroupedRow';
import { PagedList } from '@/features/financeSetup/components/PagedList';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import type { OfficerLoanProductDTO } from '@/types/api/coopManage';

/** project-overview.md §6.9 CP3 — the loan products members can apply for: rate, tenure, limits and guarantors. */
export default function ProductsScreen() {
  const router = useRouter();
  const allowed = useModuleAccess(COOP_LOANS_ACCESS, COOP_MODULE);
  const query = useLoanProducts();
  const products = useMemo(() => query.data?.pages.flatMap((p) => p.products) ?? [], [query.data]);
  const back = () => router.back();
  const go = (path: string) => router.push(`/(app)/(tabs)/manage/cooperatives/products/${path}` as never);

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Loan products" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader title="Loan products" onBack={back} docsKey="CP3" rightActions={<IconButton icon={Plus} accessibilityLabel="Add a loan product" onPress={() => go('form')} testID="products-new" />} />

      <PagedList
        query={query}
        items={products}
        keyOf={(p) => String(p.id)}
        skeletonHeight={84}
        renderItem={(p: OfficerLoanProductDTO, i, n) => <ProductRow item={p} position={positionOf(i, n)} onPress={(product) => go(`form?id=${product.id}`)} />}
        empty={<EmptyState icon={ScrollText} title="No loan products yet" description="A product sets the rate, tenure, limits and guarantors for a kind of loan. Add one so members can apply." actionLabel="Add a loan product" onAction={() => go('form')} />}
      />
    </Screen>
  );
}
