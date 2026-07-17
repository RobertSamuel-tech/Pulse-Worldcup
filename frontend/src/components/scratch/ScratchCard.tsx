'use client';

import { motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { hapticTick, playReveal, playScratch } from '@/utils/scratch-audio';
import type { ScratchCardDto, ScratchPanelDto, ScratchTier } from '@/lib/scratch-api';

/**
 * Hole-reveal mechanic (PlayerAlbum-style): the value is fetched on the FIRST
 * coin stroke and rendered UNDER the coating, so every hole genuinely shows
 * the content beneath. The coating never wipes all at once — it stays intact
 * except where scratched, and only the last flakes dissolve once ~85% is gone.
 */
const DISSOLVE_THRESHOLD = 0.85;
const CANVAS_W = 220;
const CANVAS_H = 160;
/** Distance between interpolated brush stamps — continuous grooves, not dots. */
const STROKE_STEP = 6;

interface TierStyle {
  name: string;
  coatingStops: [string, string];
  speckle: string;
  frame: string; // tailwind classes for the card frame
  holo?: boolean;
}

const TIER_STYLES: Record<ScratchTier, TierStyle> = {
  COMMON: {
    name: 'Common',
    coatingStops: ['#e2e2e2', '#8a8a8a'],
    speckle: 'rgba(255,255,255,0.5)',
    frame: 'bg-gradient-to-br from-slate-200 to-slate-400',
  },
  RARE: {
    name: 'Rare',
    coatingStops: ['#ffd700', '#ff9500'],
    speckle: 'rgba(255,255,255,0.65)',
    frame: 'bg-gradient-to-br from-amber-200 to-amber-400 shadow-[8px_8px_0px_0px_rgba(0,0,0,1),0_0_30px_rgba(255,215,0,0.45)]',
  },
  LEGENDARY: {
    name: 'Legendary',
    coatingStops: ['#c084fc', '#22d3ee'],
    speckle: 'rgba(255,255,255,0.75)',
    frame: 'holo-shimmer shadow-[8px_8px_0px_0px_rgba(0,0,0,1),0_0_36px_rgba(168,85,247,0.5)]',
    holo: true,
  },
};

// ── Coin cursor (32px emoji rendered to a data URI, lazily, client-only) ────

let coinCursorCss: string | null = null;

function getCoinCursor(): string {
  if (coinCursorCss) return coinCursorCss;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'crosshair';
    ctx.font = '28px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🪙', 16, 18);
    coinCursorCss = `url(${canvas.toDataURL('image/png')}) 16 16, crosshair`;
  } catch {
    coinCursorCss = 'crosshair';
  }
  return coinCursorCss;
}

// ── Coating rendering ────────────────────────────────────────────────────────

