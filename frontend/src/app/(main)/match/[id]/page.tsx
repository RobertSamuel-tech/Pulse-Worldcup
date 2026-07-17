'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { EventFeed } from '@/components/match/EventFeed';
import { KickoffCountdown } from '@/components/match/KickoffCountdown';
import { PredictionButtons } from '@/components/match/PredictionButtons';
import { ConfettiEffect } from '@/components/shared/ConfettiEffect';
import dynamic from 'next/dynamic';

// Only needed after a correct prediction — keep it out of the initial bundle.
const ShareModal = dynamic(() =>
  import('@/components/shared/ShareModal').then((m) => m.ShareModal),
);
import { Timer } from '@/components/ui/Timer';
import { shortenAddress } from '@/lib/utils';
import { useUserStore } from '@/stores/useUserStore';
import type { ShareCardData } from '@/utils/share-image';
import { usePrediction } from '@/hooks/usePrediction';
import { getMatch } from '@/lib/txline';
import { getSocket, joinMatch, leaveMatch } from '@/lib/socket';
import { fetchMe, getSession } from '@/lib/auth-api';
import { formatPoints } from '@/utils/formatting';
import { teamFlag } from '@/utils/flags';
import { vibrate } from '@/lib/utils';
import type { PulseMatch } from '@/types/match';

const MATCH_REFRESH_MS = 60_000;

const SHARE_MESSAGES: Record<string, string> = {
  GOAL: 'I SENSED THAT GOAL!',
  RED_CARD: 'I SAW THAT RED COMING!',
  YELLOW_CARD: 'I CALLED THAT CARD!',
  CORNER: 'I READ THAT CORNER!',
  PENALTY: 'I FELT THAT PENALTY!',
  NONE: "I KNEW IT'D STAY CALM!",
};

