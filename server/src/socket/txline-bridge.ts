import { txlineService } from '../services/txline.service';
import { countersFromRow } from '../services/match.service';
import type { ScoreCounters } from '../services/match.service';
import { emitToMatch } from './emitter';
import { logger } from '../utils/logger';
import type { StreamHandle, TxLineScoreRow } from '../types/txline.types';

/**
 * Bridges the global TxLINE scores SSE stream into per-match socket rooms:
 *  - counter diffs → `match-event` {matchId, event:{type, team, minute}}
 *  - clock rows    → `clock-update` {matchId, seconds, running}
 * Best-effort: exact live-stream row shapes get confirmed with the first live
 * match; the parser is defensive and logs unknown rows at debug level.
 */

const lastCounters = new Map<string, ScoreCounters>();
let handle: StreamHandle | null = null;

type EventKind = 'goal' | 'red_card' | 'yellow_card' | 'corner';

function fixtureIdOf(row: TxLineScoreRow): string | null {
  const candidate =
    (row as { FixtureId?: unknown }).FixtureId ??
    (row as { fixtureId?: unknown }).fixtureId ??
    null;
  return typeof candidate === 'number' || typeof candidate === 'string'
    ? String(candidate)
    : null;
}

function diffEvents(prev: ScoreCounters, next: ScoreCounters): Array<{
  type: EventKind;
  team: 'home' | 'away';
}> {
  const events: Array<{ type: EventKind; team: 'home' | 'away' }> = [];
  for (const key of ['participant1', 'participant2'] as const) {
    // NOTE: participant1 ≙ home in the World Cup feed observed so far.
    const team: 'home' | 'away' = key === 'participant1' ? 'home' : 'away';
    const pairs: Array<[EventKind, number]> = [
      ['goal', next[key].goals - prev[key].goals],
      ['red_card', next[key].redCards - prev[key].redCards],
      ['yellow_card', next[key].yellowCards - prev[key].yellowCards],
      ['corner', next[key].corners - prev[key].corners],
    ];
    for (const [type, diff] of pairs) {
      for (let i = 0; i < diff; i++) events.push({ type, team });
    }
  }
  return events;
}

function handleRow(row: TxLineScoreRow): void {
  const matchId = fixtureIdOf(row);
  if (!matchId) return;

  if (row.clock && typeof row.clock.seconds === 'number') {
    emitToMatch(matchId, 'clock-update', {
      matchId,
      seconds: row.clock.seconds,
      running: row.clock.running ?? true,
    });
  }

  if (row.scoreSoccer) {
    const next = countersFromRow(row);
    const prev = lastCounters.get(matchId);
    lastCounters.set(matchId, next);
    if (prev) {
      const minute =
        typeof row.clock?.seconds === 'number' ? Math.floor(row.clock.seconds / 60) + 1 : null;
      for (const event of diffEvents(prev, next)) {
        logger.info('txline_bridge_event', { matchId, ...event });
        emitToMatch(matchId, 'match-event', { matchId, event: { ...event, minute } });
      }
    }
  }
}

export function startTxLineBridge(): void {
  if (handle) return;
  handle = txlineService.streamScores({
    onMessage: (data) => {
      const rows = Array.isArray(data) ? data : [data];
      for (const row of rows) {
        if (row && typeof row === 'object') handleRow(row as TxLineScoreRow);
      }
    },
    onOpen: () => logger.info('txline_bridge_stream_open'),
    onError: (err) => logger.warn('txline_bridge_stream_error', { message: err.message }),
  });
}

export function stopTxLineBridge(): void {
  handle?.close();
  handle = null;
}