function drawCoating(canvas: HTMLCanvasElement, style: TierStyle): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.globalCompositeOperation = 'source-over';

  // Base metallic gradient
  const gradient = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
  if (style.holo) {
    for (const [offset, color] of [
      [0, '#f472b6'],
      [0.25, '#c084fc'],
      [0.5, '#60a5fa'],
      [0.75, '#34d399'],
      [1, '#fbbf24'],
    ] as const) {
      gradient.addColorStop(offset, color);
    }
  } else {
    gradient.addColorStop(0, style.coatingStops[0]);
    gradient.addColorStop(1, style.coatingStops[1]);
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Diagonal foil shine bands
  const shine = ctx.createLinearGradient(0, CANVAS_H, CANVAS_W, 0);
  shine.addColorStop(0.15, 'rgba(255,255,255,0)');
  shine.addColorStop(0.3, 'rgba(255,255,255,0.35)');
  shine.addColorStop(0.38, 'rgba(255,255,255,0)');
  shine.addColorStop(0.62, 'rgba(255,255,255,0)');
  shine.addColorStop(0.72, 'rgba(255,255,255,0.22)');
  shine.addColorStop(0.8, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Metallic grain
  for (let i = 0; i < 320; i++) {
    ctx.fillStyle = i % 2 === 0 ? style.speckle : 'rgba(0,0,0,0.12)';
    ctx.fillRect(Math.random() * CANVAS_W, Math.random() * CANVAS_H, 1.5, 1.5);
  }

  // Embossed instruction (offset light/dark pass reads as pressed-in foil)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 22px Inter, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText('🪙 SCRATCH', CANVAS_W / 2, CANVAS_H / 2 + 1.5);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillText('🪙 SCRATCH', CANVAS_W / 2, CANVAS_H / 2);
}

/** Feathered hole punch — radial falloff leaves soft, torn-looking edges. */
function punchHole(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  const gradient = ctx.createRadialGradient(x, y, radius * 0.45, x, y, radius);
  gradient.addColorStop(0, 'rgba(0,0,0,1)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

/** Fraction of the coating already erased (alpha-sampled every 6th pixel). */
function erasedFraction(ctx: CanvasRenderingContext2D): number {
  const { data } = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
  let cleared = 0;
  let sampled = 0;
  for (let i = 3; i < data.length; i += 4 * 6) {
    sampled++;
    if ((data[i] ?? 255) < 32) cleared++; // feathered edges count once mostly gone
  }
  return sampled > 0 ? cleared / sampled : 0;
}

// ── Panel ────────────────────────────────────────────────────────────────────

interface ScratchPanelProps {
  panel: ScratchPanelDto;
  tier: ScratchTier;
  disabled: boolean;
  /** True when the "reveal everything" skip was used — dissolve immediately. */
  forceDissolve: boolean;
  /** First coin stroke asks the server for this panel's value. */
  onRevealRequest: (panelNumber: number) => void;
  onDissolved: (panelNumber: number) => void;
}

function ScratchPanel({
  panel,
  tier,
  disabled,
  forceDissolve,
  onRevealRequest,
  onDissolved,
}: ScratchPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scratching = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const strokeCount = useRef(0);
  const requested = useRef(panel.prediction !== null);
  // Recovered cards (page refresh after revealing) start with no coating.
  const [dissolved, setDissolved] = useState(panel.revealed && panel.prediction !== null);
  const reported = useRef(dissolved);
  const [cursor, setCursor] = useState('crosshair');
  const style = TIER_STYLES[tier];

  useEffect(() => {
    setCursor(getCoinCursor());
    const canvas = canvasRef.current;
    if (!canvas || dissolved) return;
    drawCoating(canvas, style);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dissolve = useCallback(() => {
    setDissolved((already) => {
      if (!already && !reported.current) {
        reported.current = true;
        playReveal();
        onDissolved(panel.panelNumber);
      }
      return true;
    });
  }, [onDissolved, panel.panelNumber]);

  useEffect(() => {
    if (forceDissolve && !dissolved) dissolve();
  }, [forceDissolve, dissolved, dissolve]);

  const toCanvasPoint = (
    canvas: HTMLCanvasElement,
    clientX: number,
    clientY: number,
  ): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * CANVAS_W,
      y: ((clientY - rect.top) / rect.height) * CANVAS_H,
    };
  };

  const scratchTo = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      const point = toCanvasPoint(canvas, clientX, clientY);
      const isCoarse = window.matchMedia('(pointer: coarse)').matches;
      const radius = isCoarse ? 26 : 18;

      // Stamp holes along the segment from the last point — fast swipes leave
      // one continuous groove instead of a dotted line of circles.
      const from = lastPoint.current ?? point;
      const dx = point.x - from.x;
      const dy = point.y - from.y;
      const distance = Math.hypot(dx, dy);
      const steps = Math.max(1, Math.floor(distance / STROKE_STEP));
      for (let i = 1; i <= steps; i++) {
        punchHole(ctx, from.x + (dx * i) / steps, from.y + (dy * i) / steps, radius);
      }
      lastPoint.current = point;

      playScratch();
      hapticTick();

      // getImageData is pricey — sample every 8th stamp batch.
      strokeCount.current++;
      if (strokeCount.current % 8 === 0 && erasedFraction(ctx) >= DISSOLVE_THRESHOLD) {
        dissolve();
      }
    },
    [dissolve],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    if (disabled || dissolved) return;
    scratching.current = true;
    lastPoint.current = null;
    e.currentTarget.setPointerCapture(e.pointerId);
    // First coin contact fetches the value so the holes show real content.
    if (!requested.current) {
      requested.current = true;
      onRevealRequest(panel.panelNumber);
    }
    scratchTo(e.clientX, e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    if (!scratching.current || disabled || dissolved) return;
    scratchTo(e.clientX, e.clientY);
  };
  const endScratch = (): void => {
    if (!scratching.current) return;
    scratching.current = false;
    lastPoint.current = null;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && erasedFraction(ctx) >= DISSOLVE_THRESHOLD) dissolve();
    // Retry a reveal that failed mid-scratch (transient network hiccup).
    if (panel.prediction === null) requested.current = false;
  };

  const revealedValue = panel.prediction;

  return (
    <div
      className="relative aspect-[11/8] select-none overflow-hidden rounded-lg border-2 border-black bg-slate-900"
      role="group"
      aria-label={
        revealedValue === null
          ? `Panel ${panel.panelNumber}: ${panel.label} — scratch with your coin to reveal your prediction`
          : `Panel ${panel.panelNumber}: ${panel.label} — prediction ${revealedValue ? 'YES' : 'NO'}`
      }
    >
      {/* Hidden ticket content — visible THROUGH the scratched holes */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 p-1 text-center">
        <span className="text-xl leading-none" aria-hidden>
          {panel.icon}
        </span>
        <span className="text-[10px] font-black uppercase tracking-tight text-white">
          {panel.label}
        </span>
        {revealedValue === null ? (
          <span className="font-mono text-sm font-black text-white/40">···</span>
        ) : (
          <span
            className={cn(
              'rounded border-2 border-black px-1.5 font-mono text-sm font-black',
              revealedValue ? 'bg-emerald-400 text-black' : 'bg-red-400 text-black',
            )}
          >
            {revealedValue ? 'YES' : 'NO'}
          </span>
        )}
      </div>

      {/* Foil coating — holes are punched into it; it never wipes wholesale */}
      {!dissolved && (
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className={cn('absolute inset-0 h-full w-full', disabled && 'pointer-events-none')}
          style={{ touchAction: 'none', cursor }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endScratch}
          onPointerCancel={endScratch}
          onPointerLeave={endScratch}
        />
      )}
      {dissolved && (
        <>
          {/* Last flakes falling off + a brief golden glow on the fresh reveal */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${style.coatingStops[0]}, ${style.coatingStops[1]})`,
            }}
            initial={{ opacity: 0.5, scale: 1.04 }}
            animate={{ opacity: 0, scale: 1 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          />
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-md"
            initial={{ boxShadow: 'inset 0 0 22px 6px rgba(251,191,36,0.85)' }}
            animate={{ boxShadow: 'inset 0 0 0px 0px rgba(251,191,36,0)' }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          />
        </>
      )}
    </div>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────

interface ScratchCardProps {
  card: ScratchCardDto;
  onRevealRequest: (panelNumbers?: number[]) => void;
  onLockIn: () => void;
  isLocking: boolean;
}

const GRID_COLS: Record<ScratchTier, string> = {
  COMMON: 'grid-cols-3', // 2×3
  RARE: 'grid-cols-3', // 3×3
  LEGENDARY: 'grid-cols-4', // 3×4
};

export function ScratchCard({ card, onRevealRequest, onLockIn, isLocking }: ScratchCardProps) {
  const style = TIER_STYLES[card.tier];
  const disabled = card.status !== 'ACTIVE';
  const [forceDissolve, setForceDissolve] = useState(false);
  const [dissolvedPanels, setDissolvedPanels] = useState<Set<number>>(
    () =>
      new Set(
        card.panels
          .filter((p) => p.revealed && p.prediction !== null)
          .map((p) => p.panelNumber),
      ),
  );

  const onDissolved = useCallback((panelNumber: number) => {
    setDissolvedPanels((prev) => {
      const next = new Set(prev);
      next.add(panelNumber);
      return next;
    });
  }, []);

  // Fully scratched = every value known AND every coating actually gone.
  const allScratched = useMemo(
    () =>
      card.panels.every((p) => p.prediction !== null) &&
      dissolvedPanels.size >= card.panels.length,
    [card.panels, dissolvedPanels],
  );

  const revealEverything = useCallback(() => {
    setForceDissolve(true);
    onRevealRequest();
  }, [onRevealRequest]);

  // Keyboard fallback: SPACE reveals the whole card at once.
  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === ' ' && !allScratched && !disabled) {
      e.preventDefault();
      revealEverything();
    }
  };

  return (
    <div
      className={cn(
        'rounded-xl border-4 border-black p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]',
        style.frame,
      )}
      tabIndex={0}
      onKeyDown={onKeyDown}
      role="application"
      aria-label={`${style.name} scratch card — rub each panel with your coin to reveal your predictions. Press space to reveal everything.`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-full border-2 border-black bg-white/80 px-3 py-0.5 text-xs font-black uppercase">
          🎴 {style.name} card
        </span>
        <span className="rounded-full border-2 border-black bg-black px-3 py-0.5 text-xs font-black uppercase text-white">
          {dissolvedPanels.size}/{card.panels.length} scratched
        </span>
      </div>

      <div className={cn('grid gap-2', GRID_COLS[card.tier])}>
        {card.panels.map((panel) => (
          <ScratchPanel
            key={panel.panelNumber}
            panel={panel}
            tier={card.tier}
            disabled={disabled}
            forceDissolve={forceDissolve}
            onRevealRequest={(n) => onRevealRequest([n])}
            onDissolved={onDissolved}
          />
        ))}
      </div>

      <p className="mt-3 text-center text-xs font-bold text-black/70">
        🪙 Rub each panel with your coin — every hole shows what your card predicts for the next 2
        minutes.
      </p>

      <div className="mt-3 flex flex-col gap-2">
        {allScratched ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Button
              variant="success"
              className="w-full text-base"
              onClick={onLockIn}
              isLoading={isLocking}
              disabled={disabled}
            >
              ✓ Lock In Predictions{card.cost > 0 ? ` (−${card.cost} pts)` : ' (free)'}
            </Button>
          </motion.div>
        ) : (
          <button
            className="w-full rounded-xl px-3 py-2 text-xs font-bold text-black/50 transition-colors hover:bg-black/10"
            onClick={revealEverything}
            disabled={disabled}
          >
            ⚡ Reveal everything (skip the scratching)
          </button>
        )}
      </div>
    </div>
  );
}
