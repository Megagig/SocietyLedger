import { useCan } from '@/hooks/useCan';

/**
 * What the signed-in person may do in Ajo, for deciding which buttons to draw. The server checks every request again, so this only
 * keeps the screen honest: a control the person cannot use is not shown.
 */
export function useAjoCan() {
  const manage = useCan('AJO_MANAGE');
  const reconcile = useCan('AJO_RECONCILE');
  const approvePayout = useCan('AJO_APPROVE_PAYOUT');
  const collect = useCan('AJO_COLLECT');
  const reports = useCan('AJO_REPORTS');
  return { manage, reconcile, approvePayout, collect, reports, anyOfficer: manage || reconcile || approvePayout };
}
