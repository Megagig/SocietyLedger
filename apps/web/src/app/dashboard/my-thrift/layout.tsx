'use client';

import type { ReactNode } from 'react';
import { AjoGate } from '@/components/ajo/AjoGate';

export default function MyThriftLayout({ children }: { children: ReactNode }) {
  return <AjoGate>{children}</AjoGate>;
}
