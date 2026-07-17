import { z } from 'zod';

export const createPredictionSchema = z.object({
  matchId: z.string().min(1),
  predictedAction: z.boolean(),
});

export const loginSchema = z.object({
  walletAddress: z.string().min(32).max(44),
  signature: z.string().min(1),
  nonce: z.string().min(1),
});

export const leaderboardQuerySchema = z.object({
  scope: z.enum(['global', 'friends']).default('global'),
  limit: z.coerce.number().int().min(1).max(100).default(100),
});

export const matchesQuerySchema = z.object({
  status: z.enum(['live', 'upcoming', 'completed']).optional(),
});

export type CreatePredictionInput = z.infer<typeof createPredictionSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
