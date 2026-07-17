'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScratchCard } from '@/components/scratch/ScratchCard';
import { ScratchCardSelector, type TierChoice } from '@/components/scratch/ScratchCardSelector';
import { ScratchResultsModal } from '@/components/scratch/ScratchResultsModal';
import { ScratchLeaderboard } from '@/components/scratch/ScratchLeaderboard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { getSession } from '@/lib/auth-api';
import {
  createScratchCard,
  getActiveScratchCard,
  getScratchCard,
  lockInScratchCard,
  revealScratchPanels,
  type ScratchCardDto,
} from '@/lib/scratch-api';
import { useUserStore } from '@/stores/useUserStore';

type Phase = 'loading' | 'select' | 'scratch' | 'waiting' | 'results';

const POLL_INTERVAL_MS = 5_000;

function Countdown({ resolveAt }: { resolveAt: string }) {
  const [msLeft, setMsLeft] = useState(() => Math.max(0, new Date(resolveAt).getTime() - Date.now()));

  useEffect(() => {
    const interval = setInterval(
      () => setMsLeft(Math.max(0, new Date(resolveAt).getTime() - Date.now())),
      250,
    );
    return () => clearInterval(interval);
  }, [resolveAt]);

  const totalMs = 2 * 60_000;
  const seconds = Math.ceil(msLeft / 1000);
  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, '0');
  const progress = 1 - msLeft / totalMs;

  return (
    <div className="rounded-xl border-4 border-black bg-white/60 p-6 text-center shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] backdrop-blur-md">
      <p className="text-sm font-black uppercase tracking-tight">🔒 Card locked!</p>
      <p className="mt-1 text-xs font-bold text-black/60">
        Watching the match unfold — results in…
      </p>
      <p className="my-4 font-mono text-5xl font-black" aria-live="polite">
        {seconds > 0 ? `${mm}:${ss}` : 'Checking…'}
      </p>
      <div className="h-4 w-full overflow-hidden rounded-full border-2 border-black bg-white">
        <motion.div
          className="h-full bg-indigo-400"
          initial={false}
          animate={{ width: `${Math.min(100, progress * 100)}%` }}
          transition={{ ease: 'linear', duration: 0.25 }}
        />
      </div>
      <p className="mt-3 text-xs font-bold text-black/50">
        Every panel will be judged against real TxODDS TxLINE match data. No take-backs!
      </p>
    </div>
  );
}

export default function ScratchPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('loading');
  const [card, setCard] = useState<ScratchCardDto | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const setStats = useUserStore((s) => s.setStats);
  const revealInFlight = useRef(false);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 4000);
  }, []);

  const syncStats = useCallback(
    (dto: ScratchCardDto) => {
      if (dto.user) setStats(dto.user);
    },
    [setStats],
  );

  // Auth guard + page-refresh recovery of a card already in play.
  useEffect(() => {
    if (!getSession()) {
      router.replace('/login');
      return;
    }
    getActiveScratchCard()
      .then((active) => {
        if (active) {
          setCard(active);
          setPhase(active.status === 'LOCKED' ? 'waiting' : 'scratch');
        } else {
          setPhase('select');
        }
      })
      .catch(() => setPhase('select'));
  }, [router]);

  // While waiting: poll until the backend resolves the card.
  useEffect(() => {
    if (phase !== 'waiting' || !card) return;
    let cancelled = false;
    const poll = async (): Promise<void> => {
      try {
        const fresh = await getScratchCard(card.id);
        if (cancelled) return;
        setCard(fresh);
        if (fresh.status === 'RESOLVED') {
          syncStats(fresh);
          setPhase('results');
        }
      } catch {
        // transient — next tick retries
      }
    };
    const interval = setInterval(() => void poll(), POLL_INTERVAL_MS);
    // Fire one immediately after the countdown ends for snappy resolution.
    const msLeft = card.resolveAt ? new Date(card.resolveAt).getTime() - Date.now() : 0;
    const endTimer = setTimeout(() => void poll(), Math.max(0, msLeft + 400));
    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(endTimer);
    };
  }, [phase, card?.id, card?.resolveAt, syncStats]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirm = async (matchId: string, tier: TierChoice): Promise<void> => {
    setIsCreating(true);
    try {
      const fresh = await createScratchCard(matchId, tier);
      setCard(fresh);
      setPhase('scratch');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not create your card. Try again!');
    } finally {
      setIsCreating(false);
    }
  };

  const handleReveal = useCallback(
    (panelNumbers?: number[]) => {
      if (!card) return;
      // Whole-card reveals shouldn't race per-panel ones.
      if (!panelNumbers && revealInFlight.current) return;
      revealInFlight.current = true;
      revealScratchPanels(card.id, panelNumbers)
        .then(setCard)
        .catch(() => showToast('Reveal hiccup — scratch again!'))
        .finally(() => {
          revealInFlight.current = false;
        });
    },
    [card, showToast],
  );

  const handleLockIn = async (): Promise<void> => {
    if (!card) return;
    setIsLocking(true);
    try {
      const fresh = await lockInScratchCard(card.id);
      setCard(fresh);
      syncStats(fresh);
      setPhase('waiting');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lock-in failed. Try again!');
    } finally {
      setIsLocking(false);
    }
  };

  const reset = (): void => {
    setCard(null);
    setPhase('select');
  };

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-5 py-4">
      <header>
        <h1 className="text-2xl font-black uppercase tracking-tight sm:text-3xl">
          🎴 Pulse Scratch
        </h1>
        <p className="text-sm font-bold text-black/60">
          Scratch to reveal predictions about the next 2 minutes — then watch them come true.
        </p>
      </header>

      {toast && (
        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border-2 border-black bg-amber-300 px-4 py-2 text-sm font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          role="status"
        >
          {toast}
        </motion.p>
      )}

      {phase === 'loading' && (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      )}

      {phase === 'select' && (
        <>
          <ScratchCardSelector onConfirm={(m, t) => void handleConfirm(m, t)} isCreating={isCreating} />
          <ScratchLeaderboard />
        </>
      )}

      {phase === 'scratch' && card && (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
          <ScratchCard
            card={card}
            onRevealRequest={handleReveal}
            onLockIn={() => void handleLockIn()}
            isLocking={isLocking}
          />
          <button
            className="mt-3 w-full rounded-xl px-3 py-2 text-xs font-bold text-black/50 transition-colors hover:bg-black/10"
            onClick={reset}
          >
            ← Abandon this card and pick another match
          </button>
        </motion.div>
      )}

      {phase === 'waiting' && card?.resolveAt && <Countdown resolveAt={card.resolveAt} />}

      {phase === 'results' && card && (
        <ScratchResultsModal
          isOpen
          card={card}
          onClose={reset}
          onScratchAnother={reset}
        />
      )}
    </section>
  );
}
