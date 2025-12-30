import { PrismaClient } from '@prisma/client';

// Global cache for development hot reloading
const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Create Prisma client with retry logic for Neon cold starts
function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  // Add middleware for retry logic on connection errors
  client.$use(async (params, next) => {
    const maxRetries = 3;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await next(params);
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
  });

  return client;
}

export const prisma: PrismaClient = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
