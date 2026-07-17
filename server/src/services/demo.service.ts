import { getPrisma } from '../config/database';
import { logger } from '../utils/logger';
import { NotFoundError } from '../utils/errors';
import { HARDCODED_DEMO_MATCHES, type DemoMatchSeed } from './demo-data';
import { openRouterFetcher } from './openrouter-fetcher';
import type { EventType as DbEventType } from '../generated/prisma/client';

/** Lowercase event types matching the frontend's MatchEvent shape. */
const EVENT_TYPE_MAP: Record<DbEventType, string> = {
  GOAL: 'goal',
  RED_CARD: 'red_card',
  YELLOW_CARD: 'yellow_card',
  CORNER: 'corner',
  PENALTY: 'penalty',
  SUBSTITUTION: 'substitution',
  NONE: 'substitution',
};

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

export interface DemoEventDto {
  id: string;
  type: string;
  minute: number;
  team: string;
  player: string | null;
  description: string;
}

class DemoService {
  /** List scenarios; auto-seed the hardcoded set on first call so /replay is never empty. */
  async getDemoMatches(): Promise<DemoMatchSummary[]> {
    const prisma = getPrisma();
    const count = await prisma.demoMatch.count();
    if (count === 0) {
      await this.insertSeeds(HARDCODED_DEMO_MATCHES, 'hardcoded');
      logger.info('demo_seeded_hardcoded', { matches: HARDCODED_DEMO_MATCHES.length });
    }
    const rows = await prisma.demoMatch.findMany({
      orderBy: { createdAt: 'asc' },
      include: { events: { select: { type: true } } },
    });
    return rows.map((m) => ({
      id: m.id,
      label: m.label,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      homeTeamCode: m.homeTeamCode,
      awayTeamCode: m.awayTeamCode,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      stage: m.stage,
      excitement: m.excitement,
      goalCount: m.events.filter((e) => e.type === 'GOAL').length,
      cardCount: m.events.filter((e) => e.type === 'RED_CARD' || e.type === 'YELLOW_CARD').length,
      source: m.source,
    }));
  }

  async getDemoMatch(id: string): Promise<{ match: DemoMatchSummary; events: DemoEventDto[] }> {
    const prisma = getPrisma();
    const row = await prisma.demoMatch.findUnique({
      where: { id },
      include: { events: { orderBy: { minute: 'asc' } } },
    });
    if (!row) throw new NotFoundError('Demo match not found');
    return {
      match: {
        id: row.id,
        label: row.label,
        homeTeam: row.homeTeam,
        awayTeam: row.awayTeam,
        homeTeamCode: row.homeTeamCode,
        awayTeamCode: row.awayTeamCode,
        homeScore: row.homeScore,
        awayScore: row.awayScore,
        stage: row.stage,
        excitement: row.excitement,
        goalCount: row.events.filter((e) => e.type === 'GOAL').length,
        cardCount: row.events.filter((e) => e.type === 'RED_CARD' || e.type === 'YELLOW_CARD')
          .length,
        source: row.source,
      },
      events: row.events.map((e) => ({
        id: e.id,
        type: EVENT_TYPE_MAP[e.type],
        minute: e.minute,
        team: e.team,
        player: e.player,
        description: e.description,
      })),
    };
  }

  /**
   * Refresh scenarios from OpenRouter. Existing OpenRouter rows are replaced;
   * hardcoded rows are kept as the permanent safety net. Falls back silently —
   * the endpoint reports what happened but the table always stays servable.
   */
  async seedFromOpenRouter(): Promise<{ seeded: number; source: string; error?: string }> {
    const result = await openRouterFetcher.fetchWorldCupData();
    if (!result.success) {
      // Ensure at least hardcoded data exists so the page still works.
      await this.getDemoMatches();
      return { seeded: 0, source: 'openrouter', ...(result.error ? { error: result.error } : {}) };
    }
    const prisma = getPrisma();
    await prisma.demoMatch.deleteMany({ where: { source: 'openrouter' } });
    await this.insertSeeds(result.matches, 'openrouter');
    logger.info('demo_seeded_openrouter', { matches: result.matches.length });
    return { seeded: result.matches.length, source: 'openrouter' };
  }

  private async insertSeeds(seeds: DemoMatchSeed[], source: string): Promise<void> {
    const prisma = getPrisma();
    for (const seed of seeds) {
      await prisma.demoMatch.create({
        data: {
          label: seed.label,
          homeTeam: seed.homeTeam,
          awayTeam: seed.awayTeam,
          homeTeamCode: seed.homeTeamCode,
          awayTeamCode: seed.awayTeamCode,
          homeScore: seed.homeScore,
          awayScore: seed.awayScore,
          stage: seed.stage,
          excitement: seed.excitement,
          source,
          events: {
            create: seed.events.map((e) => ({
              type: e.type,
              minute: e.minute,
              team: e.team,
              player: e.player ?? null,
              description: e.description,
            })),
          },
        },
      });
    }
  }
}

export const demoService = new DemoService();
