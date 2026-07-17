'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EventFeed } from '@/components/match/EventFeed';
import { PredictionButtons } from '@/components/match/PredictionButtons';
import { ConfettiEffect } from '@/components/shared/ConfettiEffect';
import { Timer } from '@/components/ui/Timer';
import { getDemoMatch, type DemoMatchDetail, type DemoEvent } from '@/lib/demo-api';
import { calculatePoints } from '@/utils/scoring';
import { teamFlag } from '@/utils/flags';
import { vibrate } from '@/lib/utils';
import type { MatchEvent } from '@/types/match';

/**
 * Replay playback: a recorded scenario re-lived minute by minute.
 * Full parity with live mode UX (same Timer/PredictionButtons/EventFeed/
 * Confetti components) but the clock, events, and resolution are all local —
 * COMPLIANCE: no TxLINE calls, no server predictions, clearly demo-labeled.
 */

const TICK_MS = 250;
/** Real seconds per game minute at 1x. 90 minutes ≈ 2¼ real minutes. */
const REAL_SECONDS_PER_GAME_MINUTE = 1.5;
/** Prediction window in game minutes ("will something happen in the next 10?"). */
const WINDOW_GAME_MINUTES = 10;
const RESULT_DISPLAY_MS = 2_600;
const COOLDOWN_MS = 1_200;
const FULL_TIME_MINUTE = 90;

/** Events that resolve a YES prediction, in celebration priority order. */
const ACTION_PRIORITY: ReadonlyArray<DemoEvent['type']> = [
  'goal',
  'penalty',
  'red_card',
  'yellow_card',
  'corner',
];

type Phase = 'idle' | 'active' | 'result' | 'cooldown' | 'fulltime';

interface DemoResult {
  wasCorrect: boolean;
  eventType: DemoEvent['type'] | 'none';
  pointsEarned: number;
}

