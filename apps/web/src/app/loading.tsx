import { Loader, Center } from '@mantine/core';

export default function Loading() {
  return (
    <Center className="min-h-screen">
      <Loader size="xl" />
    </Center>
  );
}