// Looks up one real record for every dynamic route segment ([id], [slug], ...) in the scratch database.
// Run with the scratch database environment (see README.md):  node <scratchpad>/withenv.js apps/web "node responsive/params.mjs"
// Writes artifacts/params.json: { "<route template>": "<concrete url path>" }.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { artifacts, ensureDir, repoRoot } from './lib/config.mjs';
import { buildRoutes } from './routes.mjs';

const req = createRequire(path.join(repoRoot, 'apps', 'web', 'package.json'));
const { PrismaClient } = req('@prisma/client');
const prisma = new PrismaClient();
const A = 2;

const first = async (fn, fallback = '1') => {
  try {
    const row = await fn();
    return row ? String(row) : fallback;
  } catch {
    return fallback;
  }
};

async function main() {
  const v = {
    member: await first(async () => (await prisma.member.findFirst({ where: { associationId: A }, orderBy: { id: 'asc' } }))?.id),
    meeting: await first(async () => (await prisma.meeting.findFirst({ where: { associationId: A }, orderBy: { id: 'asc' } }))?.id),
    election: await first(async () => (await prisma.election.findFirst({ where: { associationId: A }, orderBy: { id: 'asc' } }))?.id),
    poll: await first(async () => (await prisma.poll.findFirst({ where: { associationId: A }, orderBy: { id: 'asc' } }))?.id),
    levy: await first(async () => (await prisma.levyCampaign.findFirst({ where: { associationId: A }, orderBy: { id: 'asc' } }))?.id),
    tx: await first(async () => (await prisma.transaction.findFirst({ where: { associationId: A, referenceNumber: 'RESP-BIG-1' } }))?.id),
    payment: await first(async () => (await prisma.payment.findFirst({ where: { associationId: A } }))?.id),
    ajoGroup: await first(async () => (await prisma.ajoGroup.findFirst({ where: { associationId: A }, orderBy: { id: 'asc' } }))?.id),
    ajoMembership: await first(async () => (await prisma.ajoMembership.findFirst({ where: { associationId: A, member: { user: { email: 'member@demo.com' } } } }))?.id),
    cashCollection: await first(async () => (await prisma.cashCollection.findFirst({ where: { associationId: A } }))?.id),
    cashLodgment: await first(async () => (await prisma.cashLodgment.findFirst({ where: { associationId: A } }))?.id),
    loan: await first(async () => (await prisma.loan.findFirst({ where: { associationId: A } }))?.id),
    loanApp: await first(async () => (await prisma.loanApplication.findFirst({ where: { associationId: A } }))?.id),
    savings: await first(async () => (await prisma.savingsAccount.findFirst({ where: { associationId: A } }))?.id),
    welfare: await first(async () => (await prisma.welfarePayoutRequest.findFirst({ where: { associationId: A } }))?.id),
    ticket: await first(async () => (await prisma.supportTicket.findFirst({ where: { associationId: A } }))?.id),
    article: await first(async () => (await prisma.helpArticle.findFirst())?.slug, 'getting-started'),
    post: await first(async () => (await prisma.blogPost.findFirst())?.slug, 'welcome'),
    category: await first(async () => (await prisma.blogCategory.findFirst())?.slug, 'news'),
    tag: await first(async () => (await prisma.blogTag.findFirst())?.slug, 'news'),
  };

  const pick = (route) => {
    const t = route.template;
    const sub = (map) => t.replace(/\[(\w+)\]/g, (_, p) => map[p] ?? '1');
    if (t.startsWith('/blog/category')) return sub({ slug: v.category });
    if (t.startsWith('/blog/tag')) return sub({ slug: v.tag });
    if (t.startsWith('/blog/')) return sub({ slug: v.post });
    if (t.startsWith('/dashboard/help/articles')) return sub({ slug: v.article });
    if (t.startsWith('/dashboard/help/tickets')) return sub({ id: v.ticket });
    if (t.startsWith('/dashboard/ajo/reports')) return sub({ name: 'contributions' });
    if (t.startsWith('/dashboard/ajo/')) return sub({ groupId: v.ajoGroup });
    if (t.startsWith('/dashboard/my-thrift')) return sub({ membershipId: v.ajoMembership });
    if (t.startsWith('/dashboard/cash/collections')) return sub({ id: v.cashCollection });
    if (t.startsWith('/dashboard/cash/lodgments')) return sub({ id: v.cashLodgment });
    if (t.startsWith('/dashboard/cooperatives/applications')) return sub({ id: v.loanApp });
    if (t.startsWith('/dashboard/cooperatives/loans')) return sub({ id: v.loan });
    if (t.startsWith('/dashboard/cooperatives/savings')) return sub({ id: v.savings });
    if (t.startsWith('/dashboard/cooperatives/members')) return sub({ id: v.member });
    if (t.startsWith('/dashboard/finance/levies')) return sub({ id: v.levy });
    if (t.startsWith('/dashboard/finance/member-ledger')) return sub({ memberId: v.member });
    if (t.startsWith('/dashboard/finance/payments')) return sub({ id: v.payment });
    if (t.startsWith('/dashboard/finance/transactions')) return sub({ id: v.tx });
    if (t.startsWith('/dashboard/governance/elections')) return sub({ id: v.election });
    if (t.startsWith('/dashboard/governance/meetings')) return sub({ id: v.meeting });
    if (t.startsWith('/dashboard/governance/polls')) return sub({ id: v.poll });
    if (t.startsWith('/dashboard/members')) return sub({ id: v.member });
    if (t.startsWith('/dashboard/welfare/requests')) return sub({ id: v.welfare });
    if (t.startsWith('/dashboard/communications/campaigns')) return sub({ id: '1' });
    if (t.startsWith('/dashboard/payments/nigerian/transfers')) return sub({ id: '1' });
    if (t.startsWith('/documentation/')) return sub({ slug: 'getting-started' });
    if (t.startsWith('/guarantor/')) return sub({ token: 'sample-token' });
    if (t.startsWith('/verify/circle/')) return sub({ code: 'SAMPLE' });
    return sub({});
  };

  const out = {};
  for (const r of buildRoutes()) out[r.template] = r.params.length ? pick(r) : r.template;
  ensureDir(artifacts);
  fs.writeFileSync(path.join(artifacts, 'params.json'), JSON.stringify(out, null, 2));
  console.log('resolved', Object.keys(out).length, 'routes;', Object.entries(v).map(([k, x]) => `${k}=${x}`).join(' '));
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
