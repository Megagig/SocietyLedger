/**
 * The credentials sheet: one gitignored file listing every demo login. Never committed, never printed to the console (only its path is).
 */
import { writeFileSync } from 'fs';
import { DEMO_EMAIL_DOMAIN } from '../../../src/lib/demo';
import { TenantDef, subdomainOf } from './config';
import type { Tenant } from './core';

export function writeCredentialsSheet(path: string, tenants: Tenant[], password: string, passwordFromEnv: boolean, appUrl: string): void {
  const lines: string[] = [];
  lines.push('# SocietyLedger demo accounts', '', '> **Confidential. Do not commit or share outside the testing team.** Everything here is demo data in the production database; real customers cannot see it and these accounts cannot see theirs.', '');
  lines.push(`- **Password (all accounts):** \`${password}\`${passwordFromEnv ? ' (from the DEMO_PASSWORD environment variable)' : ' (generated for this run; change it by re-running the seed with --reset-demo and DEMO_PASSWORD set)'}`);
  lines.push(`- **Email domain:** @${DEMO_EMAIL_DOMAIN} (mail to these addresses is never delivered)`);
  lines.push('- **Web:** open the tenant address below, or sign in at the web app and enter the tenant code.', '- **Mobile:** on the sign-in screen enter the **tenant code** (the subdomain, e.g. `demo-unity`), then the email and password.', '- Payments by gateway, SMS, invitations, password changes and large uploads are switched off on demo tenants. Record payments manually instead.', '');
  for (const t of tenants) {
    const def: TenantDef = t.def;
    lines.push(`## ${def.name}`, '', `${def.blurb}`, '', `- **Tenant code (mobile):** \`${subdomainOf(def)}\`  `, `- **Web address:** https://${subdomainOf(def)}.${new URL(appUrl).host.replace(/^www\./, '')}  `, `- **Plan:** ${def.planCode}${def.kind === 'THRIFT_GROUP' ? ' (standalone thrift group)' : ''}`, '');
    lines.push('| Role | Email | Situation | What to test |', '|---|---|---|---|');
    for (const a of t.accounts) lines.push(`| ${a.role.replace(/_/g, ' ')} | \`${a.email}\` | ${a.situation} | ${a.def.test} |`);
    lines.push('');
  }
  writeFileSync(path, lines.join('\n'), { encoding: 'utf8', mode: 0o600 });
}
