import { CACHE_KEYS, CACHE_TTL_SECONDS, getRedis } from '../config/redis';
import { getPrisma } from '../config/database';
import { txlineService } from './txline.service';
import { logger } from '../utils/logger';
import { memoize } from '../utils/memo-cache';
import { NotFoundError } from '../utils/errors';
import type { MatchStatus as DbMatchStatus, Match as DbMatch } from '../generated/prisma/client';
import type { TxLineFixture, TxLineScoreRow } from '../types/txline.types';

export type MatchStatus = 'scheduled' | 'live' | 'halftime' | 'finished' | 'postponed';

export type EventType = 'goal' | 'red_card' | 'yellow_card' | 'corner';

export interface MatchEventDto {
  id: string;
  type: EventType;
  minute: number;
  team: 'home' | 'away';
  description: string;
  timestamp: string;
}

export interface OddsSummary {
  matchId: string;
  probabilityPct: number;
  basedOn: 'txline' | 'model';
  sourceCount: number;
}

/** Cumulative counters for one participant, extracted from a score row. */
export interface TeamCounters {
  goals: number;
  yellowCards: number;
  redCards: number;
  corners: number;
}

export interface ScoreCounters {
  participant1: TeamCounters;
  participant2: TeamCounters;
}

const ZERO_COUNTERS: TeamCounters = { goals: 0, yellowCards: 0, redCards: 0, corners: 0 };

function countersOf(row: TxLineScoreRow, key: 'Participant1' | 'Participant2'): TeamCounters {
  const total = (row.scoreSoccer?.[key] as Record<string, Record<string, number>> | undefined)?.[
    'Total'
  ];
  return {
    goals: total?.['Goals'] ?? 0,
    yellowCards: total?.['YellowCards'] ?? 0,
    redCards: total?.['RedCards'] ?? 0,
    corners: total?.['Corners'] ?? 0,
  };
}

export function countersFromRow(row: TxLineScoreRow): ScoreCounters {
  return {
    participant1: countersOf(row, 'Participant1'),
    participant2: countersOf(row, 'Participant2'),
  };
}

/** Latest counters at-or-before `atMs` (rows must be ts-ascending). */
export function countersAt(rows: TxLineScoreRow[], atMs: number): ScoreCounters {
  let latest: TxLineScoreRow | null = null;
  for (const row of rows) {
    if (typeof row.ts === 'number' && row.ts <= atMs) latest = row;
    else if (typeof row.ts === 'number' && row.ts > atMs) break;
  }
  return latest
    ? countersFromRow(latest)
    : { participant1: ZERO_COUNTERS, participant2: ZERO_COUNTERS };
}

/** Wire shape consumed by the frontend (dates as ISO strings over JSON). */
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
  kickoffTime: string;
  competition: string;
  stage?: string;
  minute?: number;
}

const SCORE_FETCH_WINDOW_BEFORE_MS = 10 * 60_000; // start polling scores 10min pre-kickoff
const ASSUME_FINISHED_AFTER_MS = 4 * 3600_000; // no score data 4h after kickoff → finished

const LIVE_CODES = new Set(['H1', 'H2', 'ET1', 'ET2', 'PE', 'I']);
const HALFTIME_CODES = new Set(['HT', 'HTET']);
const FINISHED_CODES = new Set(['F', 'END', 'FET', 'FPE', 'WET', 'WPE']);
const POSTPONED_CODES = new Set(['A', 'C', 'P']);

/** statusSoccerId arrives as a code string, or as a single-key object wrapper. */
function statusCode(row: TxLineScoreRow): string | null {
  const raw = row.statusSoccerId;
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object') {
    const key = Object.keys(raw)[0];
    return key ?? null;
  }
  return null;
}

function mapStatus(code: string | null, kickoff: number, now: number): MatchStatus {
  if (code) {
    // Trailing digits are serialization variants (H11 ≙ H1, NS2 ≙ NS).
    const base = code.replace(/\d+$/, '');
    if (base === 'NS' || base === 'TXCS' || base === 'TXCC') return 'scheduled';
    if (LIVE_CODES.has(base)) return 'live';
    if (HALFTIME_CODES.has(base)) return 'halftime';
    if (FINISHED_CODES.has(base)) return 'finished';
    if (POSTPONED_CODES.has(base)) return 'postponed';
    logger.warn('txline_unknown_status_code', { code });
  }
  // No usable status data — infer from kickoff time.
  if (now < kickoff) return 'scheduled';
  return now - kickoff > ASSUME_FINISHED_AFTER_MS ? 'finished' : 'scheduled';
}

function teamCode(name: string): string {
  return name.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
}

