import Link from 'next/link';
import { appUrl, docsRoute } from '@/lib/shared';
import { withUtm } from '@/lib/utm';

export function Footer() {
  return (
    <footer className="border-t border-fd-border px-4 py-6 text-center text-sm text-fd-muted-foreground">
      <p>
        &copy; {new Date().getFullYear()} SocietyLedger ·{' '}
        <Link href={docsRoute} className="hover:text-fd-foreground">
          Documentation
        </Link>{' '}
        ·{' '}
        <a href={withUtm(appUrl, 'footer')} target="_blank" rel="noopener" className="hover:text-fd-foreground">
          Open SocietyLedger
        </a>
      </p>
    </footer>
  );
}
