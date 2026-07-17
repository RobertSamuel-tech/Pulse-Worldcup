import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { config } from './index';
import { logger } from '../utils/logger';

let prisma: PrismaClient | null = null;

/** Lazy Prisma singleton — connection is only opened on first query. */
export function getPrisma(): PrismaClient {
  if (!prisma) {
    // Local `prisma dev` runs a WASM (PGlite) Postgres that crashes under
    // concurrent connections — serialize everything through ONE pooled
    // connection. Neon in production tolerates a bigger pool; bump `max`
    // when DATABASE_URL points at a real server.
    const isLocalWasmPg = config.DATABASE_URL.includes('localhost:512');
    const adapter = new PrismaPg({
      connectionString: config.DATABASE_URL,
      max: isLocalWasmPg ? 1 : 10,
      idleTimeoutMillis: isLocalWasmPg ? 20_000 : 30_000,
      keepAlive: true,
    });
    prisma = new PrismaClient({ adapter });
    logger.info('prisma_client_created');
  }
  return prisma;
}

export async function disconnectDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