/** Animated count-up for awarded points. */
function PointsCountUp({ points }: { points: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const duration = 800;
    let frame = 0;
    const step = (now: number): void => {
      const t = Math.min(1, (now - start) / duration);
      setDisplay(Math.round(points * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [points]);
  return (
    <span className="rounded-xl border-2 border-black bg-emerald-300 px-3 py-1 font-mono text-4xl font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      +{display}
    </span>
  );
}

export default function MatchPage() {
  const params = useParams<{ id: string }>();
  const matchId = params.id;

  const [match, setMatch] = useState<PulseMatch | null>(null);
  const [odds, setOdds] = useState<{ probabilityPct: number; sourceCount: number } | null>(null);
  const [stats, setStats] = useState({ totalPoints: 0, currentStreak: 0, bestStreak: 0 });
  const [shareData, setShareData] = useState<ShareCardData | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const statsLoaded = useRef(false);
  const user = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);

  const refreshMatch = useCallback(async () => {
    try {
      const detail = await getMatch(matchId);
      setMatch({ ...detail.match, events: detail.events });
      setOdds(detail.odds);
    } catch {
      // keep last known state; the list page handles hard failures
    }
  }, [matchId]);

  const prediction = usePrediction(matchId, () => void refreshMatch());

  useEffect(() => {
    void refreshMatch();
    const interval = setInterval(() => void refreshMatch(), MATCH_REFRESH_MS);
    return () => clearInterval(interval);
  }, [refreshMatch]);

  // Real-time room: instant event pushes + clock ticks while on this screen.
  useEffect(() => {
    const socket = getSocket();
    joinMatch(matchId);
    const onEvent = (): void => void refreshMatch();
    const onClock = (payload: { matchId: string; seconds: number }): void => {
      if (payload.matchId !== matchId) return;
      setMatch((m) =>
        m ? { ...m, minute: Math.floor(payload.seconds / 60) + 1 } : m,
      );
    };
    socket.on('match-event', onEvent);
    socket.on('clock-update', onClock);
    return () => {
      socket.off('match-event', onEvent);
      socket.off('clock-update', onClock);
      leaveMatch(matchId);
    };
  }, [matchId, refreshMatch]);

  // Initial stats from the session (prediction results overwrite them later).
  useEffect(() => {
    const token = getSession();
    if (!token || statsLoaded.current) return;
    statsLoaded.current = true;
    void fetchMe(token)
      .then(({ user: me }) => {
        setUser(me);
        const u = me as unknown as {
          totalPoints?: number;
          currentStreak?: number;
          bestStreak?: number;
        };
        setStats({
          totalPoints: u.totalPoints ?? 0,
          currentStreak: u.currentStreak ?? 0,
          bestStreak: u.bestStreak ?? 0,
        });
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (prediction.stats) setStats(prediction.stats);
  }, [prediction.stats]);

  // Celebrate / commiserate — and queue the share moment for notable wins
  useEffect(() => {
    if (prediction.phase !== 'result' || !prediction.result) return;
    const r = prediction.result;
    vibrate(r.wasCorrect ? 100 : 40);
    if (r.wasCorrect) {
      const streak = r.user?.currentStreak ?? 0;
      const card: ShareCardData = {
        username: user?.walletAddress ? shortenAddress(user.walletAddress, 4) : 'fan',
        message: SHARE_MESSAGES[r.eventType ?? 'NONE'] ?? SHARE_MESSAGES['NONE']!,
        streak,
        pointsEarned: r.pointsEarned,
      };
      setShareData(card);
      // Auto-open on notable achievements: streak 5+ or a sensed goal.
      if (streak >= 5 || r.eventType === 'GOAL') {
        const timer = setTimeout(() => setShareOpen(true), 2_600);
        return () => clearTimeout(timer);
      }
    }
  }, [prediction.phase, prediction.result, user]);

  const isLive = match?.status === 'live' || match?.status === 'halftime';
  const showResult = prediction.phase === 'result' && prediction.result !== null;
  const correct = showResult && prediction.result?.wasCorrect === true;

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-4 py-2">
      <ConfettiEffect isActive={correct} />

      {/* Screen flash: green on correct (0→0.2→0), subtle red on wrong (0→0.1→0) */}
      {showResult && (
        <motion.div
          key={prediction.result?.id}
          aria-hidden
          className="pointer-events-none fixed inset-0 z-40"
          style={{ backgroundColor: correct ? '#10B981' : '#EF4444' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, correct ? 0.2 : 0.1, 0] }}
          transition={{ duration: correct ? 0.3 : 0.2 }}
        />
      )}

      {/* White flash when the window hits zero */}
      {prediction.phase === 'resolving' && (
        <motion.div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-40 bg-white"
          initial={{ opacity: 0.35 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        />
      )}

      {/* Header: back + score + clock */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="rounded-lg border-2 border-black bg-white/60 p-2 font-bold leading-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          aria-label="Back to matches"
        >
          ←
        </Link>
        {match ? (
          <div className="flex items-center gap-2 font-bold">
            <span aria-hidden>{teamFlag(match.homeTeam) ?? match.homeTeamCode}</span>
            <span className="rounded-lg border-2 border-black bg-black px-2 font-mono text-lg font-black text-white">
              {match.homeScore} – {match.awayScore}
            </span>
            <span aria-hidden>{teamFlag(match.awayTeam) ?? match.awayTeamCode}</span>
          </div>
        ) : (
          <div className="h-6 w-24 animate-pulse rounded bg-black/10" />
        )}
        <span className="p-2 font-mono text-sm font-black">
          {isLive && match?.minute !== undefined ? `${match.minute}'` : match?.status === 'halftime' ? 'HT' : ''}
        </span>
      </div>

      {match && (
        <p className="text-center text-sm font-medium text-black/60">
          {match.homeTeam} vs {match.awayTeam}
          {!isLive && match.status === 'scheduled' && ' — kicks off soon'}
          {match.status === 'finished' && ' — full-time'}
        </p>
      )}

      {/* MARKET THINKS card */}
      <div className="rounded-xl border-4 border-black bg-gradient-to-br from-indigo-400 to-purple-400 px-4 py-3 text-center text-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <p className="text-xs font-bold uppercase tracking-wide">
          Market thinks
        </p>
        <p className="text-lg font-black">
          🎯 {odds ? `${Math.round(odds.probabilityPct)}%` : '—'} chance of action
        </p>
        <p className="text-xs font-medium opacity-90">
          (next 60 seconds{odds && odds.sourceCount > 0 ? ` · ${odds.sourceCount} bookmakers` : ''})
        </p>
      </div>

      {/* Prediction zone */}
      <div className="relative flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border-4 border-black bg-white/60 p-4 backdrop-blur-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <AnimatePresence mode="wait">
          {prediction.phase === 'active' || prediction.phase === 'resolving' ? (
            <motion.div
              key="countdown"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3"
            >
              <Timer secondsRemaining={prediction.secondsRemaining} />
              <p className="text-sm font-bold text-black/70">
                {prediction.phase === 'resolving' ? (
                  'Checking what happened…'
                ) : (
                  <>
                    You said{' '}
                    <span className="font-black">
                      {prediction.active?.predictedAction
                        ? "🟢 YES — something's brewing"
                        : '🔴 NO — calm before storm'}
                    </span>
                  </>
                )}
              </p>
            </motion.div>
          ) : showResult ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={
                correct
                  ? { opacity: 1, scale: 1 }
                  : { opacity: 1, scale: 1, x: [0, -8, 8, -6, 6, 0] }
              }
              exit={{ opacity: 0 }}
              transition={{ duration: correct ? 0.3 : 0.5 }}
              className="flex flex-col items-center gap-2 text-center"
            >
              {correct ? (
                <>
                  <span className="text-4xl" aria-hidden>
                    🎉
                  </span>
                  <p className="text-xl font-black uppercase">YOU CALLED IT!</p>
                  <PointsCountUp points={prediction.result?.pointsEarned ?? 0} />
                  {stats.currentStreak >= 2 && (
                    <motion.p
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4, duration: 0.3 }}
                      className="rounded-full border-2 border-black bg-amber-300 px-3 py-1 text-sm font-bold"
                    >
                      🔥 {stats.currentStreak} in a row!
                    </motion.p>
                  )}
                </>
              ) : (
                <>
                  <span className="text-4xl" aria-hidden>
                    😅
                  </span>
                  <p className="text-xl font-black">Not this time</p>
                  <p className="text-sm font-medium text-black/60">
                    Try again next time — your streak is safe.
                  </p>
                </>
              )}
            </motion.div>
          ) : prediction.phase === 'cooldown' ? (
            <motion.p
              key="cooldown"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-sm font-bold text-black/60"
            >
              Next window opening…
            </motion.p>
          ) : prediction.notLive && match ? (
            <motion.div key="notlive" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <KickoffCountdown kickoffTime={match.kickoffTime} />
            </motion.div>
          ) : (
            <motion.div
              key="buttons"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex w-full flex-col items-center gap-3"
            >
              <p className="text-sm font-black uppercase">
                Will something happen in the next 60 seconds?
              </p>
              {prediction.needsLogin ? (
                <Link
                  href="/login"
                  className="rounded-xl border-2 border-black bg-black px-6 py-3 font-bold text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
                >
                  Connect wallet to predict
                </Link>
              ) : (
                <PredictionButtons
                  onPredict={(action) => {
                    setShareData(null);
                    setShareOpen(false);
                    prediction.predict(action);
                  }}
                  disabled={prediction.phase !== 'idle'}
                />
              )}
              {prediction.error && (
                <p
                  role="alert"
                  className="rounded-xl border-2 border-black bg-red-300 px-3 py-1 text-center text-sm font-bold"
                >
                  {prediction.error}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Share chip — stays available after a correct call until the next prediction */}
      {shareData && !shareOpen && (
        <button
          className="mx-auto rounded-full border-2 border-black bg-indigo-400 px-4 py-2 text-sm font-bold text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-indigo-500 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
          onClick={() => setShareOpen(true)}
        >
          📤 Share your moment
        </button>
      )}
      {shareData && (
        <ShareModal isOpen={shareOpen} onClose={() => setShareOpen(false)} data={shareData} />
      )}

      {/* Status bar */}
      <div className="grid grid-cols-3 gap-2 rounded-xl border-4 border-black bg-white/60 px-4 py-3 text-center text-sm backdrop-blur-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <div>
          <p className="text-xs font-bold text-black/60">🔥 Streak</p>
          <p className="font-mono text-lg font-black">{stats.currentStreak}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-black/60">💎 Points</p>
          <p className="font-mono text-lg font-black">{formatPoints(stats.totalPoints)}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-black/60">🏅 Best</p>
          <p className="font-mono text-lg font-black">{stats.bestStreak}</p>
        </div>
      </div>

      {/* Event feed */}
      <div>
        <h2 className="mb-2 text-sm font-black uppercase tracking-wide">
          Event feed
        </h2>
        <EventFeed events={match?.events ?? []} />
      </div>
    </section>
  );
}
