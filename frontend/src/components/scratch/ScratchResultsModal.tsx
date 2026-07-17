'use client';

import { useEffect, useRef, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ConfettiEffect } from '@/components/shared/ConfettiEffect';
import { ShareModal } from '@/components/shared/ShareModal';
import { useUserStore } from '@/stores/useUserStore';
import { cn } from '@/lib/utils';
import { playFanfare, playThud } from '@/utils/scratch-audio';
import type { ScratchCardDto, ScratchPanelDto } from '@/lib/scratch-api';

interface ScratchResultsModalProps {
  isOpen: boolean;
  card: ScratchCardDto;
  onClose: () => void;
  onScratchAnother: () => void;
}

function ResultRow({ panel }: { panel: ScratchPanelDto }) {
  const correct = panel.isCorrect === true;
  const actualText =
    panel.actual === null
      ? '—'
      : panel.panelType === 'CALM'
        ? panel.actual.occurred
          ? 'All quiet'
          : `${panel.actual.count} event${panel.actual.count === 1 ? '' : 's'}`
        : panel.actual.occurred
          ? `Yes${panel.actual.count > 1 ? ` ×${panel.actual.count}` : ''}`
          : 'Nothing';

  return (
    <div
      className={cn(
        'grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-2 rounded-lg border-2 border-black px-2 py-1.5 text-xs font-bold',
        correct ? 'bg-emerald-300/60' : 'bg-red-300/50',
      )}
    >
      <span className="text-base" aria-hidden>
        {panel.icon}
      </span>
      <span className="truncate uppercase">{panel.label}</span>
      <span className="font-mono">{panel.prediction ? 'YES' : 'NO'}</span>
      <span className="font-mono text-black/60">{actualText}</span>
      <span aria-label={correct ? 'correct' : 'wrong'}>{correct ? '✅' : '❌'}</span>
    </div>
  );
}

/**
 * Post-resolution reveal: panel-by-panel prediction vs what TxLINE actually
 * recorded during the 2-minute window, plus payout, streak, and share CTA.
 */
export function ScratchResultsModal({
  isOpen,
  card,
  onClose,
  onScratchAnother,
}: ScratchResultsModalProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const user = useUserStore((s) => s.user);
  const celebrated = useRef(false);

  const result = card.result;
  const won = (result?.pointsEarned ?? 0) > 0 && (result?.correctPredictions ?? 0) > 0;

  useEffect(() => {
    if (!isOpen || celebrated.current || !result) return;
    celebrated.current = true;
    if (won) {
      playFanfare();
      setConfetti(true);
      const timer = setTimeout(() => setConfetti(false), 1400);
      return () => clearTimeout(timer);
    }
    playThud();
  }, [isOpen, won, result]);

  if (!result) return null;

  const accuracyPct = Math.round(result.accuracy * 100);
  const summaryColor =
    accuracyPct >= 80 ? 'text-emerald-600' : accuracyPct >= 50 ? 'text-amber-600' : 'text-red-500';
  const netPoints = result.pointsEarned - card.pointsWagered;

  return (
    <>
      <ConfettiEffect isActive={confetti} />
      <Modal isOpen={isOpen} onClose={onClose} title="🎴 Scratch results">
        <div className="flex flex-col gap-4">
          <p className="-mt-2 text-xs font-bold text-black/60">
            {card.tier.charAt(0) + card.tier.slice(1).toLowerCase()} card ·{' '}
            {card.startMinute !== null
              ? `minutes ${card.startMinute}'–${card.startMinute + 2}'`
              : '2-minute window'}
          </p>

          <div className="flex flex-col gap-1.5" role="table" aria-label="Panel results">
            {card.panels.map((panel) => (
              <ResultRow key={panel.panelNumber} panel={panel} />
            ))}
          </div>

          <div className="rounded-xl border-2 border-black bg-white/70 p-4 text-center">
            <p className={cn('text-3xl font-black uppercase', summaryColor)}>
              {result.correctPredictions}/{result.totalPredictions} correct!
            </p>
            <p className="mt-1 font-mono text-lg font-black">
              {result.pointsEarned > 0 ? `+${result.pointsEarned.toLocaleString()} points` : 'No points this time'}
              {card.pointsWagered > 0 && (
                <span className="ml-1 text-xs font-bold text-black/50">
                  (net {netPoints >= 0 ? '+' : ''}
                  {netPoints.toLocaleString()})
                </span>
              )}
            </p>
            {card.user && card.user.currentStreak >= 2 && (
              <p className="mt-1 text-sm font-bold">🔥 Streak: {card.user.currentStreak}!</p>
            )}
            {result.unlockedAchievements.map((name) => (
              <p
                key={name}
                className="mx-auto mt-2 w-fit rounded-full border-2 border-black bg-amber-300 px-3 py-0.5 text-xs font-black"
              >
                🏆 Achievement Unlocked: {name}
              </p>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            {won && (
              <Button variant="primary" className="w-full" onClick={() => setShareOpen(true)}>
                📸 Share this result
              </Button>
            )}
            <Button variant="secondary" className="w-full" onClick={onScratchAnother}>
              🔄 Scratch another card
            </Button>
            <button
              className="w-full rounded-xl px-3 py-2 text-xs font-bold text-black/50 transition-colors hover:bg-black/10"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        data={{
          username: user?.username ?? 'anon',
          message: `I SCRATCHED ${result.correctPredictions}/${result.totalPredictions}!`,
          streak: card.user?.currentStreak ?? 0,
          pointsEarned: result.pointsEarned,
        }}
      />
    </>
  );
}
