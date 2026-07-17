export const PREDICTION_WINDOW_SECONDS = 60;
export const PREDICTION_COOLDOWN_SECONDS = 3;
export const BASE_POINTS = 100;

export const EVENT_MULTIPLIERS = {
  goal: 3.0,
  red_card: 2.5,
  yellow_card: 2.0,
  corner: 1.5,
  penalty: 3.0,
  substitution: 1.0,
  none: 1.0,
} as const;

export const STREAK_BONUSES = [
  { minStreak: 10, bonus: 250 },
  { minStreak: 5, bonus: 100 },
  { minStreak: 3, bonus: 50 },
] as const;

export const PERFECT_GAME_ACCURACY = 0.9;
export const PERFECT_GAME_BONUS = 500;

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
export const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
export const SOLANA_NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? 'devnet';
export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'ws://localhost:4000';

export const ANIMATION = {
  fast: 0.15,
  normal: 0.3,
  slow: 0.5,
  celebration: 1.0,
} as const;

export const LEGAL_DISCLAIMER =
  'This is a free skill game for entertainment purposes only. ' +
  'No real money is involved. This is not gambling. ' +
  'Success in this game does not guarantee success in real sports betting.';
