/**
 * Responsive-audit seed: stress data for the layout audit (branch responsive-pwa).
 *
 * Run AFTER demo-association.seed.ts, against a SCRATCH database only. NEVER run against production or the shared dev database.
 *
 * It adds, to the `demo` association:
 *  - a subscription on Enterprise (the demo seed expects one to exist, and the Ajo demo seed needs it)
 *  - a secretary login, so every navigation-distinct role can sign in
 *  - a very long association name
 *  - members with very long names and e-mail addresses, and enough extra members to pass 130 rows
 *  - transactions with large naira amounts (up to 12,345,678.90)
 *  - 80 notifications for each login, so the notification list and badge are stressed
 *
 * Logins (password: password123): admin@demo.com, treasurer@demo.com, secretary@demo.com, member@demo.com
 * Idempotent: it skips work it has already done.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const A = 2;
const PASSWORD = 'password123';

const LONG_ASSOCIATION =
  'The Umuoji Progressive Cooperative Thrift and Credit Society of Anambra State (Lagos Branch)';

const LONG_NAMES: Array<[string, string, string]> = [
  ['Oluwadamilolatemitope', 'Adebayo-Ogunleye-Fashola', 'oluwadamilolatemitope.adebayo-ogunleye-fashola@a-very-long-company-domain-name.com.ng'],
  ['Chukwuemekachukwunonso', 'Nwachukwu-Onyekachukwu', 'chukwuemekachukwunonso.nwachukwu-onyekachukwu@example-mail.org'],
  ['Abdulrahman-Muhammad', 'Ibrahim-Suleiman-Garba', 'abdulrahman.muhammad.ibrahim.suleiman.garba@subdomain.example.co'],
  ['Ngozichukwuka', 'Okonkwo-Ezeanyika', 'ngozichukwuka_okonkwo_ezeanyika_1985@mailbox.example.com'],
  ['A', 'B', 'a@b.co'],
];

async function main() {
  const assoc = await prisma.association.findUnique({ where: { id: A } });
  if (!assoc || assoc.subdomain !== 'demo') throw new Error('Run demo-association.seed.ts first.');

  // Long association name.
  await prisma.association.update({ where: { id: A }, data: { name: LONG_ASSOCIATION } });

  // Subscription on Enterprise (plan 3, version 3 in a freshly seeded database).
  if (!(await prisma.subscription.findFirst({ where: { associationId: A } }))) {
    const plan = await prisma.plan.findFirstOrThrow({ where: { code: 'enterprise' } });
    const version = await prisma.planVersion.findFirstOrThrow({ where: { planId: plan.id }, orderBy: { id: 'desc' } });
    await prisma.subscription.create({
      data: {
        associationId: A,
        planId: plan.id,
        planVersionId: version.id,
        status: 'ACTIVE',
        currentPeriodStart: new Date('2026-10-01T00:00:00Z'),
        currentPeriodEnd: new Date('2027-10-31T00:00:00Z'),
      } as never,
    });
    console.log('subscription created');
  }

  // Secretary login + member.
  const hash = await bcrypt.hash(PASSWORD, 12);
  let secretary = await prisma.user.findFirst({ where: { email: 'secretary@demo.com', associationId: A } });
  if (!secretary) {
    secretary = await prisma.user.create({
      data: {
        email: 'secretary@demo.com',
        passwordHash: hash,
        role: 'secretary',
        associationId: A,
        isActive: true,
        emailVerified: true,
        userApproval: { create: { approvalStatus: 'approved' } },
      },
    });
    await prisma.member.create({
      data: {
        associationId: A,
        memberId: 'MEM0900',
        firstName: 'Folake',
        lastName: 'Adeniyi',
        category: 'executive',
        status: 'active',
        userId: secretary.id,
      },
    });
    console.log('secretary created');
  }

  // Long-name members and bulk members (>130 rows in total).
  const have = await prisma.member.count({ where: { associationId: A } });
  if (have < 130) {
    const rows = LONG_NAMES.map(([firstName, lastName, email], i) => ({
      associationId: A,
      memberId: `MEM09${String(10 + i)}`,
      firstName,
      lastName,
      email,
      phone: '+2348012345678',
      status: 'active',
      category: 'regular',
    }));
    for (let i = 0; i < 70; i++) {
      rows.push({
        associationId: A,
        memberId: `MEM1${String(i).padStart(3, '0')}`,
        firstName: `Member${i}`,
        lastName: `Tester${i}`,
        email: `member${i}@example.com`,
        phone: '+23480000000' + String(i).padStart(2, '0'),
        status: i % 9 === 0 ? 'inactive' : 'active',
        category: 'regular',
      });
    }
    await prisma.member.createMany({ data: rows });
    console.log(`members added: ${rows.length}`);
  }

  // Large naira amounts.
  const cat = await prisma.financialCategory.findFirstOrThrow({ where: { associationId: A, type: 'due' } });
  const big = await prisma.member.findFirstOrThrow({ where: { associationId: A, firstName: LONG_NAMES[0][0] } });
  const admin = await prisma.user.findFirstOrThrow({ where: { email: 'admin@demo.com', associationId: A } });
  if (!(await prisma.transaction.findFirst({ where: { associationId: A, referenceNumber: 'RESP-BIG-1' } }))) {
    const amounts = ['12345678.90', '99999999.99', '1000000.00', '250000.50', '7.00'];
    await prisma.transaction.createMany({
      data: amounts.map((amount, i) => ({
        associationId: A,
        memberId: big.id,
        categoryId: cat.id,
        amount,
        paymentDate: new Date('2026-10-15T10:00:00Z'),
        dueDate: new Date('2026-10-15T00:00:00Z'),
        paymentMethod: 'bank_transfer',
        referenceNumber: `RESP-BIG-${i + 1}`,
        status: 'paid',
        notes: i === 0 ? 'A deliberately very long note to test how the notes column wraps on narrow screens and inside table cells. '.repeat(3) : null,
        createdBy: admin.id,
      })) as never,
    });
    console.log('big transactions added');
  }

  // Notifications: 80 per login.
  const users = await prisma.user.findMany({ where: { associationId: A, email: { endsWith: '@demo.com' } } });
  for (const u of users) {
    if (await prisma.notification.count({ where: { userId: u.id } }) >= 80) continue;
    await prisma.notification.createMany({
      data: Array.from({ length: 80 }, (_, i) => ({
        associationId: A,
        userId: u.id,
        title: i % 7 === 0 ? 'A notification with a deliberately long title that has to wrap on small screens without breaking the layout' : `Payment received ${i + 1}`,
        message: `Message ${i + 1}: a payment of ₦${(12345678.9 - i * 1000).toLocaleString('en-NG', { minimumFractionDigits: 2 })} was recorded for a member with a long name.`,
        type: i % 3 === 0 ? 'payment' : i % 3 === 1 ? 'meeting' : 'system',
        isRead: i > 12,
      })),
    });
  }
  console.log('notifications added');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
