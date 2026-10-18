'use client';

import { Modal, Text, Button, Group } from '@mantine/core';
import { IconLock } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useModuleLockStore } from '@/store/moduleLockStore';

export function ModuleLockedModal() {
  const router = useRouter();
  const { isOpen, message, upgradeRequired, close } = useModuleLockStore();

  return (
    <Modal opened={isOpen} onClose={close} title="Feature Not Available" centered>
      <Group mb="md">
        <IconLock size={32} className="text-orange-500" />
        <Text>{message}</Text>
      </Group>
      <Group justify="flex-end">
        <Button variant="default" onClick={close}>
          Close
        </Button>
        {upgradeRequired && (
          <Button
            onClick={() => {
              close();
              router.push('/dashboard/subscription/plans');
            }}
          >
            View Plans
          </Button>
        )}
      </Group>
    </Modal>
  );
}
