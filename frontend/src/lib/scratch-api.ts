import { authedFetch } from './auth-api';

export type ScratchTier = 'COMMON' | 'RARE' | 'LEGENDARY';
export type ScratchStatus = 'ACTIVE' | 'LOCKED' | 'RESOLVED' | 'EXPIRED';

export interface ScratchPanelDto {
  panelNumber: number;
  panelType: string;
  icon: string;
  label: string;
  /** null until the panel is scratched (server-side reveal). */
  prediction: boolean | null;
  valueHash: string;
  revealed: boolean;
  isCorrect: boolean | null;
  actual: { occurred: boolean; count: number } | null;
  pointsEarned: number;
}

export interface ScratchCardDto {
  id: string;
  matchId: string;
  tier: ScratchTier;
  status: ScratchStatus;
  cost: number;
  startMinute: number | null;
  pointsWagered: number;
  pointsEarned: number;
  panels: ScratchPanelDto[];
  createdAt: string;
  lockedAt: string | null;
  resolveAt: string | null;
  expiresAt: string;
  result: {
    totalPredictions: number;
    correctPredictions: number;
    accuracy: number;
    pointsEarned: number;
    unlockedAchievements: string[];
  } | null;
  user?: { totalPoints: number; currentStreak: number; bestStreak: number };
}

export interface ScratchHistoryEntry extends ScratchCardDto {
  matchInfo: {
    homeTeam: string;
    awayTeam: string;
    homeTeamCode: string;
    awayTeamCode: string;
  } | null;
}

export interface ScratchLeaderboardEntry {
  rank: number;
  username: string | null;
  walletAddress: string;
  totalCards: number;
  avgAccuracy: number;
  totalPointsEarned: number;
  bestCard: number;
}

export async function createScratchCard(
  matchId: string,
  tier: 'common' | 'rare' | 'legendary',
): Promise<ScratchCardDto> {
  const { card } = await authedFetch<{ card: ScratchCardDto; message: string }>(
    '/api/scratch/create',
    { method: 'POST', body: JSON.stringify({ matchId, tier }) },
  );
  return card;
}

/** Reveal scratched panels server-side; omit panelNumbers to reveal all. */
export async function revealScratchPanels(
  cardId: string,
  panelNumbers?: number[],
): Promise<ScratchCardDto> {
  const { card } = await authedFetch<{ card: ScratchCardDto }>('/api/scratch/reveal', {
    method: 'POST',
    body: JSON.stringify({ cardId, ...(panelNumbers ? { panelNumbers } : {}) }),
  });
  return card;
}

export async function lockInScratchCard(cardId: string): Promise<ScratchCardDto> {
  const { card } = await authedFetch<{ card: ScratchCardDto }>('/api/scratch/lock-in', {
    method: 'POST',
    body: JSON.stringify({ cardId }),
  });
  return card;
}

export function getScratchCard(id: string): Promise<ScratchCardDto> {
  return authedFetch(`/api/scratch/${id}`);
}

export function getActiveScratchCard(): Promise<ScratchCardDto | null> {
  return authedFetch('/api/scratch/active');
}

export function getScratchHistory(
  limit = 20,
  offset = 0,
): Promise<{ cards: ScratchHistoryEntry[]; total: number }> {
  return authedFetch(`/api/scratch/history?limit=${limit}&offset=${offset}`);
}

export async function getScratchLeaderboard(limit = 25): Promise<ScratchLeaderboardEntry[]> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/scratch/leaderboard?limit=${limit}`,
  );
  const json = (await res.json()) as {
    success: boolean;
    data: { leaderboard: ScratchLeaderboardEntry[] };
  };
  if (!res.ok || !json.success) throw new Error('Failed to load scratch leaderboard');
  return json.data.leaderboard;
}
