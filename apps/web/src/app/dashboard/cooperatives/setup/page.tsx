'use client';

import { useState } from 'react';
import { Button, Modal, Switch } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useAccountTypes, useCoopSettings, useLoanCategories, useSaveAccountType, useSaveCoopSettings, useSaveLoanCategory } from '@/lib/coop/hooks';
import { coopErrorMessage } from '@/lib/coop/api';
import { CoopEmpty, CoopError, CoopLoading } from '@/components/coop/CoopStates';
import { Naira } from '@/components/coop/Naira';
import { PageHead } from '@/components/coop/PageHead';
import { StatusPill } from '@/components/coop/StatusPill';
import { toast } from '@/lib/toast';
import type { AccountClass, AccountType, LoanCategory } from '@/lib/coop/types';

const CLASSES: Array<{ value: AccountClass; label: string; help: string }> = [
  { value: 'CONTRIBUTION', label: 'Contribution', help: 'Ordinary savings. Members can withdraw from it.' },
  { value: 'SHARES', label: 'Shares', help: 'Share capital. It can never be withdrawn.' },
  { value: 'SPECIAL', label: 'Special', help: 'Withdrawable savings, with an optional monthly limit.' },
];
const CLASS_LABEL: Record<AccountClass, string> = { CONTRIBUTION: 'Contribution', SHARES: 'Shares', SPECIAL: 'Special' };

const fieldClass =
  'mt-1 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-ink focus:border-success focus:outline-none focus:ring-2 focus:ring-success-focus';
const th = 'px-4 py-2 font-medium';

interface TypeDraft {
  id?: number;
  name: string;
  description: string;
  accountClass: AccountClass;
  defaultMonthlyAmount: string;
  monthlyWithdrawalLimit: string;
  isActive: boolean;
  locked: boolean;
}
interface CategoryDraft {
  id?: number;
  name: string;
  description: string;
  isGoods: boolean;
  isActive: boolean;
  locked: boolean;
}

const emptyType: TypeDraft = { name: '', description: '', accountClass: 'CONTRIBUTION', defaultMonthlyAmount: '', monthlyWithdrawalLimit: '', isActive: true, locked: false };
const emptyCategory: CategoryDraft = { name: '', description: '', isGoods: false, isActive: true, locked: false };

/**
 * Setup: the cooperative's own savings types and loan categories, and how withdrawals are approved. Nothing here is fixed in the code: an
 * officer creates the types their cooperative uses ("Christmas savings", "Building fund", "Emergency loan"), each with one behaviour class that
 * decides what it can do. Once members hold money in a type its class can't change, so the rules never change under them.
 */
