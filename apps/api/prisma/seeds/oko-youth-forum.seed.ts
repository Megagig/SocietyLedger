/**
 * Oko Youth Forum seed — mobile E2E (Maestro) and store-review demo (F9.3 / F9.5)
 *
 * Creates the `oko-youth-forum` tenant with a small, fully fictional data set:
 * 3 logins (admin, treasurer-officer, member), 12 members, monthly dues
 * (several outstanding for the member login), one pending payment proof for
 * the officer to verify, an election with voting open right now, and a
 * meeting scheduled for today so attendance can be taken.
 *
 * Required env: OKO_DEMO_PASSWORD (min 8 chars). It is never committed and
 * never printed. Run: OKO_DEMO_PASSWORD=... pnpm --filter api seed:oko
 *
 * NEVER run this against production. Local/staging only.
 *
 * Idempotent: the association, onboarding row and logins are upserted; the
 * bulk data is created only when the association has no members yet. To
 * reseed, delete the association's rows first.
 */
import {
  PrismaClient,
  AssociationTier,
  AssociationStatus,
  ElectionType,
  ElectionStatus,
  CandidateStatus,
  MeetingType,
  MeetingStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const SUBDOMAIN = 'oko-youth-forum';
const DAY = 24 * 60 * 60 * 1000;

const LOGINS = [
  { email: 'admin@oko-youth-forum.example', role: 'admin', first: 'Adaeze', last: 'Okafor', category: 'executive' },
  { email: 'treasurer@oko-youth-forum.example', role: 'treasurer', first: 'Tunde', last: 'Bakare', category: 'executive' },
  { email: 'member@oko-youth-forum.example', role: 'member', first: 'Ngozi', last: 'Eze', category: 'regular' },
] as const;

const FILLER_NAMES = [
  ['Chidinma', 'Nwosu'], ['Emeka', 'Adeyemi'], ['Folake', 'Okonkwo'], ['Ibrahim', 'Suleiman'],
  ['Chiamaka', 'Ogunleye'], ['Oluwaseun', 'Bello'], ['Amina', 'Chukwu'], ['Kayode', 'Afolabi'],
  ['Yetunde', 'Garba'],
];

async function main() {
  const password = process.env.OKO_DEMO_PASSWORD;
  if (!password || password.length < 8) {
    console.error('OKO_DEMO_PASSWORD is required (at least 8 characters). Nothing was seeded.');
    process.exit(1);
  }

  const association = await prisma.association.upsert({
    where: { subdomain: SUBDOMAIN },
    update: {},
    create: {
      name: 'Oko Youth Forum',
      slug: SUBDOMAIN,
      subdomain: SUBDOMAIN,
      tier: AssociationTier.PROFESSIONAL,
      status: AssociationStatus.ACTIVE,
    },
  });

  // Finished wizard, so logins land on the dashboard and not on onboarding.
  await prisma.onboardingProgress.upsert({
    where: { associationId: association.id },
    update: {},
    create: {
      associationId: association.id,
      currentStep: 5,
      completedSteps: [1, 2, 3, 4, 5],
      profileCompleted: true,
      teamInvited: true,
      membersImported: true,
      financeConfigured: true,
      onboardingComplete: true,
      completedAt: new Date(),
    },
  });

  const passwordHash = await bcrypt.hash(password, 12);
  const users: Record<string, { id: number }> = {};
  for (const login of LOGINS) {
    const existing = await prisma.user.findFirst({
      where: { email: login.email, associationId: association.id },
    });
    users[login.role] =
      existing ??
      (await prisma.user.create({
        data: {
          email: login.email,
          passwordHash,
          role: login.role,
          associationId: association.id,
          isActive: true,
          emailVerified: true,
          userApproval: { create: { approvalStatus: 'approved' } },
        },
      }));
  }

  const alreadySeeded = await prisma.member.count({ where: { associationId: association.id } });
  if (alreadySeeded > 0) {
    console.log(`${association.name} already has ${alreadySeeded} members; logins ensured, bulk data skipped.`);
    return;
  }

  // --- Members: 3 named logins + 9 fillers --------------------------------
  const members = [];
  const people = [
    ...LOGINS.map((l) => ({ first: l.first, last: l.last, category: l.category, userId: users[l.role].id })),
    ...FILLER_NAMES.map(([first, last]) => ({ first, last, category: 'regular', userId: undefined })),
  ];
  for (let i = 0; i < people.length; i++) {
    const p = people[i];
    members.push(
      await prisma.member.create({
        data: {
          associationId: association.id,
          memberId: `MEM${String(i + 1).padStart(4, '0')}`,
          firstName: p.first,
          lastName: p.last,
          category: p.category,
          status: 'active',
          userId: p.userId,
        },
      }),
    );
  }
  const memberLogin = members[2];

  // --- Dues: 3 months each; the member login has 2 outstanding ------------
  const duesCategory = await prisma.financialCategory.create({
    data: { associationId: association.id, name: 'Monthly Dues', type: 'due', amount: 5000, frequency: 'monthly' },
  });
  const now = Date.now();
  let receipt = 1;
  for (const member of members) {
    for (let m = 0; m < 3; m++) {
      const dueDate = new Date(now - (2 - m) * 30 * DAY); // oldest first
      const paid = member.id !== memberLogin.id || m === 0;
      const transaction = await prisma.transaction.create({
        data: {
          associationId: association.id,
          memberId: member.id,
          categoryId: duesCategory.id,
          amount: 5000,
          dueDate,
          status: paid ? 'paid' : 'pending',
          createdBy: users.treasurer.id,
        },
      });
      if (paid) {
        await prisma.payment.create({
          data: {
            associationId: association.id,
            transactionId: transaction.id,
            amountPaid: 5000,
            paymentDate: dueDate,
            receiptNumber: `OKO-${String(receipt++).padStart(5, '0')}`,
            confirmedBy: users.treasurer.id,
          },
        });
      }
    }
  }

  // --- One pending declared payment for the officer to verify -------------
  const payer = members[3];
  const payerTransaction = await prisma.transaction.findFirst({
    where: { associationId: association.id, memberId: payer.id },
    orderBy: { dueDate: 'desc' },
  });
  if (payerTransaction) {
    await prisma.transaction.update({ where: { id: payerTransaction.id }, data: { status: 'pending' } });
    await prisma.payment.deleteMany({ where: { transactionId: payerTransaction.id } });
    await prisma.paymentProof.create({
      data: {
        associationId: association.id,
        transactionId: payerTransaction.id,
        transactionIds: [payerTransaction.id],
        memberId: payer.id,
        declarationNote: 'Paid by cash to the treasurer at the last meeting.',
        paymentMethod: 'cash',
        status: 'PENDING',
      },
    });
  }

  // --- Election with voting open now --------------------------------------
  const election = await prisma.election.create({
    data: {
      associationId: association.id,
      title: 'Executive Committee Election',
      electionType: ElectionType.EXECUTIVE,
      status: ElectionStatus.VOTING_OPEN,
      nominationStartDate: new Date(now - 14 * DAY),
      nominationEndDate: new Date(now - 7 * DAY),
      votingStartDate: new Date(now - DAY),
      votingEndDate: new Date(now + 30 * DAY),
      eligibleVoterCount: members.length,
      createdBy: users.admin.id,
    },
  });
  const chair = await prisma.electionPosition.create({
    data: { electionId: election.id, title: 'Chairperson', orderNumber: 0 },
  });
  for (const memberIndex of [0, 4]) {
    await prisma.candidate.create({
      data: {
        electionId: election.id,
        memberId: members[memberIndex].id,
        positionId: chair.id,
        status: CandidateStatus.APPROVED,
        nominatedAt: new Date(now - 10 * DAY),
        nominatedBy: users.admin.id,
      },
    });
  }

  // --- Meeting scheduled for today (attendance flow) ----------------------
  await prisma.meeting.create({
    data: {
      associationId: association.id,
      title: 'General Meeting',
      meetingType: MeetingType.REGULAR,
      status: MeetingStatus.SCHEDULED,
      startTime: new Date(now - 60 * 60 * 1000),
      createdBy: users.admin.id,
    },
  });

  console.log(`${association.name} seeded: ${members.length} members, dues, 1 pending proof, open election, 1 meeting.`);
  console.log(`Logins: ${LOGINS.map((l) => l.email).join(' · ')} (password from OKO_DEMO_PASSWORD)`);
  console.log(`Association subdomain: ${SUBDOMAIN}`);
}

main()
  .catch((error) => {
    console.error('Error seeding Oko Youth Forum:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
