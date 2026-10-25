/**
 * First platform super admin, for a brand-new production database.
 *
 * Runs on every API start (docker-entrypoint.sh) and is safe to repeat:
 *  - needs SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD (at least 12 characters), otherwise it does nothing;
 *  - does nothing when a super admin already exists, and never changes an existing password.
 *
 * Replaces the hard-coded account in seed-all.ts, which must not be run against production.
 * After the first sign-in at the admin console, set up two-step sign-in, then remove
 * SUPER_ADMIN_PASSWORD from the environment.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    console.log('[super-admin] SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD not set; skipping.');
    return;
  }
  if (password.length < 12) {
    console.error('[super-admin] SUPER_ADMIN_PASSWORD must be at least 12 characters; skipping.');
    process.exitCode = 1;
    return;
  }

  const existing = await prisma.user.count({ where: { platformRole: 'SUPER_ADMIN' } });
  if (existing > 0) {
    console.log(`[super-admin] ${existing} super admin(s) already exist; nothing to do.`);
    return;
  }

  const platform = await prisma.association.findUnique({ where: { subdomain: 'platform' } });
  if (!platform) {
    console.error('[super-admin] Platform association not found; run the platform-association seed first.');
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 12),
      platformRole: 'SUPER_ADMIN',
      role: 'admin',
      emailVerified: true,
      isActive: true,
      associationId: platform.id,
    },
  });
  console.log(`[super-admin] Created super admin ${user.email} (id ${user.id}).`);
}

main()
  .catch((error) => {
    console.error('[super-admin] Failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
