'use client';

import { Tabs } from '@mantine/core';
import { IconMessageQuestion, IconTicket } from '@tabler/icons-react';
import { PageHeader } from '@/components/PageHeader';
import { DocFeedbackTab } from './_components/DocFeedbackTab';
import { TicketsTab } from './_components/TicketsTab';

export default function SupportPage() {
  return (
    <>
      <PageHeader
        title="Support"
        description="Tickets from association admins, and feedback on the documentation"
      />

      <Tabs defaultValue="tickets" keepMounted={false}>
        <Tabs.List mb="lg">
          <Tabs.Tab value="tickets" leftSection={<IconTicket size={16} />}>Tickets</Tabs.Tab>
          <Tabs.Tab value="feedback" leftSection={<IconMessageQuestion size={16} />}>Documentation feedback</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="tickets"><TicketsTab /></Tabs.Panel>
        <Tabs.Panel value="feedback"><DocFeedbackTab /></Tabs.Panel>
      </Tabs>
    </>
  );
}
