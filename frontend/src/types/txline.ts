/** Raw TxLINE API response shapes (see TXLINE_INTEGRATION_GUIDE.md). */

export interface TxlineScheduleMatch {
  id: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamCode: string;
  awayTeamCode: string;
  kickoffTime: string; // ISO
  status: 'upcoming' | 'live' | 'ht' | 'finished' | 'postponed';
  venue?: string;
  stage?: string;
  group?: string;
}

export interface TxlineScheduleResponse {
  matches: TxlineScheduleMatch[];
  pagination: { total: number; page: number; perPage: number };
}

export interface TxlineClock {
  minute: number;
  second: number;
  period: '1H' | 'HT' | '2H' | 'FT';
  addedTime?: number;
  running: boolean;
}

export interface TxlineTeamStats {
  possession?: number;
  shots?: number;
  shotsOnTarget?: number;
  corners?: number;
  fouls?: number;
  offsides?: number;
  yellowCards?: number;
  redCards?: number;
}

export interface TxlineEvent {
  id: string;
  type: 'goal' | 'red_card' | 'yellow_card' | 'corner' | 'penalty' | 'substitution';
  minute: number;
  team: 'home' | 'away';
  player?: string;
  description: string;
  timestamp: string; // ISO
}

export interface TxlineMatchSnapshot {
  matchId: string;
  status: string;
  clock?: TxlineClock;
  score: { home: number; away: number };
  teams: {
    home: { name: string; code?: string; stats: TxlineTeamStats };
    away: { name: string; code?: string; stats: TxlineTeamStats };
  };
  events: TxlineEvent[];
  lastUpdated: string;
}

export interface TxlineOddsSnapshot {
  matchId: string;
  markets: Record<string, Record<string, number>>;
  impliedProbabilities: Record<string, number>;
  lastUpdated: string;
  sourceCount: number;
  consensusConfidence: number;
}

export type TxlineStreamMessage =
  | { type: 'event'; payload: TxlineEvent }
  | { type: 'clock_update'; payload: TxlineClock }
  | { type: 'stat_update'; payload: { home: TxlineTeamStats; away: TxlineTeamStats } }
  | { type: 'status_change'; payload: { oldStatus: string; newStatus: string } };
