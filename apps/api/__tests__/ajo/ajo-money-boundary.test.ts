/**
 * The Ajo money boundary (architecture §18.1 and §18.5). SocietyLedger records group money; it never holds or moves it, and subscription
 * money is never contribution money. These are checks on the source, so a future change that crosses the line fails the build.
 */
import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '../../src');

function filesUnder(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? filesUnder(full) : full.endsWith('.ts') ? [full] : [];
  });
}

/** The source with comments removed, so a rule written in a comment ("never call Paystack") does not trip the check. */
function code(file: string): string {
  return fs
    .readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const ajoFiles = filesUnder(path.join(SRC, 'modules/ajo'));

describe('modules/ajo', () => {
  it('has source files to check', () => {
    expect(ajoFiles.length).toBeGreaterThan(0);
  });

  it('imports no payment-provider client', () => {
    const offenders = ajoFiles.filter((f) => /from\s+['"][^'"]*(paystack|nomba|flutterwave|payment-sync|payment-gateway)[^'"]*['"]/i.test(code(f)));
    expect(offenders).toEqual([]);
  });

  it('never touches the subscription payment tables', () => {
    const offenders = ajoFiles.filter((f) => /\b(paymentHistory|paymentGatewayTransaction|tenantAddon|subscriptionTerm)\b/.test(code(f)) && !f.endsWith('ajo-standalone.ts'));
    expect(offenders).toEqual([]);
  });

  it('has no wallet, escrow or settlement table anywhere in the schema', () => {
    const schema = fs.readFileSync(path.join(__dirname, '../../prisma/schema.prisma'), 'utf8');
    const ajoModels = [...schema.matchAll(/^model (Ajo\w+) \{/gm)].map((m) => m[1]);
    expect(ajoModels.length).toBeGreaterThan(10);
    expect(ajoModels.filter((n) => /wallet|escrow|settlement|kyc/i.test(n))).toEqual([]);
  });
});

describe('the billing code', () => {
  it('never writes an Ajo money table', () => {
    const billing = filesUnder(path.join(SRC, 'services/billing'));
    const offenders = billing.filter((f) => /\bajo(Ledger|Contribution|Payout|CashHandover|Installment)\w*\b/.test(code(f)));
    expect(offenders).toEqual([]);
  });
});
