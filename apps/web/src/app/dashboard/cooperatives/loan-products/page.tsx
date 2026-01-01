'use client';

import { useState, useEffect } from 'react';
import { Modal, TextInput, NumberInput, Textarea, Select, Switch, Button, Badge, Pagination } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconSearch, IconReceipt, IconEdit, IconCurrencyNaira } from '@tabler/icons-react';
import { getLoanProducts, createLoanProduct } from '@/lib/api/cooperatives';
import { toast } from '@/lib/toast';

interface LoanProduct {
  id: number;
  name: string;
  description?: string;
  minAmount: string;
  maxAmount: string;
  interestRate: string;
  interestType: string;
  minTenureMonths: number;
  maxTenureMonths: number;
  requiresGuarantor: boolean;
  minGuarantors: number;
  isActive: boolean;
}

const initialFormData = {
  name: '', description: '', minAmount: '', maxAmount: '', interestRate: '',
  interestType: 'FLAT', minTenureMonths: '1', maxTenureMonths: '12',
  processingFeePercent: '', requiresGuarantor: false, minGuarantors: '1',
  maxLoanToSavingsRatio: '', gracePeriodDays: '0', lateFeePercent: ''
};

export default function LoanProductsPage() {
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [formData, setFormData] = useState(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { fetchProducts(); }, [page]);

  const fetchProducts = async () => {
    try {
      const result = await getLoanProducts({ page, limit: 10, search: search || undefined });
      setProducts(result.data.products);
      setTotalPages(result.data.pagination?.totalPages || 1);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => { setPage(1); fetchProducts(); };

  const handleCreate = async () => {
    if (!formData.name || !formData.minAmount || !formData.maxAmount || !formData.interestRate) {
      toast.error('Please fill in all required fields');
      return;
    }
    setIsSubmitting(true);
    try {
      await createLoanProduct({
        name: formData.name,
        description: formData.description || undefined,
        minAmount: parseFloat(formData.minAmount),
        maxAmount: parseFloat(formData.maxAmount),
        interestRate: parseFloat(formData.interestRate),
        interestType: formData.interestType,
        minTenureMonths: parseInt(formData.minTenureMonths),
        maxTenureMonths: parseInt(formData.maxTenureMonths),
        processingFeePercent: formData.processingFeePercent ? parseFloat(formData.processingFeePercent) : undefined,
        requiresGuarantor: formData.requiresGuarantor,
        minGuarantors: formData.requiresGuarantor ? parseInt(formData.minGuarantors) : undefined,
        maxLoanToSavingsRatio: formData.maxLoanToSavingsRatio ? parseFloat(formData.maxLoanToSavingsRatio) : undefined,
        gracePeriodDays: formData.gracePeriodDays ? parseInt(formData.gracePeriodDays) : undefined,
        lateFeePercent: formData.lateFeePercent ? parseFloat(formData.lateFeePercent) : undefined
      });
      toast.success('Loan product created successfully');
      closeCreate();
      setFormData(initialFormData);
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: string | number) => `₦${Number(amount).toLocaleString()}`;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600 dark:text-gray-400">Loading loan products...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
            Loan Products
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Configure loan types and terms</p>
        </div>
        <button onClick={openCreate} className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-green-500 text-white rounded-lg hover:from-teal-600 hover:to-green-600 transition-all w-full sm:w-auto">
          <IconPlus size={20} />
          Add Product
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1">
            <TextInput placeholder="Search products..." leftSection={<IconSearch size={16} />} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
          </div>
          <Button onClick={handleSearch} className="w-full sm:w-auto">Search</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
        {products.length === 0 ? (
          <div className="col-span-full bg-white dark:bg-gray-800 rounded-lg shadow p-8 sm:p-12 text-center">
            <IconReceipt size={40} className="mx-auto text-gray-400 mb-4 sm:hidden" />
            <IconReceipt size={48} className="mx-auto text-gray-400 mb-4 hidden sm:block" />
            <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-2">No Loan Products</h3>
            <p className="text-sm sm:text-base text-gray-500 mb-4">Create your first loan product to start accepting loan applications.</p>
            <Button onClick={openCreate} leftSection={<IconPlus size={16} />}>Add Product</Button>
          </div>
        ) : (
          products.map((product) => (
            <div key={product.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
              <div className="flex items-start justify-between mb-3 sm:mb-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <IconReceipt className="text-blue-600" size={18} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">{product.name}</h3>
                    <Badge color={product.isActive ? 'green' : 'gray'} size="sm">{product.isActive ? 'Active' : 'Inactive'}</Badge>
                  </div>
                </div>
              </div>
              {product.description && <p className="text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4 line-clamp-2">{product.description}</p>}
              <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Amount Range:</span><span className="font-medium">{formatCurrency(product.minAmount)} - {formatCurrency(product.maxAmount)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Interest Rate:</span><span className="font-medium">{product.interestRate}% ({product.interestType})</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Tenure:</span><span className="font-medium">{product.minTenureMonths} - {product.maxTenureMonths} months</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Guarantors:</span><span className="font-medium">{product.requiresGuarantor ? `${product.minGuarantors} required` : 'Not required'}</span></div>
              </div>
            </div>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination total={totalPages} value={page} onChange={setPage} />
        </div>
      )}

      {/* Create Modal */}
      <Modal opened={createOpened} onClose={closeCreate} title="Create Loan Product" size="lg">
        <div className="space-y-4">
          <TextInput label="Product Name" placeholder="e.g., Emergency Loan" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
          <Textarea label="Description" placeholder="Describe this loan product" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <NumberInput label="Minimum Amount" leftSection={<IconCurrencyNaira size={16} />} value={formData.minAmount ? parseFloat(formData.minAmount) : ''} onChange={(v) => setFormData({ ...formData, minAmount: v?.toString() || '' })} thousandSeparator="," required />
            <NumberInput label="Maximum Amount" leftSection={<IconCurrencyNaira size={16} />} value={formData.maxAmount ? parseFloat(formData.maxAmount) : ''} onChange={(v) => setFormData({ ...formData, maxAmount: v?.toString() || '' })} thousandSeparator="," required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <NumberInput label="Interest Rate (%)" value={formData.interestRate ? parseFloat(formData.interestRate) : ''} onChange={(v) => setFormData({ ...formData, interestRate: v?.toString() || '' })} decimalScale={2} required />
            <Select label="Interest Type" data={[{ value: 'FLAT', label: 'Flat Rate' }, { value: 'REDUCING_BALANCE', label: 'Reducing Balance' }]} value={formData.interestType} onChange={(v) => setFormData({ ...formData, interestType: v || 'FLAT' })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <NumberInput label="Min Tenure (months)" value={parseInt(formData.minTenureMonths)} onChange={(v) => setFormData({ ...formData, minTenureMonths: v?.toString() || '1' })} min={1} />
            <NumberInput label="Max Tenure (months)" value={parseInt(formData.maxTenureMonths)} onChange={(v) => setFormData({ ...formData, maxTenureMonths: v?.toString() || '12' })} min={1} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <NumberInput label="Processing Fee (%)" value={formData.processingFeePercent ? parseFloat(formData.processingFeePercent) : ''} onChange={(v) => setFormData({ ...formData, processingFeePercent: v?.toString() || '' })} decimalScale={2} />
            <NumberInput label="Late Fee (%)" value={formData.lateFeePercent ? parseFloat(formData.lateFeePercent) : ''} onChange={(v) => setFormData({ ...formData, lateFeePercent: v?.toString() || '' })} decimalScale={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <NumberInput label="Grace Period (days)" value={parseInt(formData.gracePeriodDays)} onChange={(v) => setFormData({ ...formData, gracePeriodDays: v?.toString() || '0' })} min={0} />
            <NumberInput label="Max Loan-to-Savings Ratio" value={formData.maxLoanToSavingsRatio ? parseFloat(formData.maxLoanToSavingsRatio) : ''} onChange={(v) => setFormData({ ...formData, maxLoanToSavingsRatio: v?.toString() || '' })} decimalScale={2} />
          </div>
          <Switch label="Requires Guarantor" checked={formData.requiresGuarantor} onChange={(e) => setFormData({ ...formData, requiresGuarantor: e.currentTarget.checked })} />
          {formData.requiresGuarantor && (
            <NumberInput label="Minimum Guarantors" value={parseInt(formData.minGuarantors)} onChange={(v) => setFormData({ ...formData, minGuarantors: v?.toString() || '1' })} min={1} />
          )}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={closeCreate}>Cancel</Button>
            <Button onClick={handleCreate} loading={isSubmitting}>Create Product</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
