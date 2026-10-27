import { AccessState } from '@/components/feedback/AccessState';

export type ModuleLockedProps = {
  moduleName: string;
};

/** ui-rules.md §5.11 — no upgrade/purchase button (rule #16: no in-app selling of subscriptions). */
export function ModuleLocked({ moduleName }: ModuleLockedProps) {
  return <AccessState kind="plan" moduleName={moduleName} />;
}
