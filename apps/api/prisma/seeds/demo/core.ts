/**
 * Tenants, roles, sign-ins and member rolls for the demo seed. Everything here is find-or-create on a natural key (subdomain, email,
 * member number), and refuses to touch a row that is not flagged as demo.
 */
import { Association, Member, PrismaClient, User } from '@prisma/client';
import { ROLE_PERMISSION_MAPPING } from '../../../src/lib/role-permission-mapping';
import { isThriftExcludedPermission } from '../../../src/lib/thrift-roles';
import { getOnboardingPlan } from '../../../src/services/billing/catalog.service';
import { SettingsService } from '../../../src/modules/settings/settings.service';
import { AssociationKind } from '@prisma/client';
import { DEMO_EMAIL_DOMAIN } from '../../../src/lib/demo';
import { DUAL_IDENTITY, PersonaDef, RoleName, Situation, TenantDef, emailFor, subdomainOf } from './config';
import { DAY_MS, Rng, addressFor, cityFor, daysFrom, personName, phoneFor } from './util';

export interface Ctx {
  prisma: PrismaClient;
  today: Date;
  password: string;
  passwordHash: string;
  rng: Rng;
  log: (message: string) => void;
}

export interface Account {
  key: string;
  email: string;
  role: RoleName;
  situation: Situation;
  def: PersonaDef;
  user: User;
  member: Member;
}

export interface Tenant {
  def: TenantDef;
  association: Association;
  accounts: Account[];
  byKey: Map<string, Account>;
  admin: Account;
  /** Everyone on the member roll, personas first. */
  roll: Member[];
  /** user id of the first admin, used to attribute records. */
  adminUserId: number;
}

const ROLE_ROWS: Array<{ name: RoleName | string; displayName: string; description: string }> = [
  { name: 'admin', displayName: 'Administrator', description: 'Full administrative access' },
  { name: 'treasurer', displayName: 'Treasurer', description: 'Financial management' },
  { name: 'financial_secretary', displayName: 'Financial Secretary', description: 'Financial record keeping' },
  { name: 'member', displayName: 'Member', description: 'Basic member access' },
  { name: 'election_committee', displayName: 'Election Committee', description: 'People chosen to conduct elections, separate from the officers' },
  { name: 'ajo_collector', displayName: 'Ajo Collector', description: 'Collects contributions from assigned Ajo contributors' },
  { name: 'ajo_officer', displayName: 'Ajo Officer', description: 'Runs Ajo groups day to day, without approving payouts' },
];

const FAR_FUTURE = new Date('2099-12-31T00:00:00Z');

/** Create (or find) the demo tenant, its roles, its permanent complimentary subscription and the billing bypass. */
async function ensureAssociation(ctx: Ctx, def: TenantDef): Promise<Association> {
  const { prisma } = ctx;
  const subdomain = subdomainOf(def);
  const existing = await prisma.association.findFirst({ where: { OR: [{ subdomain }, { slug: subdomain }] } });
  if (existing && !existing.isDemo) {
    throw new Error(`Refusing to continue: "${subdomain}" already exists and is NOT flagged as demo (association ${existing.id}). Nothing was changed.`);
  }
  if (existing) return existing;

  const plan = await getOnboardingPlan(def.planCode);
  if (!plan) throw new Error(`The "${def.planCode}" plan has no published version. Run the plan seeds (plans.seed.ts, ajo-addons.seed.ts) first.`);

  const permissions = await prisma.permission.findMany();
  if (permissions.length === 0) throw new Error('No permissions found. Run prisma/seeds/rbac-seed.ts first.');
  const permissionId = new Map(permissions.map((p) => [p.key, p.id]));
  const isThrift = def.kind === AssociationKind.THRIFT_GROUP;

  return prisma.$transaction(
    async (tx) => {
      const association = await tx.association.create({
        data: { name: def.name, slug: subdomain, subdomain, kind: def.kind, tier: def.tier, status: 'ACTIVE', isDemo: true, hasEverTrialed: true },
      });
      await tx.subscription.create({
        data: {
          associationId: association.id, planId: plan.id, planVersionId: plan.versionId, source: 'COMPLIMENTARY', status: 'ACTIVE', billingCycle: 'ANNUAL' as never,
          trialEndsAt: null, currentPeriodStart: ctx.today, currentPeriodEnd: FAR_FUTURE, renewalDate: null,
        },
      });
      for (const row of ROLE_ROWS) {
        const role = await tx.role.create({ data: { name: row.name, displayName: row.displayName, description: row.description, associationId: association.id, isSystemRole: true } });
        const keys = (ROLE_PERMISSION_MAPPING as Record<string, string[]>)[row.name] ?? [];
        const rows = keys
          .filter((k) => !(isThrift && isThriftExcludedPermission(k)) && permissionId.has(k))
          .map((k) => ({ roleId: role.id, permissionId: permissionId.get(k) as number }));
        if (rows.length) await tx.rolePermission.createMany({ data: rows, skipDuplicates: true });
      }
      await tx.onboardingProgress.create({
        data: { associationId: association.id, currentStep: 5, completedSteps: [1, 2, 3, 4, 5], profileCompleted: true, teamInvited: true, membersImported: true, financeConfigured: true, onboardingComplete: true, completedAt: ctx.today },
      });
      return association;
    },
    { timeout: 60_000 },
  );
}

