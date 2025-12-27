import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../../src/server';

const prisma = new PrismaClient();

describe('Multi-Tenancy Data Isolation', () => {
  let tenant1: any;
  let tenant2: any;
  let tenant1Token: string;
  let tenant2Token: string;
  let tenant1User: any;
  let tenant2User: any;

  beforeAll(async () => {
    // Create two test associations
    tenant1 = await prisma.association.create({
      data: {
        name: 'Test Association 1',
        slug: 'test-assoc-1',
        subdomain: 'testassoc1',
        tier: 'STARTER',
        status: 'ACTIVE',
      },
    });

    tenant2 = await prisma.association.create({
      data: {
        name: 'Test Association 2',
        slug: 'test-assoc-2',
        subdomain: 'testassoc2',
        tier: 'STARTER',
        status: 'ACTIVE',
      },
    });

    // Create users for each tenant
    const hashedPassword = await require('bcryptjs').hash('Test123!', 10);

    tenant1User = await prisma.user.create({
      data: {
        email: 'admin1@test.com',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'One',
        role: 'admin',
        associationId: tenant1.id,
      },
    });

    tenant2User = await prisma.user.create({
      data: {
        email: 'admin2@test.com',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'Two',
        role: 'admin',
        associationId: tenant2.id,
      },
    });

    // Login as tenant1 admin
    const res1 = await request(app)
      .post('/api/auth/login')
      .set('X-Subdomain', 'testassoc1')
      .send({ email: 'admin1@test.com', password: 'Test123!' });
    tenant1Token = res1.body.data.token;

    // Login as tenant2 admin
    const res2 = await request(app)
      .post('/api/auth/login')
      .set('X-Subdomain', 'testassoc2')
      .send({ email: 'admin2@test.com', password: 'Test123!' });
    tenant2Token = res2.body.data.token;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.user.deleteMany({
      where: { associationId: { in: [tenant1.id, tenant2.id] } },
    });
    await prisma.association.deleteMany({
      where: { id: { in: [tenant1.id, tenant2.id] } },
    });
    await prisma.$disconnect();
  });

  describe('Member Isolation', () => {
    let tenant1Member: any;
    let tenant2Member: any;

    beforeAll(async () => {
      // Create member in tenant1
      tenant1Member = await prisma.member.create({
        data: {
          firstName: 'Member',
          lastName: 'One',
          email: 'member1@test.com',
          membershipNumber: 'T1-001',
          status: 'ACTIVE',
          joinDate: new Date(),
          associationId: tenant1.id,
        },
      });

      // Create member in tenant2
      tenant2Member = await prisma.member.create({
        data: {
          firstName: 'Member',
          lastName: 'Two',
          email: 'member2@test.com',
          membershipNumber: 'T2-001',
          status: 'ACTIVE',
          joinDate: new Date(),
          associationId: tenant2.id,
        },
      });
    });

    afterAll(async () => {
      await prisma.member.deleteMany({
        where: { id: { in: [tenant1Member.id, tenant2Member.id] } },
      });
    });

    it('should not allow tenant1 to see tenant2 members', async () => {
      const res = await request(app)
        .get('/api/members')
        .set('X-Subdomain', 'testassoc1')
        .set('Authorization', `Bearer ${tenant1Token}`);

      expect(res.status).toBe(200);
      const memberIds = res.body.data.members.map((m: any) => m.id);
      expect(memberIds).toContain(tenant1Member.id);
      expect(memberIds).not.toContain(tenant2Member.id);
    });

    it('should not allow tenant2 to see tenant1 members', async () => {
      const res = await request(app)
        .get('/api/members')
        .set('X-Subdomain', 'testassoc2')
        .set('Authorization', `Bearer ${tenant2Token}`);

      expect(res.status).toBe(200);
      const memberIds = res.body.data.members.map((m: any) => m.id);
      expect(memberIds).toContain(tenant2Member.id);
      expect(memberIds).not.toContain(tenant1Member.id);
    });

    it('should not allow tenant1 to access tenant2 member by ID', async () => {
      const res = await request(app)
        .get(`/api/members/${tenant2Member.id}`)
        .set('X-Subdomain', 'testassoc1')
        .set('Authorization', `Bearer ${tenant1Token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('User Isolation', () => {
    it('should not allow tenant1 to see tenant2 users', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('X-Subdomain', 'testassoc1')
        .set('Authorization', `Bearer ${tenant1Token}`);

      expect(res.status).toBe(200);
      const userIds = res.body.data.users.map((u: any) => u.id);
      expect(userIds).toContain(tenant1User.id);
      expect(userIds).not.toContain(tenant2User.id);
    });
  });

  describe('Token Scoping', () => {
    it('should reject tenant1 token when accessing tenant2 subdomain', async () => {
      const res = await request(app)
        .get('/api/members')
        .set('X-Subdomain', 'testassoc2')
        .set('Authorization', `Bearer ${tenant1Token}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('token');
    });

    it('should reject tenant2 token when accessing tenant1 subdomain', async () => {
      const res = await request(app)
        .get('/api/members')
        .set('X-Subdomain', 'testassoc1')
        .set('Authorization', `Bearer ${tenant2Token}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('token');
    });
  });
});