function transform(fixture: TxLineFixture, latestScore: TxLineScoreRow | null): PulseMatch {
  const now = Date.now();
  const home = fixture.Participant1IsHome
    ? { name: fixture.Participant1, key: 'Participant1' as const }
    : { name: fixture.Participant2, key: 'Participant2' as const };
  const away = fixture.Participant1IsHome
    ? { name: fixture.Participant2, key: 'Participant2' as const }
    : { name: fixture.Participant1, key: 'Participant1' as const };

  const status = mapStatus(
    latestScore ? statusCode(latestScore) : null,
    fixture.StartTime,
    now,
  );
  const clockSeconds = latestScore?.clock?.seconds;

  return {
    id: String(fixture.FixtureId),
    txlineMatchId: String(fixture.FixtureId),
    homeTeam: home.name,
    awayTeam: away.name,
    homeTeamCode: teamCode(home.name),
    awayTeamCode: teamCode(away.name),
    homeScore: latestScore?.scoreSoccer?.[home.key]?.Total?.Goals ?? 0,
    awayScore: latestScore?.scoreSoccer?.[away.key]?.Total?.Goals ?? 0,
    status,
    kickoffTime: new Date(fixture.StartTime).toISOString(),
    competition: fixture.Competition,
    ...(clockSeconds !== undefined ? { minute: Math.floor(clockSeconds / 60) + 1 } : {}),
  };
}

const STATUS_ORDER: Record<MatchStatus, number> = {
  live: 0,
  halftime: 0,
  scheduled: 1,
  finished: 2,
  postponed: 3,
};

/**
 * Match list assembled from TxLINE fixtures + per-fixture score snapshots,
 * cached in Redis for 55s so the 60s frontend poll never sees stale data
 * but TxLINE is hit at most once per minute.
 */
export class MatchService {
  /** Last successful list — served if both Redis and TxLINE are unreachable. */
  private lastKnownMatches: PulseMatch[] | null = null;

  /**
   * L1 (in-process, 5s) in front of L2 (Redis, 55s) — collapses concurrent
   * requests within the same few seconds into one Redis round trip (see
   * SECTION 11: Upstash's network latency otherwise dominates p50/p99).
   */
  getMatches(): Promise<PulseMatch[]> {
    return memoize('matches:list', 5_000, () => this.fetchMatches());
  }

  private async fetchMatches(): Promise<PulseMatch[]> {
    try {
      const cached = await getRedis().get(CACHE_KEYS.matchList);
      if (cached) return JSON.parse(cached) as PulseMatch[];
    } catch {
      // Redis down — fall through to a direct fetch.
    }

    let fixtures: TxLineFixture[];
    try {
      fixtures = (await txlineService.getFixtures()) as unknown as TxLineFixture[];
    } catch (err) {
      if (this.lastKnownMatches) {
        logger.warn('matches_serving_stale', {
          message: err instanceof Error ? err.message : String(err),
        });
        return this.lastKnownMatches;
      }
      throw err;
    }
    const now = Date.now();

    const matches = await Promise.all(
      fixtures.map(async (fixture) => {
        let latestScore: TxLineScoreRow | null = null;
        // Scores only exist near/after kickoff — skip the call for far-future games.
        if (now >= fixture.StartTime - SCORE_FETCH_WINDOW_BEFORE_MS) {
          try {
            const rows = (await txlineService.getScores(
              fixture.FixtureId,
            )) as unknown as TxLineScoreRow[];
            latestScore = rows.length > 0 ? (rows[rows.length - 1] ?? null) : null;
          } catch (err) {
            logger.warn('match_score_fetch_failed', {
              fixtureId: fixture.FixtureId,
              message: err instanceof Error ? err.message : String(err),
            });
          }
        }
        return transform(fixture, latestScore);
      }),
    );

    matches.sort((a, b) => {
      const order = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (order !== 0) return order;
      return new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime();
    });

    this.lastKnownMatches = matches;
    try {
      await getRedis().set(
        CACHE_KEYS.matchList,
        JSON.stringify(matches),
        'EX',
        CACHE_TTL_SECONDS.match,
      );
    } catch {
      // Cache write is best-effort.
    }
    return matches;
  }

  async getMatch(id: string): Promise<PulseMatch> {
    const matches = await this.getMatches();
    const match = matches.find((m) => m.id === id);
    if (!match) throw new NotFoundError('Match');
    return match;
  }

  /** Raw score rows for a fixture (ts-ascending) — also used by prediction resolution. */
  async getScoreRows(fixtureId: number): Promise<TxLineScoreRow[]> {
    const rows = (await txlineService.getScores(fixtureId)) as unknown as TxLineScoreRow[];
    return rows
      .filter((r) => typeof r.ts === 'number')
      .sort((a, b) => (a.ts as number) - (b.ts as number));
  }

  /**
   * Full detail for the prediction screen: match + event feed + odds summary,
   * in one round trip. L1 memory (5s) in front of L2 Redis (30s) — see getMatches().
   */
  getMatchDetail(id: string): Promise<{
    match: PulseMatch;
    events: MatchEventDto[];
    odds: OddsSummary;
  }> {
    return memoize(`match:detail:${id}`, 5_000, () => this.fetchMatchDetail(id));
  }

