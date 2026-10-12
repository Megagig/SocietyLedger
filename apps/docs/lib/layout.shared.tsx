import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { Logo } from '@/components/layout/logo';
import { appUrl } from './shared';
import { withUtm } from './utm';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      // JSX supported
      title: <Logo />,
    },
    links: [
      {
        text: 'Open SocietyLedger',
        url: withUtm(appUrl, 'header'),
        external: true,
      },
    ],
  };
}
