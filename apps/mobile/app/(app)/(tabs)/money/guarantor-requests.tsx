import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import { ShieldCheck, Users } from 'lucide-react-native';
import { useRef, useState, type RefObject } from 'react';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ConfirmSheet } from '@/components/feedback/ConfirmSheet';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { InlineEmpty } from '@/components/feedback/InlineEmpty';
import { ModuleLockedScreen } from '@/components/feedback/ModuleLockedScreen';
import { NoMemberProfile } from '@/components/feedback/NoMemberProfile';
import { ListGroup } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { Card } from '@/components/ui/Card';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { SummaryHero } from '@/components/ui/SummaryHero';
import { DeclineGuaranteeSheet } from '@/features/cooperatives/components/DeclineGuaranteeSheet';
import { GuaranteeRow } from '@/features/cooperatives/components/GuaranteeRow';
import { GuarantorRequestCard } from '@/features/cooperatives/components/GuarantorRequestCard';
import { useGuarantorRequests, useRespondToGuarantorRequest } from '@/features/cooperatives/loanQueries';
import { useCooperativeProfile } from '@/features/cooperatives/queries';
import { useCan } from '@/hooks/useCan';
import { useMemberId } from '@/hooks/useMemberId';
import { useModuleDisabled } from '@/hooks/useModuleAccess';
import { COOPERATIVE_GUARANTOR_ACCESS } from '@/lib/permissions';
import type { GuarantorRequestDTO, RespondToGuarantorRequestPayload } from '@/types/api/loans';

const applicantOf = (request: GuarantorRequestDTO) => `${request.loanApplication.member.firstName} ${request.loanApplication.member.lastName}`;

/** project-overview.md §6.4 M20 — Guarantor requests: answer pending requests, and see the loans I already guarantee. */
export default function GuarantorRequestsScreen() {
  const router = useRouter();
  const canRespond = useCan(COOPERATIVE_GUARANTOR_ACCESS);
  const locked = useModuleDisabled('cooperatives');
  const memberId = useMemberId();

  const requestsQuery = useGuarantorRequests();
  const profileQuery = useCooperativeProfile();
  const respond = useRespondToGuarantorRequest();

  const acceptRef = useRef<BottomSheetModal>(null);
  const declineRef = useRef<BottomSheetModal>(null);
  const [active, setActive] = useState<GuarantorRequestDTO | null>(null);

  const back = () => router.back();

  if (locked) return <ModuleLockedScreen title="Guarantor requests" moduleName="Cooperatives" onBack={back} />;

  if (!memberId) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Guarantor requests" onBack={back} />
        <NoMemberProfile subject="guarantor requests" />
      </Screen>
    );
  }

  if (!canRespond) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Guarantor requests" onBack={back} />
        <EmptyState icon={Users} title="No access" description="You don't have access to guarantor requests." />
      </Screen>
    );
  }

  const requests = requestsQuery.data ?? [];
  const profile = profileQuery.data;
  const guarantees = profile?.guaranteedLoans ?? [];

  const refresh = () => {
    requestsQuery.refetch();
    profileQuery.refetch();
  };

  // One failure message when nothing loaded at all (e.g. the phone can't reach the server), not one per section.
  if (requestsQuery.isError && profileQuery.isError) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Guarantor requests" onBack={back} />
        <ErrorState error={requestsQuery.error} onRetry={refresh} />
      </Screen>
    );
  }

  const open = (request: GuarantorRequestDTO, sheet: RefObject<BottomSheetModal | null>) => {
    setActive(request);
    sheet.current?.present();
  };

  const send = (payload: RespondToGuarantorRequestPayload, sheet: RefObject<BottomSheetModal | null>) => {
    if (!active) return;
    respond.mutate(
      { id: active.id, payload },
      {
        onSuccess: () => {
          sheet.current?.dismiss();
          toast.success(payload.action === 'accept' ? 'You are now a guarantor on this loan.' : 'Request declined.');
        },
        onError: (error) => {
          toast.error(error instanceof ApiError ? error.message : 'Could not send your answer. Try again.');
        },
      },
    );
  };

  return (
    <Screen edges={['top']} refreshing={requestsQuery.isRefetching || profileQuery.isRefetching} onRefresh={refresh}>
      <ScreenHeader title="Guarantor requests" onBack={back} docsKey="M20" />

      <View className="gap-6 pb-6">
        {profileQuery.isPending ? (
          <Skeleton width="100%" height={168} radius="lg" />
        ) : (
          <SummaryHero
            icon={ShieldCheck}
            eyebrow="Guaranteed on active loans"
            caption="If a borrower defaults, you may be liable for your share."
            stats={[
              { label: 'Waiting for you', value: String(requests.length) },
              { label: 'Loans you guarantee', value: String(guarantees.length) },
            ]}
          >
            <Money value={profile?.guarantorExposure ?? 0} size="display" tone="onPassbook" />
          </SummaryHero>
        )}

        <Section title="Waiting for you">
          {requestsQuery.isPending ? (
            <Skeleton width="100%" height={260} radius="lg" />
          ) : requestsQuery.isError ? (
            <ErrorState error={requestsQuery.error} onRetry={() => requestsQuery.refetch()} />
          ) : requests.length === 0 ? (
            <Card>
              <InlineEmpty icon={Users} message="Nothing waiting. When someone asks you to guarantee their loan, it shows up here." />
            </Card>
          ) : (
            <View className="gap-4">
              {requests.map((request) => (
                <GuarantorRequestCard key={request.id} request={request} onAccept={() => open(request, acceptRef)} onDecline={() => open(request, declineRef)} />
              ))}
            </View>
          )}
        </Section>

        <Section title="My guarantees">
          {profileQuery.isPending ? (
            <Skeleton width="100%" height={72} radius="lg" />
          ) : profileQuery.isError ? (
            <ErrorState error={profileQuery.error} onRetry={() => profileQuery.refetch()} />
          ) : guarantees.length === 0 ? (
            <Card>
              <InlineEmpty icon={ShieldCheck} message="You aren't guaranteeing any loans." />
            </Card>
          ) : (
            <ListGroup>
              {guarantees.map((guarantee) => (
                <GuaranteeRow key={guarantee.id} guarantee={guarantee} />
              ))}
            </ListGroup>
          )}
        </Section>
      </View>

      <ConfirmSheet
        ref={acceptRef}
        title="Guarantee this loan?"
        description={
          active
            ? `You agree to guarantee ${applicantOf(active)}'s loan. If they default, you may be liable for your share of ₦${Number(active.guaranteedAmount).toLocaleString('en-NG')}.`
            : ''
        }
        confirmLabel="Accept request"
        destructive={false}
        onConfirm={() => send({ action: 'accept' }, acceptRef)}
      />

      <DeclineGuaranteeSheet
        ref={declineRef}
        applicantName={active ? applicantOf(active) : 'The applicant'}
        loading={respond.isPending}
        onSubmit={(reason) => send({ action: 'decline', declineReason: reason }, declineRef)}
        onDismiss={() => undefined}
      />
    </Screen>
  );
}
