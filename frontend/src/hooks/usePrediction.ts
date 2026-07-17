'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiError,
  createPrediction,
  getActivePrediction,
  getPrediction,
  type PredictionDto,
  type UserStats,
} from '@/lib/prediction-api';
import { PREDICTION_COOLDOWN_SECONDS, PREDICTION_WINDOW_SECONDS } from '@/lib/constants';
import { getSocket } from '@/lib/socket';

export type PredictionPhase =
  | 'idle'
  | 'submitting'
  | 'active'
  | 'resolving'
  | 'result'
  | 'cooldown';

const RESULT_DISPLAY_MS = 2_500;
const RESOLVE_POLL_MS = 2_000;
const TICK_MS = 100;

interface UsePredictionResult {
  phase: PredictionPhase;
  secondsRemaining: number;
  active: PredictionDto | null;
  result: PredictionDto | null;
  stats: UserStats | null;
  error: string | null;
  needsLogin: boolean;
  /** Backend rejected with MATCH_NOT_LIVE — show the kickoff card instead. */
  notLive: boolean;
  predict: (action: boolean) => void;
}

/**
 * The prediction loop state machine:
 * idle → submitting → active (60s countdown) → resolving (poll) → result → cooldown → idle
 */
export function usePrediction(matchId: string, onResolved?: () => void): UsePredictionResult {
  const [phase, setPhase] = useState<PredictionPhase>('idle');
  const [secondsRemaining, setSecondsRemaining] = useState(PREDICTION_WINDOW_SECONDS);
  const [active, setActive] = useState<PredictionDto | null>(null);
  const [result, setResult] = useState<PredictionDto | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const clearTimers = useCallback(() => {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const enterResult = useCallback(
    (resolved: PredictionDto) => {
      setActive(null);
      setResult(resolved);
      if (resolved.user) setStats(resolved.user);
      setPhase('result');
      onResolved?.();
      timers.current.push(
        setTimeout(() => {
          setPhase('cooldown');
          timers.current.push(
            setTimeout(() => {
              setResult(null);
              setPhase('idle');
            }, PREDICTION_COOLDOWN_SECONDS * 1000),
          );
        }, RESULT_DISPLAY_MS),
      );
    },
    [onResolved],
  );

  const pollResolution = useCallback(
    (predictionId: string) => {
      setPhase('resolving');
      const poll = async (): Promise<void> => {
        try {
          const resolved = await getPrediction(predictionId);
          if (resolved.resolved) {
            enterResult(resolved);
            return;
          }
        } catch {
          // transient — keep polling
        }
        timers.current.push(setTimeout(() => void poll(), RESOLVE_POLL_MS));
      };
      void poll();
    },
    [enterResult],
  );

  /** Drive the countdown while a prediction is active. */
  const startCountdown = useCallback(
    (prediction: PredictionDto) => {
      setActive(prediction);
      setPhase('active');
      const resolveAtMs = new Date(prediction.resolveAt).getTime();
      const tick = (): void => {
        const remaining = (resolveAtMs - Date.now()) / 1000;
        if (remaining <= 0) {
          setSecondsRemaining(0);
          pollResolution(prediction.id);
          return;
        }
        setSecondsRemaining(remaining);
        timers.current.push(setTimeout(tick, TICK_MS));
      };
      tick();
    },
    [pollResolution],
  );

  // Real-time resolution push — beats the poll to the punch when the socket is up.
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  useEffect(() => {
    const socket = getSocket();
    const onResult = (dto: PredictionDto): void => {
      if (phaseRef.current === 'active' || phaseRef.current === 'resolving') {
        clearTimers();
        enterResult(dto);
      }
    };
    socket.on('prediction-result', onResult);
    return () => {
      socket.off('prediction-result', onResult);
    };
  }, [enterResult, clearTimers]);

  // Restore an in-flight prediction after reload/navigation.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const active = await getActivePrediction();
        if (cancelled || !active) return;
        if (active.matchId === matchId) {
          startCountdown(active);
        } else {
          pollResolution(active.id); // active on another match — let it finish
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) setNeedsLogin(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  const [notLive, setNotLive] = useState(false);

  const predict = useCallback(
    (action: boolean) => {
      if (phase !== 'idle') return;
      setError(null);
      setPhase('submitting');
      void createPrediction(matchId, action)
        .then((prediction) => startCountdown(prediction))
        .catch(async (err: unknown) => {
          setPhase('idle');
          if (err instanceof ApiError) {
            if (err.status === 401) {
              setNeedsLogin(true);
              return;
            }
            if (err.code === 'PREDICTION_CONFLICT') {
              // Resume the active window instead of dead-ending (SECTION 10).
              const activePrediction = await getActivePrediction().catch(() => null);
              if (activePrediction) {
                startCountdown(activePrediction);
                return;
              }
            }
            if (err.code === 'MATCH_NOT_LIVE') {
              setNotLive(true);
              return;
            }
            setError(err.message);
            return;
          }
          setError('Having trouble connecting. Please try again.');
        });
    },
    [phase, matchId, startCountdown],
  );

  return { phase, secondsRemaining, active, result, stats, error, needsLogin, notLive, predict };
}