/** A subscription that cannot expire, and a billing bypass so no invoice is ever raised. Needs a user id to attribute the override to. */
async function ensureNoBilling(ctx: Ctx, associationId: number, userId: number) {
  const has = await ctx.prisma.billingOverride.findFirst({ where: { associationId, overrideType: 'BYPASS_BILLING', isActive: true } });
  if (!has) {
    await ctx.prisma.billingOverride.create({
      data: { associationId, overrideType: 'BYPASS_BILLING', reason: 'Demo tenant: never billed', startDate: ctx.today, endDate: null, isActive: true, createdBy: userId },
    });
  }
}

async function ensureAccount(ctx: Ctx, association: Association, def: TenantDef, persona: PersonaDef, memberNo: number, name: { firstName: string; lastName: string }): Promise<Account> {
  const { prisma, rng } = ctx;
  const email = persona.sharedIdentity ? `${persona.sharedIdentity}@${DEMO_EMAIL_DOMAIN}` : emailFor(persona.key, def.short);
  const situation: Situation = persona.situation ?? 'normal';
  const blocked = situation === 'suspended' || situation === 'pending';

  let user = await prisma.user.findFirst({ where: { associationId: association.id, email } });
  if (user && !user.isDemo) throw new Error(`Refusing to continue: ${email} already exists in ${association.subdomain} and is not a demo user.`);
  if (!user) {
    user = await prisma.user.create({
      data: {
        associationId: association.id, email, passwordHash: ctx.passwordHash, role: persona.role, isActive: !blocked, emailVerified: true, isDemo: true,
        firstName: name.firstName, lastName: name.lastName,
        userApproval: { create: { approvalStatus: situation === 'pending' ? 'pending' : 'approved' } },
      },
    });
  }
  const memberId = `MEM${String(memberNo).padStart(4, '0')}`;
  let member = await prisma.member.findFirst({ where: { associationId: association.id, memberId } });
  if (!member) {
    const [city, state] = cityFor(rng);
    const joined = situation === 'new' ? daysFrom(ctx.today, -6) : daysFrom(ctx.today, -rng.int(200, 700));
    member = await prisma.member.create({
      data: {
        associationId: association.id, userId: user.id, memberId, firstName: name.firstName, lastName: name.lastName, email,
        phone: phoneFor(rng), address: addressFor(rng), city, state, country: 'Nigeria', joinDate: joined,
        gender: rng.chance(0.5) ? 'male' : 'female', occupation: rng.pick(['Trader', 'Teacher', 'Civil servant', 'Engineer', 'Nurse', 'Contractor', 'Banker']),
        status: situation === 'suspended' ? 'suspended' : situation === 'inactive' ? 'inactive' : 'active',
        category: persona.role === 'member' ? 'regular' : 'executive',
        loginStatus: situation === 'pending' ? 'invited' : 'active',
        emergencyContactName: 'Emergency Contact', emergencyContactPhone: phoneFor(rng), emergencyContactRelationship: 'Spouse',
      },
    });
  }
  const role = await prisma.role.findFirstOrThrow({ where: { associationId: association.id, name: persona.role } });
  const hasRole = await prisma.userRole.findFirst({ where: { userId: user.id, roleId: role.id, associationId: association.id } });
  if (!hasRole) await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, associationId: association.id, assignedBy: null } });
  return { key: persona.key, email, role: persona.role, situation, def: persona, user, member };
}

