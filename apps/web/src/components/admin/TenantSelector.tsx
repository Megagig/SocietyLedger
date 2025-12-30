'use client';

import { useState, useEffect } from 'react';
import { Modal, TextInput, Loader } from '@mantine/core';
import { IconSearch, IconBuilding } from '@tabler/icons-react';
import { useAuthStore } from '@/store/authStore';
import { API_ROUTES } from '@/utils/constants';

interface Association {
  id: number;
  name: string;
  subdomain: string;
  status: string;
  memberCount?: number;
}

interface TenantSelectorProps {
  opened: boolean;
  onClose: () => void;
  onSelect: (association: Association) => void;
}

export function TenantSelector({ opened, onClose, onSelect }: TenantSelectorProps) {
  const { token } = useAuthStore();
  const [associations, setAssociations] = useState<Association[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (opened) {
      fetchAssociations();
    }
  }, [opened]);

  const fetchAssociations = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_ROUTES.ADMIN.ASSOCIATIONS}?limit=100&status=ACTIVE`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setAssociations(data.data.associations || []);
      }
    } catch (error) {
      console.error('Failed to fetch associations:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAssociations = associations.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.subdomain.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <IconBuilding size={20} className="text-teal-600" />
          <span className="font-semibold">Select Association</span>
        </div>
      }
      size="md"
      centered
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          As a Super Admin, select an association to view their dashboard and data.
        </p>

        <TextInput
          placeholder="Search associations..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader size="md" color="teal" />
          </div>
        ) : filteredAssociations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No associations found
          </div>
        ) : (
          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {filteredAssociations.map((association) => (
              <button
                key={association.id}
                onClick={() => onSelect(association)}
                className="w-full p-3 text-left rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-teal-50 dark:hover:bg-teal-900/20 hover:border-teal-300 dark:hover:border-teal-700 transition-colors"
              >
                <div className="font-medium text-gray-900 dark:text-white">
                  {association.name}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {association.subdomain}.societyledger.com
                  {association.memberCount !== undefined && (
                    <span className="ml-2">• {association.memberCount} members</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

export default TenantSelector;
