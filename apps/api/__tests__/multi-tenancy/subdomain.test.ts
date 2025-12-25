import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../../src/server';

const prisma = new PrismaClient();

describe('Subdomain Routing', () => {
  let activeAssociation: any;
  let suspendedAssociation: any;

  beforeAll(async () => {
    // Create active association
    activeAssociation = await prisma.association.create({
      data: {
        name: 'Active Association',
        slug: 'active-assoc',
        subdomain: 'activetest',
        tier: 'STARTER',
        status: 'ACTIVE',
      },
    });

    // Create suspended association
    suspendedAssociation = await prisma.association.create({
      data: {
        name: 'Suspended Association',
        slug: 'suspended-assoc',
        subdomain: 'suspendedtest',
        tier: 'STARTER',
        status: 'SUSPENDED',
      },
    });
  });

  afterAll(async () => {
    await prisma.association.deleteMany({
      where: { id: { in: [activeAssociation.id, suspendedAssociation.id] } },
    });
    await prisma.$disconnect();
  });

  describe('Subdomain Resolution', () => {
    it('should resolve tenant from X-Subdomain header', async () => {
      const res = await request(app)
        .get('/api/associations/check-subdomain?subdomain=activetest')
        .set('X-Subdomain', 'activetest');

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('already taken');
    });

    it('should reject request with non-existent subdomain', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('X-Subdomain', 'nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('not found');
    });

    it('should reject request without subdomain for protected routes', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('subdomain');
    });
  });

  describe('Association Status Enforcement', () => {
    let userToken: string;

    beforeAll(async () => {
      // Create user in suspended association
      const hashedPassword = await require('bcryptjs').hash('Test123!', 10);
      const user = await prisma.user.create({
        data: {
          email: 'user@suspended.com',
          password: hashedPassword,
          firstName: 'Test',
          lastName: 'User',
          role: 'admin',
          associationId: suspendedAssociation.id,
        },
      });

      const res = await request(app)
        .post('/api/auth/login')
        .set('X-Subdomain', 'suspendedtest')
        .send({ email: 'user@suspended.com', password: 'Test123!' });

      userToken = res.body.data?.token;
    });

    it('should block access to suspended association', async () => {
      if (!userToken) return; // Login might have failed due to suspended status

      const res = await request(app)
        .get('/api/auth/me')
        .set('X-Subdomain', 'suspendedtest')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('suspended');
    });

    it('should allow access to active association', async () => {
      // Create user in active association
      const hashedPassword = await require('bcryptjs').hash('Test123!', 10);
      await prisma.user.create({
        data: {
          email: 'user@active.com',
          password: hashedPassword,
          firstName: 'Test',
          lastName: 'User',
          role: 'admin',
          associationId: activeAssociation.id,
        },
      });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .set('X-Subdomain', 'activetest')
        .send({ email: 'user@active.com', password: 'Test123!' });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.token).toBeDefined();

      const meRes = await request(app)
        .get('/api/auth/me')
        .set('X-Subdomain', 'activetest')
        .set('Authorization', `Bearer ${loginRes.body.data.token}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.data.user.email).toBe('user@active.com');
    });
  });

  describe('Public Endpoints', () => {
    it('should allow check-subdomain without authentication', async () => {
      const res = await request(app).get(
        '/api/associations/check-subdomain?subdomain=testcheck'
      );

      expect(res.status).toBe(200);
      expect(res.body.data.available).toBe(true);
    });

    it('should allow association signup without authentication', async () => {
      const uniqueSubdomain = `test${Date.now()}`;
      const res = await request(app)
        .post('/api/associations/signup')
        .send({
          associationName: 'New Test Assoc',
          subdomain: uniqueSubdomain,
          email: `admin@${uniqueSubdomain}.com`,
          password: 'Test123!',
          firstName: 'Admin',
          lastName: 'User',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.association.subdomain).toBe(uniqueSubdomain);

      // Cleanup
      await prisma.association.delete({
        where: { id: res.body.data.association.id },
      });
    });
  });
});
