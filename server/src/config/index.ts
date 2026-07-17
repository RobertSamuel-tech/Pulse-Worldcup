import dotenv from 'dotenv';
import { z } from 'zod';

// Server usually runs from server/ while .env lives at the repo root.
dotenv.config({ path: ['.env', '../.env'], quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/pulse'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().default('dev-secret-change-me'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  SENTRY_DSN: z.string().default(''),
  TXLINE_NETWORK: z.enum(['devnet', 'mainnet']).default('devnet'),
  TXLINE_BASE_URL: z.string().default('https://txline-dev.txodds.com'),
  // Free World Cup tier: devnet exposes service level 1 (real-time sampling); mainnet adds 12.
  TXLINE_SERVICE_LEVEL: z.coerce.number().int().default(1),
  TXLINE_SUBSCRIPTION_WEEKS: z.coerce.number().int().default(4),
  TXLINE_WALLET_PATH: z.string().default('./.keys/txline-wallet.json'),
  SOLANA_RPC_URL: z.string().default('https://api.devnet.solana.com'),
  // Demo/replay data generation only — live mode never touches OpenRouter.
  OPENROUTER_API_KEY: z.string().default(''),
  OPENROUTER_MODEL: z.string().default('google/gemini-3.5-flash'),
  ADMIN_SEED_KEY: z.string().default(''),
  // Dev/demo escape hatch: allow predictions on matches that are not live yet.
  ALLOW_PREDICTIONS_PRELIVE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
};

export type AppConfig = typeof config;