export default function CooperativeSetupPage() {
  const types = useAccountTypes(true);
  const categories = useLoanCategories(true);
  const settings = useCoopSettings();
  const saveType = useSaveAccountType();
  const saveCategory = useSaveLoanCategory();
  const saveSettings = useSaveCoopSettings();

  const [typeDraft, setTypeDraft] = useState<TypeDraft | null>(null);
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft | null>(null);

  const openType = (t?: AccountType) =>
    setTypeDraft(
      t
        ? {
            id: t.id,
            name: t.name,
            description: t.description ?? '',
            accountClass: t.accountClass,
            defaultMonthlyAmount: t.defaultMonthlyAmount ? String(Number(t.defaultMonthlyAmount)) : '',
            monthlyWithdrawalLimit: t.monthlyWithdrawalLimit ? String(Number(t.monthlyWithdrawalLimit)) : '',
            isActive: t.isActive,
            locked: (t.accountCount ?? 0) > 0,
          }
        : emptyType,
    );

  const openCategory = (c?: LoanCategory) =>
    setCategoryDraft(c ? { id: c.id, name: c.name, description: c.description ?? '', isGoods: c.isGoods, isActive: c.isActive, locked: (c.productCount ?? 0) > 0 } : emptyCategory);

  const submitType = async () => {
    if (!typeDraft) return;
    if (typeDraft.name.trim().length < 2) return toast.error('Give the account type a name');
    try {
      await saveType.mutateAsync({
        id: typeDraft.id,
        body: {
          name: typeDraft.name.trim(),
          description: typeDraft.description.trim() || null,
          accountClass: typeDraft.accountClass,
          defaultMonthlyAmount: typeDraft.defaultMonthlyAmount ? Number(typeDraft.defaultMonthlyAmount) : null,
          monthlyWithdrawalLimit: typeDraft.accountClass === 'SHARES' || !typeDraft.monthlyWithdrawalLimit ? null : Number(typeDraft.monthlyWithdrawalLimit),
          ...(typeDraft.id ? { isActive: typeDraft.isActive } : {}),
        },
      });
      toast.success(typeDraft.id ? 'Account type updated' : 'Account type created');
      setTypeDraft(null);
    } catch (error) {
      toast.error(coopErrorMessage(error, 'We could not save the account type.'));
    }
  };

  const submitCategory = async () => {
    if (!categoryDraft) return;
    if (categoryDraft.name.trim().length < 2) return toast.error('Give the category a name');
    try {
      await saveCategory.mutateAsync({
        id: categoryDraft.id,
        body: {
          name: categoryDraft.name.trim(),
          description: categoryDraft.description.trim() || null,
          isGoods: categoryDraft.isGoods,
          ...(categoryDraft.id ? { isActive: categoryDraft.isActive } : {}),
        },
      });
      toast.success(categoryDraft.id ? 'Loan category updated' : 'Loan category created');
      setCategoryDraft(null);
    } catch (error) {
      toast.error(coopErrorMessage(error, 'We could not save the loan category.'));
    }
  };

  const toggleTwoStage = async (value: boolean) => {
    try {
      await saveSettings.mutateAsync({ requireTwoStageWithdrawal: value });
      toast.success(value ? 'Withdrawals now need a review and a separate approval' : 'Withdrawals now need one officer’s approval');
    } catch (error) {
      toast.error(coopErrorMessage(error, 'We could not save the setting.'));
    }
  };

  return (
    <div className="space-y-8">
      <PageHead title="Cooperative setup" subtitle="The savings types and loan categories your members see, and how withdrawals are approved." />

      <section aria-labelledby="types-h" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="types-h" className="text-xl font-semibold text-ink">Savings account types</h2>
            <p className="text-sm text-ink-muted">Each type picks what it can do; members pay into them and see a tile for each.</p>
          </div>
          <Button color="green" leftSection={<IconPlus size={16} />} onClick={() => openType()}>New account type</Button>
        </div>
        {types.isLoading ? (
          <CoopLoading rows={2} />
        ) : types.isError ? (
          <CoopError error={types.error} onRetry={() => types.refetch()} />
        ) : !types.data || types.data.length === 0 ? (
          <CoopEmpty title="No account types yet" hint="Create the first one, for example “Monthly savings”." />
        ) : (
          <div className="relative overflow-x-auto rounded-lg border border-line">
            <table aria-label="Savings account types" className="w-full min-w-[44rem] text-sm">
              <thead className="bg-surface-muted text-left text-ink-muted">
                <tr>
                  <th scope="col" className={th}>Name</th>
                  <th scope="col" className={th}>Behaves like</th>
                  <th scope="col" className={`${th} text-right`}>Usual monthly amount</th>
                  <th scope="col" className={`${th} text-right`}>Monthly withdrawal limit</th>
                  <th scope="col" className={`${th} text-right`}>Accounts</th>
                  <th scope="col" className={th}>Status</th>
                  <th scope="col" className={th}><span className="sr-only">Edit</span></th>
                </tr>
              </thead>
              <tbody>
                {types.data.map((t) => (
                  <tr key={t.id} className="border-t border-line-soft">
                    <td className="px-4 py-2 font-medium text-ink">{t.name}{t.description && <span className="block text-xs font-normal text-ink-muted">{t.description}</span>}</td>
                    <td className="px-4 py-2">{CLASS_LABEL[t.accountClass]}{!t.isWithdrawable && <span className="block text-xs text-ink-muted">Not withdrawable</span>}</td>
                    <td className="px-4 py-2 text-right"><Naira value={t.defaultMonthlyAmount} /></td>
                    <td className="px-4 py-2 text-right">{t.isWithdrawable ? <Naira value={t.monthlyWithdrawalLimit} /> : '—'}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{t.accountCount ?? 0}</td>
                    <td className="px-4 py-2"><StatusPill label={t.isActive ? 'In use' : 'Retired'} tone={t.isActive ? 'success' : 'neutral'} /></td>
                    <td className="px-4 py-2 text-right"><Button variant="subtle" size="xs" onClick={() => openType(t)}>Edit</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="cats-h" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="cats-h" className="text-xl font-semibold text-ink">Loan categories</h2>
            <p className="text-sm text-ink-muted">Group your loan products (Normal, Commodity, Emergency…). A goods loan asks the member what they want.</p>
          </div>
          <Button color="green" leftSection={<IconPlus size={16} />} onClick={() => openCategory()}>New loan category</Button>
        </div>
        {categories.isLoading ? (
          <CoopLoading rows={2} />
        ) : categories.isError ? (
          <CoopError error={categories.error} onRetry={() => categories.refetch()} />
        ) : !categories.data || categories.data.length === 0 ? (
          <CoopEmpty title="No loan categories yet" />
        ) : (
          <div className="relative overflow-x-auto rounded-lg border border-line">
            <table aria-label="Loan categories" className="w-full min-w-[36rem] text-sm">
              <thead className="bg-surface-muted text-left text-ink-muted">
                <tr>
                  <th scope="col" className={th}>Name</th>
                  <th scope="col" className={th}>Paid out as</th>
                  <th scope="col" className={`${th} text-right`}>Loan products</th>
                  <th scope="col" className={th}>Status</th>
                  <th scope="col" className={th}><span className="sr-only">Edit</span></th>
                </tr>
              </thead>
              <tbody>
                {categories.data.map((c) => (
                  <tr key={c.id} className="border-t border-line-soft">
                    <td className="px-4 py-2 font-medium text-ink">{c.name}{c.description && <span className="block text-xs font-normal text-ink-muted">{c.description}</span>}</td>
                    <td className="px-4 py-2">{c.isGoods ? 'Goods' : 'Cash'}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{c.productCount ?? 0}</td>
                    <td className="px-4 py-2"><StatusPill label={c.isActive ? 'In use' : 'Retired'} tone={c.isActive ? 'success' : 'neutral'} /></td>
                    <td className="px-4 py-2 text-right"><Button variant="subtle" size="xs" onClick={() => openCategory(c)}>Edit</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="wd-h" className="space-y-3 rounded-lg border border-line bg-surface p-4">
        <h2 id="wd-h" className="text-xl font-semibold text-ink">Withdrawal approval</h2>
        {settings.isLoading ? (
          <CoopLoading rows={1} height={48} />
        ) : settings.isError || !settings.data ? (
          <CoopError error={settings.error} onRetry={() => settings.refetch()} />
        ) : (
          <>
            <Switch
              checked={settings.data.requireTwoStageWithdrawal}
              onChange={(e) => toggleTwoStage(e.currentTarget.checked)}
              disabled={saveSettings.isPending}
              label="Require two-stage approval for withdrawals"
              color="green"
            />
            <p className="text-sm text-ink-muted">
              {settings.data.requireTwoStageWithdrawal
                ? 'One officer reviews each request, and a different officer approves and pays it. The member, the reviewer and the approver are always three different people.'
                : 'One officer decides each request. Use this only if your cooperative has too few officers to staff two stages. A request already waiting keeps the rule it was made under.'}
            </p>
          </>
        )}
      </section>

      <Modal opened={!!typeDraft} onClose={() => setTypeDraft(null)} title={typeDraft?.id ? 'Edit account type' : 'New account type'} centered>
        {typeDraft && (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-ink-soft">
              Name
              <input type="text" value={typeDraft.name} maxLength={80} onChange={(e) => setTypeDraft({ ...typeDraft, name: e.target.value })} className={fieldClass} />
            </label>
            <label className="block text-sm font-medium text-ink-soft">
              Description (optional)
              <input type="text" value={typeDraft.description} maxLength={300} onChange={(e) => setTypeDraft({ ...typeDraft, description: e.target.value })} className={fieldClass} />
            </label>
            <fieldset>
              <legend className="text-sm font-medium text-ink-soft">Behaves like</legend>
              <div className="mt-1 space-y-2">
                {CLASSES.map((c) => (
                  <label key={c.value} className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm ${typeDraft.accountClass === c.value ? 'border-success bg-success-soft' : 'border-line'} ${typeDraft.locked ? 'cursor-not-allowed opacity-60' : ''}`}>
                    <input type="radio" name="class" checked={typeDraft.accountClass === c.value} disabled={typeDraft.locked} onChange={() => setTypeDraft({ ...typeDraft, accountClass: c.value })} className="mt-1" />
                    <span><span className="font-medium text-ink">{c.label}</span><span className="block text-ink-muted">{c.help}</span></span>
                  </label>
                ))}
              </div>
              {typeDraft.locked && <p className="mt-1 text-xs text-ink-muted">Members already hold accounts of this type, so what it does can no longer change. Create a new type instead.</p>}
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-ink-soft">
                Usual monthly amount (₦, optional)
                <input type="number" inputMode="decimal" min="0" step="0.01" value={typeDraft.defaultMonthlyAmount} onChange={(e) => setTypeDraft({ ...typeDraft, defaultMonthlyAmount: e.target.value })} className={fieldClass} />
              </label>
              {typeDraft.accountClass !== 'SHARES' && (
                <label className="block text-sm font-medium text-ink-soft">
                  Monthly withdrawal limit (₦, optional)
                  <input type="number" inputMode="decimal" min="0" step="0.01" value={typeDraft.monthlyWithdrawalLimit} onChange={(e) => setTypeDraft({ ...typeDraft, monthlyWithdrawalLimit: e.target.value })} className={fieldClass} />
                </label>
              )}
            </div>
            {typeDraft.id && <Switch checked={typeDraft.isActive} onChange={(e) => setTypeDraft({ ...typeDraft, isActive: e.currentTarget.checked })} label="In use (members can pay into it)" color="green" />}
            <div className="flex justify-end gap-2">
              <Button variant="default" onClick={() => setTypeDraft(null)}>Cancel</Button>
              <Button color="green" onClick={submitType} loading={saveType.isPending}>Save</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal opened={!!categoryDraft} onClose={() => setCategoryDraft(null)} title={categoryDraft?.id ? 'Edit loan category' : 'New loan category'} centered>
        {categoryDraft && (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-ink-soft">
              Name
              <input type="text" value={categoryDraft.name} maxLength={80} onChange={(e) => setCategoryDraft({ ...categoryDraft, name: e.target.value })} className={fieldClass} />
            </label>
            <label className="block text-sm font-medium text-ink-soft">
              Description (optional)
              <input type="text" value={categoryDraft.description} maxLength={300} onChange={(e) => setCategoryDraft({ ...categoryDraft, description: e.target.value })} className={fieldClass} />
            </label>
            <Switch
              checked={categoryDraft.isGoods}
              disabled={categoryDraft.locked}
              onChange={(e) => setCategoryDraft({ ...categoryDraft, isGoods: e.currentTarget.checked })}
              label="A goods (commodity) loan: paid out as goods, and the member describes what they want"
              color="green"
            />
            {categoryDraft.locked && <p className="text-xs text-ink-muted">Loan products already use this category, so it can no longer switch between cash and goods.</p>}
            {categoryDraft.id && <Switch checked={categoryDraft.isActive} onChange={(e) => setCategoryDraft({ ...categoryDraft, isActive: e.currentTarget.checked })} label="In use" color="green" />}
            <div className="flex justify-end gap-2">
              <Button variant="default" onClick={() => setCategoryDraft(null)}>Cancel</Button>
              <Button color="green" onClick={submitCategory} loading={saveCategory.isPending}>Save</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
