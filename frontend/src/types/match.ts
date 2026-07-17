export type MatchStatus = 'scheduled' | 'live' | 'halftime' | 'finished' | 'postponed';

export type EventType =
  | 'goal'
  | 'red_card'
  | 'yellow_card'
  | 'corner'
  | 'penalty'
  | 'substitution';

export interface MatchClock {
  minute: number;
  second: number;
  period: '1H' | 'HT' | '2H' | 'FT';
  addedTime: number;
  isRunning: boolean;
}

export interface TeamStats {
  possession: number;
  shots: number;
  shotsOnTarget: number;
  corners: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
}

export interface MatchStatistics {
  home: TeamStats;
  away: TeamStats;
}

export interface MatchEvent {
  id: string;
  type: EventType;
  minute: number;
  team: 'home' | 'away';
  player?: string;
  description: string;
  timestamp: Date;
}

export interface PulseMatch {
  id: string;
  txlineMatchId: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamCode: string;
  awayTeamCode: string;
  homeScore: number;
  awayScore: number;
  status: MatchStatus;
  kickoffTime: Date;
  competition?: string;
  minute?: number;
  stage?: string;
  venue?: string;
  clock?: MatchClock;
  statistics?: MatchStatistics;
  events?: MatchEvent[];
}
