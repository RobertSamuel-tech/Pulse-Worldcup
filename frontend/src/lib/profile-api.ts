import { authedFetch } from './auth-api';
import { SOLANA_RPC_URL } from './constants';

/** Profile page data clients — all authed except the Solana RPC helpers. */

export interface ProfileBundle {
  user: {
    walletAddress: string;
    username: string | null;
    favoriteTeam: string | null;
    createdAt: string;
  };
  stats: {
    totalPredictions: number;
    accuracy: number;
    currentStreak: number;
    bestStreak: number;
    totalPoints: number;
    rank: number;
  };
}

export interface HistoryEntry {
  id: string;
  predictedAction: boolean;
  matchMinute: number;
  wasCorrect: boolean | null;
  eventOccurred: boolean | null;
  eventType: string | null;
  pointsEarned: number;
  createdAt: string;
  match: {
    homeTeam: string;
    awayTeam: string;
    homeTeamCode: string;
    awayTeamCode: string;
    homeScore: number;
    awayScore: number;
  } | null;
}

export interface IntuitionStats {
  totalPredictions: number;
  accuracy: number;
  intuitionProfile: {
    goalAccuracy: number;
    cardAccuracy: number;
    cornerAccuracy: number;
    calmAccuracy: number;
  };
}

export interface Achievement {
  id: string;
  name: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  description: string;
  earned: boolean;
}

export type HistoryFilter = 'today' | 'week' | 'all';

export function getProfile(): Promise<ProfileBundle> {
  return authedFetch<ProfileBundle>('/api/user/profile');
}

export function getHistory(
  filter: HistoryFilter,
  limit = 20,
  offset = 0,
): Promise<{ predictions: HistoryEntry[]; total: number }> {
  return authedFetch(`/api/user/predictions?filter=${filter}&limit=${limit}&offset=${offset}`);
}

export function getIntuition(): Promise<IntuitionStats> {
  return authedFetch<IntuitionStats>('/api/user/stats');
}

export function getAchievements(): Promise<{ achievements: Achievement[] }> {
  return authedFetch('/api/user/achievements');
}

export function saveSettings(settings: {
  username?: string;
  favoriteTeam?: string;
}): Promise<{ user: { username: string | null; favoriteTeam: string | null } }> {
  return authedFetch('/api/user/settings', { method: 'POST', body: JSON.stringify(settings) });
}

// ── Solana RPC (plain JSON-RPC — deliberately avoids the 110KB web3.js bundle) ──

export async function getSolBalance(address: string): Promise<number> {
  const res = await fetch(SOLANA_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [address] }),
  });
  if (!res.ok) throw new Error('RPC unavailable');
  const json = (await res.json()) as { result?: { value?: number } };
  const lamports = json.result?.value;
  if (typeof lamports !== 'number') throw new Error('Bad RPC response');
  return lamports / 1_000_000_000;
}

export async function requestAirdrop(address: string): Promise<void> {
  const res = await fetch(SOLANA_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'requestAirdrop',
      params: [address, 1_000_000_000],
    }),
  });
  const json = (await res.json()) as { error?: { message?: string } };
  if (json.error) throw new Error(json.error.message ?? 'Airdrop failed');
}
