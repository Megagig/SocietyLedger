import { memo } from 'react';
import { View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Money } from '@/components/ui/Money';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { ACCOUNT_TYPE_LABELS } from '@/features/cooperatives/labels';
import { GroupedRow, type RowPosition } from '@/features/financeSetup/components/GroupedRow';
import { formatDate } from '@/lib/dates';
import type { OfficerApplicationDTO, OfficerLoanDTO, OfficerLoanProductDTO, OfficerSavingsAccountDTO } from '@/types/api/coopManage';
import { APPLICATION_STATUS_LABELS, applicationStatusKey, guarantorSummary, LOAN_STATUS_LABELS, loanPercentRepaid, loanStatusKey, productTermsLine } from '../labels';

type RowProps<T> = { item: T; position: RowPosition; onPress?: (item: T) => void };

/** One savings account: whose it is, its number and kind, and the balance. A closed or dormant one says so. */
function AccountRowBase({ item, position, onPress }: RowProps<OfficerSavingsAccountDTO>) {
  return (
    <GroupedRow
      position={position}
      onPress={onPress ? () => onPress(item) : undefined}
      accessibilityLabel={`${item.memberName}, ${item.accountNumber}`}
      testID={`account-row-${item.id}`}
    >
      <View className="flex-row items-center">
        <View className="flex-1 gap-0.5">
          <Text variant="body-lg" numberOfLines={1}>
            {item.memberName}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {`${item.accountNumber} · ${ACCOUNT_TYPE_LABELS[item.accountType]}`}
          </Text>
        </View>
        <View className="ml-3 items-end gap-1">
          <Money value={item.balance} size="body-strong" />
          {item.status === 'ACTIVE' ? null : <Badge tone="neutral">{item.status.charAt(0) + item.status.slice(1).toLowerCase()}</Badge>}
        </View>
      </View>
    </GroupedRow>
  );
}
export const AccountRow = memo(AccountRowBase);

/** One loan application: the applicant, the product and amount, how many guarantors accepted, and where it stands. */
function ApplicationRowBase({ item, position, onPress }: RowProps<OfficerApplicationDTO>) {
  return (
    <GroupedRow
      position={position}
      onPress={onPress ? () => onPress(item) : undefined}
      accessibilityLabel={`${item.memberName}, ${item.loanProductName}, ${APPLICATION_STATUS_LABELS[item.status]}`}
      testID={`application-row-${item.id}`}
      minHeight={84}
    >
      <View className="flex-row items-center">
        <View className="flex-1 gap-0.5">
          <Text variant="body-lg" numberOfLines={1}>
            {item.memberName}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {`${item.loanProductName} · ${item.tenureMonths} months`}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {`${guarantorSummary(item.guarantors, 0)} · applied ${formatDate(item.appliedAt, 'long')}`}
          </Text>
        </View>
        <View className="ml-3 items-end gap-1.5">
          <Money value={item.amount} size="body-strong" />
          <StatusChip status={applicationStatusKey(item.status)} label={APPLICATION_STATUS_LABELS[item.status]} />
        </View>
      </View>
    </GroupedRow>
  );
}
export const ApplicationRow = memo(ApplicationRowBase);

/** One loan: the borrower, the loan number and product, repaid so far on a bar, and what is still owed. */
function LoanRowBase({ item, position, onPress }: RowProps<OfficerLoanDTO>) {
  const percent = loanPercentRepaid(item.totalPaid, item.totalRepayment);
  return (
    <GroupedRow
      position={position}
      onPress={onPress ? () => onPress(item) : undefined}
      accessibilityLabel={`${item.memberName}, ${item.loanNumber}, ${LOAN_STATUS_LABELS[item.status]}, ${percent} percent repaid`}
      testID={`loan-row-${item.id}`}
      minHeight={92}
    >
      <View className="gap-2">
        <View className="flex-row items-center justify-between gap-2">
          <Text variant="body-lg" numberOfLines={1} className="flex-1">
            {item.memberName}
          </Text>
          <StatusChip status={loanStatusKey(item.status)} label={LOAN_STATUS_LABELS[item.status]} />
        </View>
        <ProgressBar percent={percent} tone={item.status === 'PAID_OFF' ? 'success' : 'primary'} label="Repaid so far" />
        <View className="flex-row flex-wrap items-center gap-x-1">
          <Money value={item.outstandingBalance} size="caption" />
          <Text variant="caption" tone="secondary">
            {` still owed · ${item.loanNumber} · ${item.loanProductName}`}
          </Text>
        </View>
      </View>
    </GroupedRow>
  );
}
export const LoanRow = memo(LoanRowBase);

/** One loan product: its name (and whether it is on), and the terms in a line. */
function ProductRowBase({ item, position, onPress }: RowProps<OfficerLoanProductDTO>) {
  return (
    <GroupedRow
      position={position}
      onPress={onPress ? () => onPress(item) : undefined}
      accessibilityLabel={`${item.name}, ${item.isActive ? 'on' : 'off'}`}
      testID={`product-row-${item.id}`}
      minHeight={84}
    >
      <View className={item.isActive ? 'gap-0.5' : 'gap-0.5 opacity-60'}>
        <View className="flex-row items-center gap-2">
          <Text variant="body-lg" numberOfLines={1} className="flex-shrink">
            {item.name}
          </Text>
          <Badge tone={item.isActive ? 'success' : 'neutral'}>{item.isActive ? 'On' : 'Off'}</Badge>
        </View>
        <Text variant="caption" tone="secondary" numberOfLines={2}>
          {productTermsLine(item)}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {item.requiresGuarantor ? `${item.minGuarantors} ${item.minGuarantors === 1 ? 'guarantor' : 'guarantors'} needed` : 'No guarantor needed'}
        </Text>
      </View>
    </GroupedRow>
  );
}
export const ProductRow = memo(ProductRowBase);
