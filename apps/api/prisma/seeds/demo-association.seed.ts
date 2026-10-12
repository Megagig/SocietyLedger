/**
 * Demo Association Seed Script — docs site screenshot pipeline (D1.6)
 *
 * Creates the `demo` tenant association with realistic, entirely fictional
 * Nigerian data for the docs site's Playwright screenshot pipeline
 * (`apps/docs/scripts/screenshots/`, documented in `seed-demo.md`):
 * 60 members, 12 months of dues, a levy campaign, a nominations-open
 * election, two meetings, one disbursed loan, and a welfare fund with a
 * contribution and a completed payout.
 *
 * Every date below is a fixed, absolute value (not computed from the
 * real current time) so re-running this script on any day produces the
 * same rows — required for deterministic screenshots
 * (`architecture.md §14.7`).
 *
 * NEVER run this against production. Staging/local only.
 *
 * Idempotent: the association is upserted on `subdomain: 'demo'`; the
 * three login users are created only if they don't already exist. The
 * bulk data (members, transactions, etc.) is NOT upsert-safe — re-running
 * after the first successful seed will create duplicates. If you need to
 * reseed, drop the `demo` association's rows first.
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
  InterestType,
  LoanApplicationStatus,
  LoanStatus,
  LevyCampaignStatus,
  WelfareFundType,
  WelfareFundStatus,
  WelfareContributionStatus,
  WelfarePayoutType,
  WelfarePayoutStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'password123'; // matches scripts/create-demo-admin.ts's existing convention

function utc(dateString: string): Date {
  return new Date(`${dateString}T00:00:00.000Z`);
}

const firstNames = [
  'Chidinma', 'Emeka', 'Folake', 'Ibrahim', 'Chiamaka', 'Oluwaseun', 'Amina', 'Chukwuemeka',
  'Yetunde', 'Abdullahi', 'Nkechi', 'Babatunde', 'Halima', 'Obinna', 'Aisha', 'Kayode',
  'Chinwe', 'Yusuf', 'Funmilayo', 'Uche',
];
const lastNames = [
  'Nwosu', 'Adeyemi', 'Okonkwo', 'Suleiman', 'Ogunleye', 'Eze', 'Bello', 'Chukwu',
  'Afolabi', 'Garba', 'Umeh', 'Adebayo', 'Mohammed', 'Nnamdi', 'Alabi', 'Danjuma',
  'Okeke', 'Lawal', 'Agbaje', 'Usman',
];

interface MemberSeed {
  memberId: string;
  firstName: string;
  lastName: string;
  category: 'executive' | 'regular';
}

function buildMemberSeeds(): MemberSeed[] {
  // The first 3 are the named personas behind the three Playwright logins
  // (same fictional names code-standards.md §17.1 uses in docs prose
  // examples), so screenshots and written examples agree with each other.
  const named: MemberSeed[] = [
    { memberId: 'MEM-0001', firstName: 'Adaeze', lastName: 'Okafor', category: 'executive' }, // admin
    { memberId: 'MEM-0002', firstName: 'Tunde', lastName: 'Bakare', category: 'executive' }, // treasurer
    { memberId: 'MEM-0003', firstName: 'Ngozi', lastName: 'Eze', category: 'regular' }, // member
  ];

  const generated: MemberSeed[] = Array.from({ length: 57 }, (_, i) => {
    const index = i + 3; // continue the sequence after the 3 named personas
    return {
      memberId: `MEM-${String(index + 1).padStart(4, '0')}`,
      firstName: firstNames[i % firstNames.length],
      lastName: lastNames[(i * 7 + 3) % lastNames.length],
      category: i < 2 ? 'executive' : 'regular', // 2 more officers (election candidates)
    };
  });

  return [...named, ...generated];
}

async function main() {
  console.log('\n=== SEEDING DEMO ASSOCIATION (docs screenshot pipeline, D1.6) ===\n');

  // --- Association -----------------------------------------------------
  const association = await prisma.association.upsert({
    where: { subdomain: 'demo' },
    update: {},
    create: {
      name: 'Umuoji Cooperative Society',
      slug: 'umuoji-cooperative',
      subdomain: 'demo',
      tier: AssociationTier.PROFESSIONAL,
      status: AssociationStatus.ACTIVE,
    },
  });
  console.log(`🏢 Association ready: ${association.name} (id=${association.id}, subdomain=${association.subdomain})`);

  // --- Login users (one per demo role) ----------------------------------
  async function ensureUser(email: string, role: string) {
    const existing = await prisma.user.findFirst({ where: { email, associationId: association.id } });
    if (existing) return existing;

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
    return prisma.user.create({
      data: {
        email,
        passwordHash,
        role,
        associationId: association.id,
        isActive: true,
        userApproval: { create: { approvalStatus: 'approved' } },
      },
    });
  }

  const adminUser = await ensureUser('admin@demo.com', 'admin');
  const treasurerUser = await ensureUser('treasurer@demo.com', 'treasurer');
  const memberUser = await ensureUser('member@demo.com', 'member');
  console.log('👤 Login users ready: admin@demo.com, treasurer@demo.com, member@demo.com (password: ' + DEMO_PASSWORD + ')');

  // --- Members (60) -------------------------------------------------------
  const memberSeeds = buildMemberSeeds();
  const members = [];
  for (let i = 0; i < memberSeeds.length; i++) {
    const seed = memberSeeds[i];
    const userId = i === 0 ? adminUser.id : i === 1 ? treasurerUser.id : i === 2 ? memberUser.id : undefined;
    const member = await prisma.member.create({
      data: {
        associationId: association.id,
        memberId: seed.memberId,
        firstName: seed.firstName,
        lastName: seed.lastName,
        category: seed.category,
        status: 'active',
        userId,
      },
    });
    members.push(member);
  }
  console.log(`👥 ${members.length} members created`);

  // --- Financial categories ----------------------------------------------
  const duesCategory = await prisma.financialCategory.create({
    data: { associationId: association.id, name: 'Monthly Dues', type: 'due', amount: 5000, frequency: 'monthly' },
  });
  const levyCategory = await prisma.financialCategory.create({
    data: { associationId: association.id, name: 'Building Fund Levy', type: 'levy' },
  });
  console.log('💰 Financial categories created (Monthly Dues, Building Fund Levy)');

  // --- 12 months of dues per member (2026), 4 payment-status buckets ------
  const duesMonths = Array.from({ length: 12 }, (_, m) => m + 1); // 1 = Jan .. 12 = Dec
  const dueAmount = 5000;
  let receiptCounter = 1;

  function dueDateFor(month: number): Date {
    return utc(`2026-${String(month).padStart(2, '0')}-05`);
  }

  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    // Bucket D (last 3 members): every month partially paid.
    const isPartialBucket = i >= members.length - 3;
    // Bucket C (6 before that): paid Jan–Jun, overdue Jul–Sep, pending Oct–Dec.
    const isSlowBucket = i >= members.length - 9 && i < members.length - 3;
    // Bucket B (9 before that): paid Jan–Aug, overdue Sep, pending Oct–Dec.
    const isLateBucket = i >= members.length - 18 && i < members.length - 9;

    for (const month of duesMonths) {
      const dueDate = dueDateFor(month);
      let status: 'paid' | 'pending' | 'overdue' | 'partial';

      if (isPartialBucket) {
        status = 'partial';
      } else if (isSlowBucket) {
        status = month <= 6 ? 'paid' : month <= 9 ? 'overdue' : 'pending';
      } else if (isLateBucket) {
        status = month <= 8 ? 'paid' : month === 9 ? 'overdue' : 'pending';
      } else {
        status = 'paid';
      }

      const transaction = await prisma.transaction.create({
        data: {
          associationId: association.id,
          memberId: member.id,
          categoryId: duesCategory.id,
          amount: dueAmount,
          dueDate,
          status,
          createdBy: treasurerUser.id,
        },
      });

      if (status === 'paid' || status === 'partial') {
        const amountPaid = status === 'paid' ? dueAmount : dueAmount / 2;
        const receiptNumber = `RCPT-${String(receiptCounter++).padStart(5, '0')}`;
        await prisma.payment.create({
          data: {
            associationId: association.id,
            transactionId: transaction.id,
            amountPaid,
            paymentDate: new Date(dueDate.getTime() + 2 * 24 * 60 * 60 * 1000),
            receiptNumber,
            confirmedBy: treasurerUser.id,
          },
        });
      }
    }
  }
  console.log(`📒 ${members.length * duesMonths.length} dues transactions created (with payments where paid/partial)`);

  // --- Levy campaign --------------------------------------------------------
  const levyCampaign = await prisma.levyCampaign.create({
    data: {
      associationId: association.id,
      categoryId: levyCategory.id,
      name: 'Building Fund Levy 2026',
      targetAmount: members.length * 10000,
      amountPerMember: 10000,
      deadline: utc('2026-12-31'),
      status: LevyCampaignStatus.ACTIVE,
      createdBy: adminUser.id,
    },
  });
  for (let i = 0; i < members.length; i++) {
    await prisma.levyCampaignAssignment.create({
      data: {
        campaignId: levyCampaign.id,
        memberId: members[i].id,
        amount: 10000,
        status: i < 40 ? 'paid' : 'pending',
      },
    });
  }
  console.log('🏗️  Levy campaign + assignments created');

  // --- Election (nominations open) -----------------------------------------
  const election = await prisma.election.create({
    data: {
      associationId: association.id,
      title: '2026 Executive Committee Election',
      electionType: ElectionType.EXECUTIVE,
      status: ElectionStatus.NOMINATIONS_OPEN,
      nominationStartDate: utc('2026-10-01'),
      nominationEndDate: utc('2026-10-20'),
      votingStartDate: utc('2026-10-25'),
      votingEndDate: utc('2026-10-27'),
      createdBy: adminUser.id,
    },
  });
  const chairPosition = await prisma.electionPosition.create({
    data: { electionId: election.id, title: 'Chairperson', orderNumber: 0 },
  });
  const treasurerPosition = await prisma.electionPosition.create({
    data: { electionId: election.id, title: 'Treasurer', orderNumber: 1 },
  });
  const secretaryPosition = await prisma.electionPosition.create({
    data: { electionId: election.id, title: 'Secretary', orderNumber: 2 },
  });
  const nominatedAt = utc('2026-10-05');
  await prisma.candidate.create({
    data: {
      electionId: election.id,
      memberId: members[0].id,
      positionId: chairPosition.id,
      status: CandidateStatus.APPROVED,
      nominatedAt,
      nominatedBy: adminUser.id,
    },
  });
  await prisma.candidate.create({
    data: {
      electionId: election.id,
      memberId: members[4].id,
      positionId: chairPosition.id,
      status: CandidateStatus.APPROVED,
      nominatedAt,
      nominatedBy: adminUser.id,
    },
  });
  await prisma.candidate.create({
    data: {
      electionId: election.id,
      memberId: members[1].id,
      positionId: treasurerPosition.id,
      status: CandidateStatus.APPROVED,
      nominatedAt,
      nominatedBy: adminUser.id,
    },
  });
  await prisma.candidate.create({
    data: {
      electionId: election.id,
      memberId: members[5].id,
      positionId: secretaryPosition.id,
      status: CandidateStatus.PENDING,
      nominatedAt,
      nominatedBy: adminUser.id,
    },
  });
  console.log('🗳️  Election (nominations open) + positions + candidates created');

  // --- Meetings (one past, one upcoming) ------------------------------------
  await prisma.meeting.create({
    data: {
      associationId: association.id,
      title: '2026 Annual General Meeting',
      meetingType: MeetingType.AGM,
      status: MeetingStatus.COMPLETED,
      startTime: utc('2026-06-14T10:00:00'),
      endTime: utc('2026-06-14T12:30:00'),
      createdBy: adminUser.id,
    },
  });
  await prisma.meeting.create({
    data: {
      associationId: association.id,
      title: 'Quarterly General Meeting — Q4 2026',
      meetingType: MeetingType.REGULAR,
      status: MeetingStatus.SCHEDULED,
      startTime: utc('2026-11-15T10:00:00'),
      createdBy: adminUser.id,
    },
  });
  console.log('📅 Two meetings created (one past/completed, one upcoming)');

  // --- Cooperative: one disbursed loan --------------------------------------
  const loanProduct = await prisma.loanProduct.create({
    data: {
      associationId: association.id,
      name: 'Personal Loan',
      minAmount: 50000,
      maxAmount: 500000,
      interestRate: 10,
      minTenureMonths: 3,
      maxTenureMonths: 24,
      interestType: InterestType.REDUCING_BALANCE,
    },
  });
  const loanPrincipal = 200000;
  const loanInterestRate = 10;
  const loanTenureMonths = 12;
  const loanTotalInterest = (loanPrincipal * loanInterestRate) / 100;
  const loanTotalRepayment = loanPrincipal + loanTotalInterest;
  const loanMonthlyRepayment = loanTotalRepayment / loanTenureMonths;

  const loanApplication = await prisma.loanApplication.create({
    data: {
      associationId: association.id,
      applicationNumber: 'LA-0001',
      memberId: members[10].id,
      loanProductId: loanProduct.id,
      amount: loanPrincipal,
      tenureMonths: loanTenureMonths,
      interestRate: loanInterestRate,
      interestType: InterestType.REDUCING_BALANCE,
      monthlyRepayment: loanMonthlyRepayment,
      totalRepayment: loanTotalRepayment,
      totalInterest: loanTotalInterest,
      purpose: 'Business expansion — stocking inventory for the festive season',
      status: LoanApplicationStatus.DISBURSED,
      appliedAt: utc('2026-07-01'),
    },
  });
  await prisma.loan.create({
    data: {
      associationId: association.id,
      loanNumber: 'LN-0001',
      applicationId: loanApplication.id,
      memberId: members[10].id,
      loanProductId: loanProduct.id,
      principalAmount: loanPrincipal,
      interestRate: loanInterestRate,
      interestType: InterestType.REDUCING_BALANCE,
      tenureMonths: loanTenureMonths,
      monthlyRepayment: loanMonthlyRepayment,
      totalRepayment: loanTotalRepayment,
      totalInterest: loanTotalInterest,
      amountDisbursed: loanPrincipal,
      outstandingBalance: loanTotalRepayment - loanMonthlyRepayment * 4, // 4 months repaid so far
      disbursedAt: utc('2026-07-05'),
      maturityDate: utc('2027-07-05'),
      status: LoanStatus.ACTIVE,
    },
  });
  console.log('🤝 Loan product + application + disbursed loan created');

  // --- Welfare fund, a contribution and a completed payout -------------------
  const welfareFund = await prisma.welfareFund.create({
    data: {
      associationId: association.id,
      name: 'Bereavement Support Fund',
      fundType: WelfareFundType.BEREAVEMENT,
      status: WelfareFundStatus.ACTIVE,
      currentBalance: 150000,
      createdBy: adminUser.id,
    },
  });
  for (let i = 20; i < 30; i++) {
    await prisma.welfareContribution.create({
      data: {
        associationId: association.id,
        fundId: welfareFund.id,
        memberId: members[i].id,
        amount: 5000,
        contributionDate: utc('2026-05-10'),
        status: WelfareContributionStatus.CONFIRMED,
        confirmedBy: treasurerUser.id,
        confirmedAt: utc('2026-05-11'),
      },
    });
  }
  await prisma.welfarePayoutRequest.create({
    data: {
      associationId: association.id,
      fundId: welfareFund.id,
      memberId: members[30].id,
      requestNumber: 'WP-0001',
      payoutType: WelfarePayoutType.BEREAVEMENT,
      amount: 50000,
      reason: 'Loss of immediate family member',
      status: WelfarePayoutStatus.DISBURSED,
      approvedBy: adminUser.id,
      approvedAt: utc('2026-08-02'),
      disbursedAt: utc('2026-08-05'),
    },
  });
  console.log('🤲 Welfare fund + 10 contributions + 1 disbursed payout created');

  console.log('\n✅ Demo association seed complete.');
  console.log(`   Logins (password: ${DEMO_PASSWORD}): admin@demo.com · treasurer@demo.com · member@demo.com`);
  console.log(`   Association subdomain: demo\n`);
}

main()
  .catch((error) => {
    console.error('❌ Error seeding demo association:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
