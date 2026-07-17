'use client';

import { vibrate } from '@/lib/utils';

interface PredictionButtonsProps {
  onPredict: (action: boolean) => void;
  disabled?: boolean;
}

/**
 * The core interaction: two large thumb-zone buttons.
 * TODO(Step: UI polish): Framer Motion press animation, glow pulse, sounds.
 */
export function PredictionButtons({ onPredict, disabled = false }: PredictionButtonsProps) {
  const handlePress = (action: boolean) => {
    if (disabled) return;
    vibrate(50);
    onPredict(action);
  };

  return (
    <div className="flex w-full flex-col gap-3">
      <button
        className="min-h-16 w-full rounded-xl border-4 border-black bg-emerald-400 py-4 text-lg font-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-x-[6px] active:translate-y-[6px] active:shadow-none disabled:opacity-50"
        onClick={() => handlePress(true)}
        disabled={disabled}
        aria-label="Predict something will happen in the next 60 seconds"
      >
        🟢 YES
        <span className="block text-sm font-bold opacity-80">Something&apos;s brewing!</span>
      </button>
      <button
        className="min-h-16 w-full rounded-xl border-4 border-black bg-red-400 py-4 text-lg font-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-x-[6px] active:translate-y-[6px] active:shadow-none disabled:opacity-50"
        onClick={() => handlePress(false)}
        disabled={disabled}
        aria-label="Predict a calm period in the next 60 seconds"
      >
        🔴 NO
        <span className="block text-sm font-bold opacity-80">Calm before storm</span>
      </button>
    </div>
  );
}
