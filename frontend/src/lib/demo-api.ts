import { API_BASE_URL } from './constants';
import type { EventType } from '@/types/match';

/**
 * Replay/Demo mode client — recorded scenarios served by our backend.
 * Completely separate from live TxLINE data (lib/txline.ts).
 */

export interface DemoMatchSummary {
  id: string;
  label: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamCode: string;
  awayTeamCode: string;
  homeScore: number;
  awayScore: number;
  stage: string;
  excitement: number;
  goalCount: number;
  cardCount: number;
  source: string;
}

export interface DemoEvent {
  id: string;
  type: EventType;
  minute: number;
  team: 'home' | 'away';
  player: string | null;
  description: string;
}

export interface DemoMatchDetail {
  match: DemoMatchSummary;
  events: DemoEvent[];
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, { credentials: 'include' });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${path}`);
  }
  const json = (await res.json()) as { success: boolean; data: T };
  return json.data;
}

export async function getDemoMatches(): Promise<DemoMatchSummary[]> {
  const { matches } = await apiGet<{ matches: DemoMatchSummary[] }>('/api/demo/matches');
  return matches;
}

export async function getDemoMatch(id: string): Promise<DemoMatchDetail> {
  return apiGet<DemoMatchDetail>(`/api/demo/matches/${id}`);
}
