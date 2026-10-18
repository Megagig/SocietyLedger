/**
 * CLI script to reset TOTP 2FA for a platform user.
 * Use when a user is locked out and has exhausted recovery codes.
 *
 * Usage: npx tsx scripts/reset-totp.ts <email>
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: npx tsx scripts/reset-totp.ts <email>');
    process.exit(1);
  }

  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase(), platformRole: { not: null } },
    select: { id: true, email: true, platformRole: true, totpEnabledAt: true },
  });

  if (!user) {
    console.error(`No platform user found with email: ${email}`);
    process.exit(1);
  }

  if (!user.totpEnabledAt) {
    console.log(`User ${email} does not have TOTP enabled. Nothing to reset.`);
    process.exit(0);
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { totpSecretEnc: null, totpEnabledAt: null },
    }),
    prisma.recoveryCode.deleteMany({ where: { userId: user.id } }),
    prisma.adminLoginChallenge.deleteMany({ where: { userId: user.id } }),
  ]);

  console.log(`✓ TOTP reset for ${email}. They can now log in with password only and re-enroll 2FA.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
