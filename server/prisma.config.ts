import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

// .env lives at the repo root; prisma CLI runs from server/.
dotenv.config({ path: ['.env', '../.env'], quiet: true });

// Prisma 7: connection URL lives here (schema files no longer hold `url`).
export default defineConfig({
  schema: '../prisma/schema.prisma',
  migrations: {
    path: '../prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/pulse',
    ...(process.env.SHADOW_DATABASE_URL
      ? { shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL }
      : {}),
  },
});
