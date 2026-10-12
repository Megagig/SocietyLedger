import { Users } from 'lucide-react';

export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <span className="docs-logo-icon-bg flex h-8 w-8 items-center justify-center rounded-md">
        <Users className="text-white" size={18} />
      </span>
      <span className="docs-logo-text text-lg font-bold">SocietyLedger</span>
    </span>
  );
}
