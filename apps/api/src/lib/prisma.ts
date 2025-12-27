import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Create Prisma client with extended timeout for Neon cold starts
const createPrismaClient = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  }).$extends({
    query: {
      async $allOperations({ operation, model, args, query }) {
        const maxRetries = 3;
        let lastError: Error | null = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            return await query(args);
          } catch (error: any) {
            lastError = error;
            
            // Check if it's a connection error (Neon cold start)
            const isConnectionError = 
              error.message?.includes("Can't reach database server") ||
              error.code === 'P1001' ||
              error.code === 'P1002';
            
            if (isConnectionError && attempt < maxRetries) {
              console.log(`Database connection attempt ${attempt} failed, retrying in ${attempt * 2}s...`);
              await new Promise(resolve => setTimeout(resolve, attempt * 2000));
              continue;
            }
            
            throw error;
          }
        }
        
        throw lastError;
      },
    },
  });
};

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma as any;
}

export default prisma;
