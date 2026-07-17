import { API_BASE_URL } from './constants';
import type { MatchEvent, PulseMatch } from '@/types/match';

/**
 * Frontend client for PULSE backend routes that proxy TxLINE.
 * TxLINE tokens NEVER reach the browser — all calls go through our Fastify server.
 * TODO(Step: match data integration): wire to real backend routes.
 */

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, { credentials: 'include' });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${path}`);
  }
  const json = (await res.json()) as { success: boolean; data: T };
  return json.data;
}

/** JSON serializes dates as strings — revive kickoffTime into a Date. */
function reviveMatch(match: PulseMatch): PulseMatch {
  return { ...match, kickoffTime: new Date(match.kickoffTime) };
}

export interface OddsSummary {
  matchId: string;
  probabilityPct: number;
  basedOn: 'txline' | 'model';
  sourceCount: number;
}

export interface MatchDetail {
  match: PulseMatch;
  events: MatchEvent[];
  odds: OddsSummary;
}

export async function getMatches(): Promise<PulseMatch[]> {
  const { matches } = await apiGet<{ matches: PulseMatch[] }>('/api/matches');
  return matches.map(reviveMatch);
}

/** Match + events + odds in one round trip. */
export async function getMatch(matchId: string): Promise<MatchDetail> {
  const detail = await apiGet<MatchDetail>(`/api/matches/${matchId}`);
  return { ...detail, match: reviveMatch(detail.match) };
}
