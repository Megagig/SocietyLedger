'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Modal, TextInput, NumberInput, Textarea, Select, MultiSelect, Button, Badge, Pagination } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconSearch, IconFileAnalytics, IconEye, IconCurrencyNaira } from '@tabler/icons-react';
import { getLoanApplications, createLoanApplication, getLoanProducts } from '@/lib/api/cooperatives';
import { apiGet } from '@/utils/api';
import { toast } from '@/lib/toast';

interface LoanApplication {
  id: number;
  applicationNumber: string;
  amount: string;
  tenureMonths: number;
  purpose: string;
  status: string;
  createdAt: string;
  member: { id: number; firstName: string; lastName: string; membershipId: string };
  loanProduct: { id: number; name: string };
}

interface LoanProduct { id: number; name: string; minAmount: string; maxAmount: string; minTenureMonths: number; maxTenureMonths: number; requiresGuarantor: boolean; minGuarantors: number; }
interface Member { id: number; firstName: string; lastName: string; membershipId: string; }

export default function ApplicationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [loanProducts, setLoanProducts] = useState<LoanProduct[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(searchParams.get('status'));
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [formData, setFormData] = useState({ loanProductId: '', amount: '', tenureMonths: '', purpose: '', guarantorIds: [] as string[], collateralDescription: '' });
  const [selectedProduct, setSelectedProduct] = useState<LoanProduct | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchApplications();
    fetchLoanProducts();
    fetchMembers();
    if (searchParams.get('action') === 'create') openCreate();
  }, [page, statusFilter]);

  const fetchApplications = async () => {
    try {
      const result = await getLoanApplications({ page, limit: 10, status: statusFilter || undefined, search: search || undefined });
      setApplications(result.data.applications);
      setTotalPages(result.data.pagination?.totalPages || 1);
    } catch (err: any) { toast.error(err.message); } finally { setIsLoading(false); }
  };

  const fetchLoanProducts = async () => {
    try {
      const result = await getLoanProducts({ isActive: true, limit: 100 });
      setLoanProducts(result.data.products || []);
    } catch (err) { console.error('Failed to fetch loan products'); }
  };

  const fetchMembers = async () => {
    try {
      const response = await apiGet(`${process.env.NEXT_PUBLIC_API_URL}/api/members?limit=1000`);
      if (response.ok) { const result = await response.json(); setMembers(result.data.members || []); }
    } catch (err) { console.error('Failed to fetch members'); }
  };

  const handleSearch = () => { setPage(1); fetchApplications(); };

  const handleProductChange = (productId: string | null) => {
    setFormData({ ...formData, loanProductId: productId || '', guarantorIds: [] });
    const product = loanProducts.find(p => p.id.toString() === productId);
    setSelectedProduct(product || null);
  };

  const handleCreate = async () => {
    if (!formData.loanProductId || !formData.amount || !formData.tenureMonths || !formData.purpose) {
      toast.error('Please fill in all required fields'); return;
    }
    if (selectedProduct?.requiresGuarantor && formData.guarantorIds.length < selectedProduct.minGuarantors) {
      toast.error(`This loan requires at least ${selectedProduct.minGuarantors} guarantor(s)`); return;
    }
    setIsSubmitting(true);
    try {
      await createLoanApplication({
        loanProductId: parseInt(formData.loanProductId),
        amount: parseFloat(formData.amount),
        tenureMonths: parseInt(formData.tenureMonths),
        purpose: formData.purpose,
        guarantorIds: formData.guarantorIds.map(id => parseInt(id)),
        collateralDescription: formData.collateralDescription || undefined
      });
      toast.success('Loan application submitted successfully');
      closeCreate();
      setFormData({ loanProductId: '', amount: '', tenureMonths: '', purpose: '', guarantorIds: [], collateralDescription: '' });
      setSelectedProduct(null);
      fetchApplications();
    } catch (err: any) { toast.error(err.message); } finally { setIsSubmitting(false); }
  };

  const formatCurrency = (amount: string | number) => `₦${Number(amount).toLocaleString()}`;
  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING_REVIEW': return 'yellow';
      case 'UNDER_REVIEW': return 'blue';
      case 'APPROVED': return 'green';
      case 'REJECTED': return 'red';
      case 'DISBURSED': return 'teal';
      case 'CANCELLED': return 'gray';
      default: return 'gray';
    }
  };

  if (isLoading) {
    return (<div className="flex items-center justify-center min-h-[400px]"><div className="text-gray-600 dark:text-gray-400">Loading applications...</div></div>);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">Loan Applications</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Review and process loan applications</p>
        </div>
        <button onClick={openCreate} className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-green-500 text-white rounded-lg hover:from-teal-600 hover:to-green-600 transition-all w-full sm:w-auto">
          <IconPlus size={20} />New Application
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1">
            <TextInput placeholder="Search by name or application number..." leftSection={<IconSearch size={16} />} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
          </div>
          <div className="flex gap-3 sm:gap-4">
            <Select placeholder="Status" data={[{ value: '', label: 'All Status' }, { value: 'PENDING_REVIEW', label: 'Pending Review' }, { value: 'UNDER_REVIEW', label: 'Under Review' }, { value: 'APPROVED', label: 'Approved' }, { value: 'REJECTED', label: 'Rejected' }, { value: 'DISBURSED', label: 'Disbursed' }]} value={statusFilter} onChange={setStatusFilter} clearable className="flex-1 sm:flex-none sm:w-44" />
            <Button onClick={handleSearch} className="w-auto">Search</Button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
          {applications.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No applications found</div>
          ) : (
            applications.map((app) => (
              <div 
                key={app.id} 
                className="p-4 space-y-3"
                onClick={() => router.push(`/dashboard/cooperatives/applications/${app.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <IconFileAnalytics className="text-blue-600" size={18} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">
                        {app.member.firstName} {app.member.lastName}
                      </p>
                      <p className="text-xs text-gray-500">{app.member.membershipId}</p>
                    </div>
                  </div>
                  <Badge color={getStatusColor(app.status)} size="sm">{app.status.replace(/_/g, ' ')}</Badge>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{app.loanProduct.name}</span>
                  <span className="font-mono text-xs text-gray-400">{app.applicationNumber}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Amount</p>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{formatCurrency(app.amount)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Tenure</p>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{app.tenureMonths} months</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-xs text-gray-500">
                    Applied: {formatDate(app.createdAt)}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/dashboard/cooperatives/applications/${app.id}`);
                    }}
                    className="flex items-center gap-1 text-blue-600 text-sm"
                  >
                    <IconEye size={16} /> View
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Application</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Member</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Tenure</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {applications.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500">No applications found</td></tr>
              ) : (
                applications.map((app) => (
                  <tr key={app.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" onClick={() => router.push(`/dashboard/cooperatives/applications/${app.id}`)}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg"><IconFileAnalytics className="text-blue-600" size={20} /></div>
                        <div><span className="font-mono text-sm">{app.applicationNumber}</span><p className="text-xs text-gray-500">{formatDate(app.createdAt)}</p></div>
                      </div>
                    </td>
                    <td className="px-6 py-4"><p className="font-medium text-gray-900 dark:text-white">{app.member.firstName} {app.member.lastName}</p><p className="text-sm text-gray-500">{app.member.membershipId}</p></td>
                    <td className="px-6 py-4 text-sm">{app.loanProduct.name}</td>
                    <td className="px-6 py-4 font-semibold">{formatCurrency(app.amount)}</td>
                    <td className="px-6 py-4 text-sm">{app.tenureMonths} months</td>
                    <td className="px-6 py-4"><Badge color={getStatusColor(app.status)}>{app.status.replace(/_/g, ' ')}</Badge></td>
                    <td className="px-6 py-4"><div className="flex justify-end"><button onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/cooperatives/applications/${app.id}`); }} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"><IconEye size={18} /></button></div></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (<div className="px-4 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-700"><Pagination total={totalPages} value={page} onChange={setPage} /></div>)}
      </div>

      {/* Create Modal */}
      <Modal opened={createOpened} onClose={closeCreate} title="New Loan Application" size="lg">
        <div className="space-y-4">
          <Select label="Loan Product" placeholder="Select loan product" data={loanProducts.map(p => ({ value: p.id.toString(), label: `${p.name} (${formatCurrency(p.minAmount)} - ${formatCurrency(p.maxAmount)})` }))} value={formData.loanProductId} onChange={handleProductChange} searchable required />
          {selectedProduct && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
              <p><span className="text-gray-500">Amount Range:</span> {formatCurrency(selectedProduct.minAmount)} - {formatCurrency(selectedProduct.maxAmount)}</p>
              <p><span className="text-gray-500">Tenure:</span> {selectedProduct.minTenureMonths} - {selectedProduct.maxTenureMonths} months</p>
              {selectedProduct.requiresGuarantor && <p className="text-amber-600">Requires {selectedProduct.minGuarantors} guarantor(s)</p>}
            </div>
          )}
          <NumberInput label="Loan Amount" leftSection={<IconCurrencyNaira size={16} />} value={formData.amount ? parseFloat(formData.amount) : ''} onChange={(v) => setFormData({ ...formData, amount: v?.toString() || '' })} thousandSeparator="," min={selectedProduct ? parseFloat(selectedProduct.minAmount) : 0} max={selectedProduct ? parseFloat(selectedProduct.maxAmount) : undefined} required />
          <NumberInput label="Tenure (months)" value={formData.tenureMonths ? parseInt(formData.tenureMonths) : ''} onChange={(v) => setFormData({ ...formData, tenureMonths: v?.toString() || '' })} min={selectedProduct?.minTenureMonths || 1} max={selectedProduct?.maxTenureMonths || 60} required />
          <Textarea label="Purpose" placeholder="Describe the purpose of this loan" value={formData.purpose} onChange={(e) => setFormData({ ...formData, purpose: e.target.value })} required />
          {selectedProduct?.requiresGuarantor && (
            <MultiSelect label={`Guarantors (min ${selectedProduct.minGuarantors})`} placeholder="Select guarantors" data={members.map(m => ({ value: m.id.toString(), label: `${m.firstName} ${m.lastName} (${m.membershipId})` }))} value={formData.guarantorIds} onChange={(v) => setFormData({ ...formData, guarantorIds: v })} searchable />
          )}
          <Textarea label="Collateral Description (Optional)" placeholder="Describe any collateral for this loan" value={formData.collateralDescription} onChange={(e) => setFormData({ ...formData, collateralDescription: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={closeCreate}>Cancel</Button>
            <Button onClick={handleCreate} loading={isSubmitting}>Submit Application</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