/** Creates the tenant, every persona's sign-in and member record, and the rest of the member roll. */
export async function ensureTenant(ctx: Ctx, def: TenantDef): Promise<Tenant> {
  const association = await ensureAssociation(ctx, def);
  const taken = new Set<string>();
  const accounts: Account[] = [];
  let n = 0;
  for (const persona of def.personas) {
    n += 1;
    const name = persona.name ? { firstName: persona.name[0], lastName: persona.name[1] } : personName(ctx.rng, taken);
    taken.add(`${name.firstName} ${name.lastName}`);
    accounts.push(await ensureAccount(ctx, association, def, persona, n, name));
  }
  const byKey = new Map(accounts.map((a) => [a.key, a]));
  const admin = byKey.get('admin');
  if (!admin) throw new Error(`${def.short}: every tenant needs an admin persona.`);

  await ensureNoBilling(ctx, association.id, admin.user.id);
  const current = await SettingsService.getSettings(association.id, 'association').catch(() => ({} as Record<string, unknown>));
  if ((current as Record<string, unknown>).associationType !== def.associationType) {
    await SettingsService.updateSettings(association.id, 'association', { associationType: def.associationType, customAssociationType: def.associationType === 'other' ? 'Thrift group' : null }, admin.user.id).catch((e: Error) => ctx.log(`   (association type not saved: ${e.message})`));
  }

  // The rest of the member roll (people without a sign-in): mostly active, a few inactive/suspended.
  const roll: Member[] = accounts.map((a) => a.member);
  for (let i = accounts.length + 1; i <= def.members; i += 1) {
    const memberId = `MEM${String(i).padStart(4, '0')}`;
    let member = await ctx.prisma.member.findFirst({ where: { associationId: association.id, memberId } });
    if (!member) {
      const name = i === accounts.length + 3 ? { firstName: 'Chukwuemeka Oluwaseyi', lastName: 'Nwachukwu-Adeyemi-Okonkwo' } : personName(ctx.rng, taken); // a long name on purpose
      const [city, state] = cityFor(ctx.rng);
      const status = i % 23 === 0 ? 'suspended' : i % 11 === 0 ? 'inactive' : 'active';
      member = await ctx.prisma.member.create({
        data: {
          associationId: association.id, memberId, firstName: name.firstName, lastName: name.lastName, phone: phoneFor(ctx.rng), address: addressFor(ctx.rng), city, state, country: 'Nigeria',
          joinDate: new Date(ctx.today.getTime() - ctx.rng.int(30, 720) * DAY_MS), gender: ctx.rng.chance(0.5) ? 'male' : 'female', status, category: i % 17 === 0 ? 'honorary' : i % 13 === 0 ? 'student' : 'regular',
          loginStatus: 'no_login', occupation: ctx.rng.pick(['Trader', 'Teacher', 'Civil servant', 'Driver', 'Tailor', 'Farmer', 'Engineer']),
        },
      });
    }
    roll.push(member);
  }
  return { def, association, accounts, byKey, admin, roll, adminUserId: admin.user.id };
}

/** Members of the roll who are active (the ones that get charged). */
export const activeRoll = (t: Tenant) => t.roll.filter((m) => m.status === 'active');

export { DUAL_IDENTITY };
