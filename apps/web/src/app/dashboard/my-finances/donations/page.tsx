'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, NumberInput, Select, Button, Badge } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconHeart, IconCurrencyNaira, IconPlus, IconCheck, IconClock } from '@tabler/icons-react';
import { apiGet, apiPost } from '@/utils/api';
import { toast } from '@/lib/toast';

interface DonationItem {
  id: number;
  referenceNumber: string;
  category: { id: number; name: string; type: string };
  amount: number;
  amountPaid?: number;
  purpose: string;
  isAnonymous: boolean;
  receiptNumber?: string;
  payments: any[];
  createdAt: string;
}

interface DonationCategory {
  id: number;
  name: string;
  description?: string;
}

export default function MyDonationsPage() {
  const router = useRouter();
  const [donations, setDonations] = useState<DonationItem[]>([]);
  const [categories, setCategories] = useState<DonationCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [donateOpened, { open: openDonate, close: closeDonate }] = useDisclosure(false);
  const [formData, setFormData] = useState({ amount: '', categoryId: '', isAnonymous: false });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const response = await apiGet(`${process.env.NEXT_PUBLIC_API_URL}/api/members/me/donations`);
      if (response.ok) {
        const result = await response.json();
        setDonations(result.data.donations || []);
        setCategories(result.data.donationCategories || []);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDonate = async () => {
    if (!formData.amount || !formData.categoryId) {
      toast.error('Please enter an amount and select a category');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await apiPost(`${process.env.NEXT_PUBLIC_API_URL}/api/members/me/donate`, {
        amount: parseFloat(formData.amount),
        categoryId: parseInt(formData.categoryId),
        isAnonymous: formData.isAnonymous,
        paymentMethod: 'BANK_TRANSFER'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to process donation');
      }
      toast.success('Thank you for your donation!');
      closeDonate();
      setFormData({ amount: '', categoryId: '', isAnonymous: false });
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => `₦${amount.toLocaleString()}`;
  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' });

  const totalDonated = donations.reduce((sum, d) => sum + d.amount, 0);
  
  // Calculate unpaid donations
  const getBalance = (donation: DonationItem) => {
    const paid = donation.amountPaid ?? donation.payments.reduce((sum, p) => sum + Number(p.amountPaid || 0), 0);
    return donation.amount - paid;
  };
  
  const isPaid = (donation: DonationItem) => getBalance(donation) <= 0;
  const totalUnpaid = donations.filter(d => !isPaid(d)).reduce((sum, d) => sum + getBalance(d), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600 dark:text-gray-400">Loading donations...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
            My Donations
          </h1>
          <p className="text-gray-600 dark:text-gray-400">View your donation history and make new donations</p>
        </div>
        <Button onClick={openDonate} color="pink" leftSection={<IconPlus size={16} />}>
          Make Donation
        </Button>
      </div>

      {/* Summary Card */}
      <div className="bg-gradient-to-r from-pink-500 to-rose-500 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-pink-100">Total Donations</p>
            <p className="text-4xl font-bold mt-2">{formatCurrency(totalDonated)}</p>
            <p className="text-pink-100 mt-1">{donations.length} donation(s) made</p>
          </div>
          <div className="p-4 bg-white/20 rounded-full">
            <IconHeart size={40} />
          </div>
        </div>
      </div>

      {/* Donations List */}
      {donations.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <IconHeart size={48} className="mx-auto text-pink-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Donations Yet</h3>
          <p className="text-gray-500 mb-4">Make your first donation to support the association.</p>
          <Button onClick={openDonate} color="pink">Make a Donation</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {donations.map((donation) => {
            const balance = getBalance(donation);
            const paid = isPaid(donation);
            
            return (
              <div key={donation.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${paid ? 'bg-green-100 dark:bg-green-900/30' : 'bg-pink-100 dark:bg-pink-900/30'}`}>
                      <IconHeart className={paid ? 'text-green-600' : 'text-pink-600'} size={24} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {donation.purpose || donation.category.name}
                      </h3>
                      <Badge color="pink" variant="light" size="sm">{donation.category.name}</Badge>
                      <p className="text-sm text-gray-500 mt-1">{formatDate(donation.createdAt)}</p>
                      {donation.isAnonymous && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 italic">Anonymous donation</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge color={paid ? 'green' : 'yellow'} leftSection={paid ? <IconCheck size={14} /> : <IconClock size={14} />}>
                      {paid ? 'PAID' : 'PENDING'}
                    </Badge>
                    <p className="text-xl font-bold text-pink-600 mt-2">{formatCurrency(donation.amount)}</p>
                    {donation.receiptNumber && (
                      <p className="text-xs text-gray-500 mt-1">Receipt: {donation.receiptNumber}</p>
                    )}
                  </div>
                </div>
                {!paid && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Balance: <span className="font-semibold text-pink-600">{formatCurrency(balance)}</span>
                    </p>
                    <Button 
                      size="sm" 
                      color="pink"
                      onClick={() => router.push(`/dashboard/my-finances/pay?transactionId=${donation.id}`)}
                    >
                      Pay Now
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Donate Modal */}
      <Modal opened={donateOpened} onClose={closeDonate} title="Make a Donation" size="md">
        <div className="space-y-4">
          <NumberInput
            label="Amount"
            placeholder="Enter donation amount"
            leftSection={<IconCurrencyNaira size={16} />}
            value={formData.amount ? parseFloat(formData.amount) : ''}
            onChange={(v) => setFormData({ ...formData, amount: v?.toString() || '' })}
            thousandSeparator=","
            min={100}
            required
          />
          <Select
            label="Donation Category"
            placeholder="Select a category"
            data={categories.map(c => ({ value: c.id.toString(), label: c.name }))}
            value={formData.categoryId}
            onChange={(v) => setFormData({ ...formData, categoryId: v || '' })}
            required
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={closeDonate}>Cancel</Button>
            <Button onClick={handleDonate} loading={isSubmitting} color="pink">
              Donate {formData.amount ? formatCurrency(parseFloat(formData.amount)) : ''}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
