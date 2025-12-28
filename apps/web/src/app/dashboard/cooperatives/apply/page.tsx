'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { NumberInput, Select, Textarea, MultiSelect, Button, Stepper, Badge } from '@mantine/core';
import { 
  IconCurrencyNaira, IconWallet, IconFileAnalytics, IconUsers,
  IconCheck, IconArrowLeft, IconArrowRight, IconCalculator
} from '@tabler/icons-react';
import { getLoanProducts, createLoanApplication, getMyCooperativeProfile } from '@/lib/api/cooperatives';
import { apiGet } from '@/utils/api';
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
  processingFeePercent: string;
}

interface Member {
  id: number;
  firstName: string;
  lastName: string;
  membershipId: string;
}

interface LoanEligibility {
  maxLoanAmount: string;
  eligibleProducts: LoanProduct[];
  reasons: string[];
}

export default function ApplyForLoanPage() {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(0);
  const [loanProducts, setLoanProducts] = useState<LoanProduct[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [eligibility, setEligibility] = useState<LoanEligibility | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    loanProductId: '',
    amount: '',
    tenureMonths: '',
    purpose: '',
    guarantorIds: [] as string[],
    collateralDescription: ''
  });

  const [selectedProduct, setSelectedProduct] = useState<LoanProduct | null>(null);
  const [calculations, setCalculations] = useState<{
    monthlyRepayment: number;
    totalRepayment: number;
    totalInterest: number;
    processingFee: number;
  } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [productsRes, profileRes, membersRes] = await Promise.all([
        getLoanProducts({ isActive: true }),
        getMyCooperativeProfile(),
        apiGet(`${process.env.NEXT_PUBLIC_API_URL}/api/members?limit=1000`)
      ]);
      
      setLoanProducts(productsRes.data.products || []);
      setEligibility(profileRes.data.loanEligibility);
      
      if (membersRes.ok) {
        const membersData = await membersRes.json();
        setMembers(membersData.data.members || []);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProductChange = (productId: string | null) => {
    setFormData({ ...formData, loanProductId: productId || '', guarantorIds: [], amount: '', tenureMonths: '' });
    const product = loanProducts.find(p => p.id.toString() === productId);
    setSelectedProduct(product || null);
    setCalculations(null);
  };

  const calculateLoan = () => {
    if (!selectedProduct || !formData.amount || !formData.tenureMonths) return;
    
    const principal = parseFloat(formData.amount);
    const tenure = parseInt(formData.tenureMonths);
    const rate = parseFloat(selectedProduct.interestRate) / 100;
    const processingFeePercent = parseFloat(selectedProduct.processingFeePercent) / 100;
    
    let totalInterest: number;
    let monthlyRepayment: number;
    
    if (selectedProduct.interestType === 'FLAT') {
      totalInterest = principal * rate * (tenure / 12);
      monthlyRepayment = (principal + totalInterest) / tenure;
    } else {
      // Reducing balance
      const monthlyRate = rate / 12;
      monthlyRepayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, tenure)) / (Math.pow(1 + monthlyRate, tenure) - 1);
      totalInterest = (monthlyRepayment * tenure) - principal;
    }
    
    const processingFee = principal * processingFeePercent;
    
    setCalculations({
      monthlyRepayment,
      totalRepayment: principal + totalInterest,
      totalInterest,
      processingFee
    });
  };

  useEffect(() => {
    calculateLoan();
  }, [formData.amount, formData.tenureMonths, selectedProduct]);

  const handleSubmit = async () => {
    if (!formData.loanProductId || !formData.amount || !formData.tenureMonths || !formData.purpose) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    if (selectedProduct?.requiresGuarantor && formData.guarantorIds.length < selectedProduct.minGuarantors) {
      toast.error(`This loan requires at least ${selectedProduct.minGuarantors} guarantor(s)`);
      return;
    }
    
    setIsSubmitting(true);
    try {
      const result = await createLoanApplication({
        loanProductId: parseInt(formData.loanProductId),
        amount: parseFloat(formData.amount),
        tenureMonths: parseInt(formData.tenureMonths),
        purpose: formData.purpose,
        guarantorIds: formData.guarantorIds.map(id => parseInt(id)),
        collateralDescription: formData.collateralDescription || undefined
      });
      
      toast.success('Loan application submitted successfully!');
      router.push(`/dashboard/cooperatives/applications/${result.data.id}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: string | number) => `₦${Number(amount).toLocaleString()}`;

  const canProceed = () => {
    switch (activeStep) {
      case 0: return !!formData.loanProductId;
      case 1: return !!formData.amount && !!formData.tenureMonths;
      case 2: return !!formData.purpose && (!selectedProduct?.requiresGuarantor || formData.guarantorIds.length >= (selectedProduct?.minGuarantors || 0));
      default: return true;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
          <IconArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent">
            Apply for Loan
          </h1>
          <p className="text-gray-600 dark:text-gray-400">Complete the form to submit your loan application</p>
        </div>
      </div>

      {/* Eligibility Info */}
      {eligibility && eligibility.reasons.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <p className="font-medium text-amber-800 dark:text-amber-200 mb-2">Eligibility Notes:</p>
          <ul className="list-disc list-inside text-sm text-amber-700 dark:text-amber-300">
            {eligibility.reasons.map((reason, i) => <li key={i}>{reason}</li>)}
          </ul>
        </div>
      )}

      {/* Stepper */}
      <Stepper active={activeStep} onStepClick={setActiveStep}>
        <Stepper.Step label="Select Product" description="Choose loan type" icon={<IconWallet size={18} />}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mt-4">
            <h3 className="text-lg font-semibold mb-4">Select a Loan Product</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {loanProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => handleProductChange(product.id.toString())}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    formData.loanProductId === product.id.toString()
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-teal-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold">{product.name}</h4>
                    {formData.loanProductId === product.id.toString() && (
                      <IconCheck className="text-teal-500" size={20} />
                    )}
                  </div>
                  {product.description && <p className="text-sm text-gray-500 mb-3">{product.description}</p>}
                  <div className="space-y-1 text-sm">
                    <p><span className="text-gray-500">Amount:</span> {formatCurrency(product.minAmount)} - {formatCurrency(product.maxAmount)}</p>
                    <p><span className="text-gray-500">Interest:</span> {product.interestRate}% ({product.interestType.replace(/_/g, ' ')})</p>
                    <p><span className="text-gray-500">Tenure:</span> {product.minTenureMonths} - {product.maxTenureMonths} months</p>
                    {product.requiresGuarantor && (
                      <p className="text-amber-600"><span className="text-gray-500">Guarantors:</span> {product.minGuarantors} required</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Stepper.Step>

        <Stepper.Step label="Loan Details" description="Amount & tenure" icon={<IconCalculator size={18} />}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mt-4">
            <h3 className="text-lg font-semibold mb-4">Enter Loan Details</h3>
            
            {selectedProduct && (
              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="font-medium">{selectedProduct.name}</p>
                <p className="text-sm text-gray-500">
                  {formatCurrency(selectedProduct.minAmount)} - {formatCurrency(selectedProduct.maxAmount)} | 
                  {selectedProduct.minTenureMonths} - {selectedProduct.maxTenureMonths} months
                </p>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <NumberInput
                label="Loan Amount"
                placeholder="Enter amount"
                leftSection={<IconCurrencyNaira size={16} />}
                value={formData.amount ? parseFloat(formData.amount) : ''}
                onChange={(v) => setFormData({ ...formData, amount: v?.toString() || '' })}
                min={selectedProduct ? parseFloat(selectedProduct.minAmount) : 0}
                max={selectedProduct ? parseFloat(selectedProduct.maxAmount) : undefined}
                thousandSeparator=","
                required
              />
              <NumberInput
                label="Tenure (months)"
                placeholder="Enter tenure"
                value={formData.tenureMonths ? parseInt(formData.tenureMonths) : ''}
                onChange={(v) => setFormData({ ...formData, tenureMonths: v?.toString() || '' })}
                min={selectedProduct?.minTenureMonths || 1}
                max={selectedProduct?.maxTenureMonths || 60}
                required
              />
            </div>

            {calculations && (
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-3 flex items-center gap-2">
                  <IconCalculator size={18} /> Loan Calculator
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Monthly Payment</p>
                    <p className="text-lg font-bold text-blue-600">{formatCurrency(calculations.monthlyRepayment.toFixed(2))}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Interest</p>
                    <p className="text-lg font-bold text-amber-600">{formatCurrency(calculations.totalInterest.toFixed(2))}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Processing Fee</p>
                    <p className="text-lg font-bold text-gray-600">{formatCurrency(calculations.processingFee.toFixed(2))}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Repayment</p>
                    <p className="text-lg font-bold text-green-600">{formatCurrency(calculations.totalRepayment.toFixed(2))}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Stepper.Step>

        <Stepper.Step label="Purpose & Guarantors" description="Additional info" icon={<IconUsers size={18} />}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mt-4">
            <h3 className="text-lg font-semibold mb-4">Purpose & Guarantors</h3>
            
            <div className="space-y-4">
              <Textarea
                label="Loan Purpose"
                placeholder="Describe what you will use this loan for..."
                value={formData.purpose}
                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                minRows={3}
                required
              />

              {selectedProduct?.requiresGuarantor && (
                <div>
                  <MultiSelect
                    label={`Select Guarantors (minimum ${selectedProduct.minGuarantors})`}
                    placeholder="Choose members to guarantee your loan"
                    data={members.map(m => ({ value: m.id.toString(), label: `${m.firstName} ${m.lastName} (${m.membershipId})` }))}
                    value={formData.guarantorIds}
                    onChange={(v) => setFormData({ ...formData, guarantorIds: v })}
                    searchable
                  />
                  {formData.guarantorIds.length < selectedProduct.minGuarantors && (
                    <p className="text-sm text-amber-600 mt-1">
                      Please select at least {selectedProduct.minGuarantors} guarantor(s)
                    </p>
                  )}
                </div>
              )}

              <Textarea
                label="Collateral Description (Optional)"
                placeholder="Describe any collateral you're offering..."
                value={formData.collateralDescription}
                onChange={(e) => setFormData({ ...formData, collateralDescription: e.target.value })}
                minRows={2}
              />
            </div>
          </div>
        </Stepper.Step>

        <Stepper.Step label="Review & Submit" description="Confirm details" icon={<IconFileAnalytics size={18} />}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mt-4">
            <h3 className="text-lg font-semibold mb-4">Review Your Application</h3>
            
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h4 className="font-medium mb-2">Loan Product</h4>
                <p className="text-lg">{selectedProduct?.name}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-sm text-gray-500">Loan Amount</p>
                  <p className="text-xl font-bold text-blue-600">{formatCurrency(formData.amount || 0)}</p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-sm text-gray-500">Tenure</p>
                  <p className="text-xl font-bold">{formData.tenureMonths} months</p>
                </div>
              </div>

              {calculations && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-sm text-gray-500">Monthly Payment</p>
                    <p className="text-xl font-bold text-green-600">{formatCurrency(calculations.monthlyRepayment.toFixed(2))}</p>
                  </div>
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                    <p className="text-sm text-gray-500">Total Repayment</p>
                    <p className="text-xl font-bold text-amber-600">{formatCurrency(calculations.totalRepayment.toFixed(2))}</p>
                  </div>
                </div>
              )}

              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h4 className="font-medium mb-2">Purpose</h4>
                <p>{formData.purpose || 'Not specified'}</p>
              </div>

              {formData.guarantorIds.length > 0 && (
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <h4 className="font-medium mb-2">Guarantors ({formData.guarantorIds.length})</h4>
                  <div className="flex flex-wrap gap-2">
                    {formData.guarantorIds.map(id => {
                      const member = members.find(m => m.id.toString() === id);
                      return member ? (
                        <Badge key={id} variant="outline">{member.firstName} {member.lastName}</Badge>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Stepper.Step>
      </Stepper>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setActiveStep(s => Math.max(0, s - 1))} disabled={activeStep === 0}>
          <IconArrowLeft size={16} className="mr-2" /> Previous
        </Button>
        
        {activeStep < 3 ? (
          <Button onClick={() => setActiveStep(s => s + 1)} disabled={!canProceed()}>
            Next <IconArrowRight size={16} className="ml-2" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} loading={isSubmitting} color="green">
            Submit Application <IconCheck size={16} className="ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}
