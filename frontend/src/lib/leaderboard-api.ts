import { API_BASE_URL } from './constants';
import { getSession } from './auth-api';

/** Wire row from GET /api/leaderboard. */
export interface LeaderboardRowDto {
  rank: number;
  userId: string;
  username: string;
  walletAddress: string;
  points: number;
  accuracy: number;
  bestStreak: number;
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardRowDto[];
  myRank: number | null;
  myEntry: LeaderboardRowDto | null;
}

/** Rankings + the caller's own rank in one call (rank is null when signed out). */
export async function getLeaderboard(limit = 25, offset = 0): Promise<LeaderboardResponse> {
  const token = getSession();
  const res = await fetch(`${API_BASE_URL}/api/leaderboard?limit=${limit}&offset=${offset}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const json = (await res.json()) as { success: boolean; data: LeaderboardResponse };
  if (!res.ok || !json.success) throw new Error(`Leaderboard request failed (${res.status})`);
  return json.data;
}