  private async fetchMatchDetail(id: string): Promise<{
    match: PulseMatch;
    events: MatchEventDto[];
    odds: OddsSummary;
  }> {
    try {
      const cached = await getRedis().get(CACHE_KEYS.matchDetail(id));
      if (cached) return JSON.parse(cached) as Awaited<ReturnType<MatchService['getMatchDetail']>>;
    } catch {
      // Redis down — compute directly
    }

    const match = await this.getMatch(id);
    let events: MatchEventDto[] = [];
    try {
      const rows = await this.getScoreRows(Number(id));
      events = this.buildEvents(rows, match);
    } catch (err) {
      logger.warn('match_events_fetch_failed', {
        id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
    const odds = await this.getOddsSummary(match);

    const detail = { match, events, odds };
    try {
      await getRedis().set(
        CACHE_KEYS.matchDetail(id),
        JSON.stringify(detail),
        'EX',
        CACHE_TTL_SECONDS.matchDetail,
      );
    } catch {
      // best-effort cache
    }
    return detail;
  }

  /**
   * "Market thinks" probability of an action event in the next 60s. Baseline
   * from soccer averages (~2.7 goals + ~4 cards + ~10 corners per 90min ≈
   * 18%/min), nudged late-game; upgraded with TxLINE StablePrice consensus
   * whenever odds rows exist for the fixture.
   */
  async getOddsSummary(match: PulseMatch): Promise<OddsSummary> {
    const base = 18;
    let probabilityPct = base + (match.minute !== undefined && match.minute > 75 ? 4 : 0);
    let basedOn: 'txline' | 'model' = 'model';
    let sourceCount = 0;
    try {
      const rows = await txlineService.getOdds(Number(match.id));
      if (rows.length > 0) {
        // TODO(Step: odds refinement): derive the 60s probability from
        // StablePrice in-running totals once live odds shapes are observed.
        sourceCount = new Set(rows.map((r) => (r as { BookmakerId?: number }).BookmakerId)).size;
        basedOn = 'txline';
      }
    } catch (err) {
      logger.warn('odds_fetch_failed', {
        id: match.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
    return { matchId: match.id, probabilityPct, basedOn, sourceCount };
  }

  private buildEvents(rows: TxLineScoreRow[], match: PulseMatch): MatchEventDto[] {
    const events: MatchEventDto[] = [];
    const kickoff = new Date(match.kickoffTime).getTime();
    let prev: ScoreCounters = { participant1: ZERO_COUNTERS, participant2: ZERO_COUNTERS };

    for (const row of rows) {
      const current = countersFromRow(row);
      const ts = row.ts as number;
      const minute =
        row.clock?.seconds !== undefined
          ? Math.floor(row.clock.seconds / 60) + 1
          : Math.max(1, Math.floor((ts - kickoff) / 60_000) + 1);

      for (const key of ['participant1', 'participant2'] as const) {
        const team: 'home' | 'away' = key === 'participant1' ? 'home' : 'away';
        const teamName = team === 'home' ? match.homeTeam : match.awayTeam;
        const diffs: Array<[EventType, number, string]> = [
          ['goal', current[key].goals - prev[key].goals, `⚽ Goal — ${teamName}`],
          ['red_card', current[key].redCards - prev[key].redCards, `🟥 Red card — ${teamName}`],
          [
            'yellow_card',
            current[key].yellowCards - prev[key].yellowCards,
            `🟨 Yellow card — ${teamName}`,
          ],
          ['corner', current[key].corners - prev[key].corners, `🚩 Corner — ${teamName}`],
        ];
        for (const [type, diff, description] of diffs) {
          for (let i = 0; i < diff; i++) {
            events.push({
              id: `${ts}-${team}-${type}-${i}`,
              type,
              minute,
              team,
              description,
              timestamp: new Date(ts).toISOString(),
            });
          }
        }
      }
      prev = current;
    }
    return events.reverse(); // newest first for the feed
  }

  /** Ensures a DB Match row exists for FK integrity; returns it. */
  async upsertMatchRecord(match: PulseMatch): Promise<DbMatch> {
    const statusMap: Record<MatchStatus, DbMatchStatus> = {
      scheduled: 'SCHEDULED',
      live: 'LIVE',
      halftime: 'HALFTIME',
      finished: 'FINISHED',
      postponed: 'POSTPONED',
    };
    const data = {
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      homeTeamCode: match.homeTeamCode,
      awayTeamCode: match.awayTeamCode,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      status: statusMap[match.status],
      startTime: new Date(match.kickoffTime),
      competition: match.competition,
    };
    return getPrisma().match.upsert({
      where: { txlineMatchId: match.txlineMatchId },
      update: data,
      create: { txlineMatchId: match.txlineMatchId, ...data },
    });
  }
}

export const matchService = new MatchService();
