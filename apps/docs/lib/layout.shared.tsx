import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { Logo } from '@/components/layout/logo';
import { appUrl } from './shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      // JSX supported
      title: <Logo />,
    },
    links: [
      {
        text: 'Open SocietyLedger',
        url: appUrl,
        external: true,
      },
    ],
  };
}