export default function ReplayPlaybackPage() {
  const params = useParams<{ id: string }>();
  const demoId = params.id;

  const [detail, setDetail] = useState<DemoMatchDetail | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [clockMin, setClockMin] = useState(0); // fractional game minutes
  const [speed, setSpeed] = useState(1);
  const [phase, setPhase] = useState<Phase>('idle');
  const [windowStart, setWindowStart] = useState<number | null>(null);
  const [predictedAction, setPredictedAction] = useState(false);
  const [result, setResult] = useState<DemoResult | null>(null);
  const [points, setPoints] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  useEffect(() => {
    getDemoMatch(demoId)
      .then(setDetail)
      .catch(() => setLoadError(true));
  }, [demoId]);

  // ── Playback clock ──
  useEffect(() => {
    if (!detail || phase === 'fulltime') return;
    const interval = setInterval(() => {
      setClockMin((m) =>
        Math.min(FULL_TIME_MINUTE, m + (TICK_MS / 1000 / REAL_SECONDS_PER_GAME_MINUTE) * speedRef.current),
      );
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [detail, phase]);

  // Full-time
  useEffect(() => {
    if (clockMin >= FULL_TIME_MINUTE && phase !== 'fulltime') setPhase('fulltime');
  }, [clockMin, phase]);

  // Events fired so far (drives score + feed)
  const firedEvents = useMemo(
    () => (detail?.events ?? []).filter((e) => e.minute <= clockMin),
    [detail, clockMin],
  );
  const homeScore = firedEvents.filter((e) => e.type === 'goal' && e.team === 'home').length;
  const awayScore = firedEvents.filter((e) => e.type === 'goal' && e.team === 'away').length;

  const feedEvents: MatchEvent[] = useMemo(
    () =>
      [...firedEvents].reverse().map((e) => ({
        id: e.id,
        type: e.type,
        minute: e.minute,
        team: e.team,
        ...(e.player ? { player: e.player } : {}),
        description: e.description,
        timestamp: new Date(),
      })),
    [firedEvents],
  );

  // ── Prediction resolution ──
  const resolveWindow = useCallback(
    (startMin: number, action: boolean) => {
      const windowEvents = (detail?.events ?? []).filter(
        (e) =>
          e.minute > startMin &&
          e.minute <= startMin + WINDOW_GAME_MINUTES &&
          ACTION_PRIORITY.includes(e.type),
      );
      const eventOccurred = windowEvents.length > 0;
      const topEvent = ACTION_PRIORITY.find((t) => windowEvents.some((e) => e.type === t));
      const wasCorrect = action === eventOccurred;
      const eventType: DemoResult['eventType'] = topEvent ?? 'none';
      const pointsEarned = wasCorrect
        ? calculatePoints(action, eventOccurred, eventType === 'none' ? 'none' : eventType, streak + 1)
        : 0;

      setResult({ wasCorrect, eventType, pointsEarned });
      setPhase('result');
      vibrate(wasCorrect ? 100 : 40);
      if (wasCorrect) {
        setPoints((p) => p + pointsEarned);
        setStreak((s) => {
          const next = s + 1;
          setBestStreak((b) => Math.max(b, next));
          return next;
        });
      }
      // streak intentionally survives wrong answers — same rule as live mode
    },
    [detail, streak],
  );

  // Window countdown / resolution trigger
  useEffect(() => {
    if (phase !== 'active' || windowStart === null) return;
    if (clockMin >= windowStart + WINDOW_GAME_MINUTES || clockMin >= FULL_TIME_MINUTE) {
      resolveWindow(windowStart, predictedAction);
    }
  }, [phase, windowStart, clockMin, predictedAction, resolveWindow]);

  // result → cooldown → idle
  useEffect(() => {
    if (phase === 'result') {
      const t = setTimeout(() => setPhase('cooldown'), RESULT_DISPLAY_MS);
      return () => clearTimeout(t);
    }
    if (phase === 'cooldown') {
      const t = setTimeout(() => {
        setResult(null);
        setWindowStart(null);
        setPhase('idle');
      }, COOLDOWN_MS);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const predict = (action: boolean): void => {
    vibrate(50);
    setPredictedAction(action);
    setWindowStart(clockMin);
    setPhase('active');
  };

  // Timer display: remaining window converted to real seconds at current speed
  const windowRemainingGameMin =
    windowStart === null ? 0 : Math.max(0, windowStart + WINDOW_GAME_MINUTES - clockMin);
  const realSecondsRemaining =
    (windowRemainingGameMin * REAL_SECONDS_PER_GAME_MINUTE) / speed;
  const windowTotalRealSeconds = (WINDOW_GAME_MINUTES * REAL_SECONDS_PER_GAME_MINUTE) / speed;

  const correct = phase === 'result' && result?.wasCorrect === true;

  if (loadError) {
    return (
      <section className="mx-auto flex w-full max-w-md flex-col items-center gap-4 py-10 text-center">
        <p className="rounded-xl border-2 border-black bg-red-300 px-4 py-3 text-sm font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          Couldn&apos;t load this replay.
        </p>
        <Link href="/replay" className="text-sm font-bold underline decoration-2 underline-offset-4">
          ← Back to scenarios
        </Link>
      </section>
    );
  }

  if (!detail) {
    return (
      <section className="mx-auto flex w-full max-w-md flex-col gap-4 py-4">
        <div className="h-8 w-full animate-pulse rounded-xl border-2 border-black/20 bg-white/50" />
        <div className="h-64 w-full animate-pulse rounded-xl border-4 border-black/20 bg-white/50" />
      </section>
    );
  }

  const { match } = detail;

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-4 py-2">
      <ConfettiEffect isActive={correct} />

      <div className="rounded-xl border-2 border-black bg-amber-300 px-3 py-1.5 text-center text-xs font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        🎬 DEMO MODE — recorded data
      </div>

      {/* Header: back + score + clock */}
      <div className="flex items-center justify-between">
        <Link
          href="/replay"
          className="rounded-lg border-2 border-black bg-white/60 p-2 font-bold leading-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          aria-label="Back to scenarios"
        >
          ←
        </Link>
        <div className="flex items-center gap-2 font-bold">
          <span aria-hidden>{teamFlag(match.homeTeam) ?? match.homeTeamCode}</span>
          <span className="rounded-lg border-2 border-black bg-black px-2 font-mono text-lg font-black text-white">
            {homeScore} – {awayScore}
          </span>
          <span aria-hidden>{teamFlag(match.awayTeam) ?? match.awayTeamCode}</span>
        </div>
        <span className="rounded-lg border-2 border-black bg-amber-300 px-2 py-0.5 font-mono text-sm font-black">
          {Math.floor(clockMin)}&apos;
        </span>
      </div>

      <p className="text-center text-sm font-medium text-black/60">
        {match.homeTeam} vs {match.awayTeam} — {match.stage}
      </p>

      {/* Speed toggle */}
      <div className="flex justify-center gap-2" role="group" aria-label="Playback speed">
        {[1, 2, 4].map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            className={
              speed === s
                ? 'rounded-xl border-2 border-black bg-black px-3 py-1 text-xs font-bold text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                : 'rounded-xl border-2 border-black bg-white/50 px-3 py-1 text-xs font-bold hover:bg-white/80'
            }
          >
            {s}x
          </button>
        ))}
      </div>

      {/* Prediction zone */}
      <div className="relative flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border-4 border-black bg-white/60 p-4 backdrop-blur-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <AnimatePresence mode="wait">
          {phase === 'fulltime' ? (
            <motion.div
              key="fulltime"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-3 text-center"
            >
              <span className="text-4xl" aria-hidden>
                🏁
              </span>
              <p className="text-xl font-black uppercase">Full-time!</p>
              <p className="rounded-xl border-2 border-black bg-emerald-300 px-4 py-1 font-mono text-2xl font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                +{points} pts
              </p>
              <p className="text-sm font-bold text-black/60">Best streak: {bestStreak} 🔥</p>
              <Link
                href="/replay"
                className="rounded-xl border-2 border-black bg-black px-5 py-2 text-sm font-bold text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
              >
                Try another scenario
              </Link>
            </motion.div>
          ) : phase === 'active' ? (
            <motion.div
              key="countdown"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3"
            >
              <Timer
                secondsRemaining={realSecondsRemaining}
                totalSeconds={windowTotalRealSeconds}
              />
              <p className="text-sm font-bold text-black/70">
                You said{' '}
                <span className="font-black">
                  {predictedAction ? "🟢 YES — something's brewing" : '🔴 NO — calm before storm'}
                </span>
              </p>
            </motion.div>
          ) : phase === 'result' && result ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={
                result.wasCorrect
                  ? { opacity: 1, scale: 1 }
                  : { opacity: 1, scale: 1, x: [0, -8, 8, -6, 6, 0] }
              }
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-2 text-center"
            >
              {result.wasCorrect ? (
                <>
                  <span className="text-4xl" aria-hidden>
                    🎉
                  </span>
                  <p className="text-xl font-black uppercase">YOU CALLED IT!</p>
                  <span className="rounded-xl border-2 border-black bg-emerald-300 px-3 py-1 font-mono text-4xl font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    +{result.pointsEarned}
                  </span>
                  {streak >= 2 && (
                    <span className="rounded-full border-2 border-black bg-amber-300 px-3 py-1 text-sm font-bold">
                      🔥 {streak} in a row!
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="text-4xl" aria-hidden>
                    😅
                  </span>
                  <p className="text-xl font-black">Not this time</p>
                  <p className="text-sm font-medium text-black/60">
                    Try again — your streak is safe.
                  </p>
                </>
              )}
            </motion.div>
          ) : phase === 'cooldown' ? (
            <motion.p
              key="cooldown"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-sm font-bold text-black/60"
            >
              Next window opening…
            </motion.p>
          ) : (
            <motion.div
              key="buttons"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex w-full flex-col items-center gap-3"
            >
              <p className="text-sm font-black uppercase">
                Will something happen in the next {WINDOW_GAME_MINUTES} match minutes?
              </p>
              <PredictionButtons onPredict={predict} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Session stats */}
      <div className="grid grid-cols-3 gap-2 rounded-xl border-4 border-black bg-white/60 px-4 py-3 text-center text-sm backdrop-blur-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <div>
          <p className="text-xs font-bold text-black/60">🔥 Streak</p>
          <p className="font-mono text-lg font-black">{streak}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-black/60">💎 Points</p>
          <p className="font-mono text-lg font-black">{points}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-black/60">🏅 Best</p>
          <p className="font-mono text-lg font-black">{bestStreak}</p>
        </div>
      </div>

      {/* Event feed (revealed as the clock passes each event) */}
      <div>
        <h2 className="mb-2 text-sm font-black uppercase tracking-wide">Event feed</h2>
        <EventFeed events={feedEvents} />
      </div>
    </section>
  );
}
