import { z } from 'zod';
import { config } from '../config';
import { logger } from '../utils/logger';
import type { DemoMatchSeed } from './demo-data';

/**
 * OpenRouter-backed demo scenario generator (Replay Mode ONLY).
 *
 * COMPLIANCE: live mode (/api/matches, /api/predictions) never touches this —
 * TxLINE remains the sole data source there. This exists so /replay can show
 * fresh, realistic World Cup scenarios after the tournament ends.
 *
 * Honest note: OpenRouter models do not browse the web. What we get back is
 * AI-GENERATED realistic match data, validated against a strict schema. The
 * hardcoded seeds in demo-data.ts remain the guaranteed fallback.
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;
const MAX_REQUESTS_PER_HOUR = 10;

const eventSchema = z.object({
  type: z.enum(['GOAL', 'RED_CARD', 'YELLOW_CARD', 'CORNER', 'PENALTY', 'SUBSTITUTION']),
  minute: z.number().int().min(1).max(120),
  team: z.enum(['home', 'away']),
  player: z.string().optional(),
  description: z.string().min(1).max(200),
});

const matchSchema = z.object({
  label: z.string().min(1).max(40),
  homeTeam: z.string().min(1).max(40),
  awayTeam: z.string().min(1).max(40),
  homeTeamCode: z.string().length(3),
  awayTeamCode: z.string().length(3),
  homeScore: z.number().int().min(0).max(15),
  awayScore: z.number().int().min(0).max(15),
  stage: z.string().min(1).max(40),
  excitement: z.number().int().min(1).max(5),
  events: z.array(eventSchema).min(6).max(20),
});

const responseSchema = z.array(matchSchema).min(1).max(5);

export interface FetchResult {
  success: boolean;
  matches: DemoMatchSeed[];
  error?: string;
  source: string;
  fetchedAt: Date;
}

export class OpenRouterFetcher {
  private requestTimestamps: number[] = [];

  async fetchWorldCupData(): Promise<FetchResult> {
    const fetchedAt = new Date();
    if (!config.OPENROUTER_API_KEY) {
      return { success: false, matches: [], error: 'OPENROUTER_API_KEY not configured', source: 'openrouter', fetchedAt };
    }
    if (!this.underRateLimit()) {
      return { success: false, matches: [], error: 'Rate limit: max 10 fetches/hour', source: 'openrouter', fetchedAt };
    }

    let lastError = 'unknown';
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const matches = await this.callOnce();
        logger.info('openrouter_fetch_ok', { attempt, matches: matches.length });
        return { success: true, matches, source: 'openrouter', fetchedAt };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        logger.warn('openrouter_fetch_failed', { attempt, error: lastError });
      }
    }
    return { success: false, matches: [], error: lastError, source: 'openrouter', fetchedAt };
  }

  private underRateLimit(): boolean {
    const hourAgo = Date.now() - 3_600_000;
    this.requestTimestamps = this.requestTimestamps.filter((t) => t > hourAgo);
    if (this.requestTimestamps.length >= MAX_REQUESTS_PER_HOUR) return false;
    this.requestTimestamps.push(Date.now());
    return true;
  }

  private async callOnce(): Promise<DemoMatchSeed[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${config.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.OPENROUTER_MODEL,
          messages: [{ role: 'user', content: this.buildPrompt() }],
          temperature: 0.8,
        }),
      });
      if (!res.ok) {
        throw new Error(`OpenRouter HTTP ${res.status}`);
      }
      const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = body.choices?.[0]?.message?.content;
      if (!content) throw new Error('Empty completion');
      return this.parseResponse(content);
    } finally {
      clearTimeout(timer);
    }
  }

  private buildPrompt(): string {
    return [
      'Generate realistic FIFA World Cup 2026 match scenarios for a football prediction demo game.',
      'Return ONLY a JSON array (no prose, no markdown fences) of exactly 3 matches:',
      '1. A high-scoring thriller (label "Goal Fest", 6+ goals)',
      '2. A tense match decided in the final minutes (label "Tense Finish", winner at minute 88+)',
      '3. A card-heavy battle (label "Card Chaos", 6+ cards including at least one RED_CARD)',
      'Each match object: {label, homeTeam, awayTeam, homeTeamCode (3 letters), awayTeamCode (3 letters),',
      'homeScore, awayScore, stage, excitement (1-5), events}.',
      'Each event: {type: GOAL|RED_CARD|YELLOW_CARD|CORNER|PENALTY|SUBSTITUTION, minute (1-90),',
      'team: "home"|"away", player (real current squad player), description (exciting commentary, max 150 chars)}.',
      'Use real national teams plausible for World Cup 2026 knockout rounds. 8-12 events per match,',
      'spread across the full 90 minutes. Goal counts MUST match the final score exactly.',
    ].join(' ');
  }

  private parseResponse(aiResponse: string): DemoMatchSeed[] {
    // Models sometimes wrap JSON in ```json fences despite instructions.
    const stripped = aiResponse.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
    const start = stripped.indexOf('[');
    const end = stripped.lastIndexOf(']');
    if (start === -1 || end === -1) throw new Error('No JSON array in response');
    const parsed: unknown = JSON.parse(stripped.slice(start, end + 1));
    const matches = responseSchema.parse(parsed);
    // Consistency guard: goal events must match the scoreline.
    for (const m of matches) {
      const goals = m.events.filter((e) => e.type === 'GOAL').length;
      if (goals !== m.homeScore + m.awayScore) {
        throw new Error(`Goal events (${goals}) != scoreline ${m.homeScore}-${m.awayScore}`);
      }
    }
    return matches;
  }
}

export const openRouterFetcher = new OpenRouterFetcher();
