'use client';

import Image from 'next/image';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { isMusicEnabled } from '@/utils/background-music';

interface SplashScreenProps {
  onComplete: () => void;
}

const PHASE_HOLD_AT_MS = 1_200;
const PHASE_OUT_AT_MS = 3_000;
const UNMOUNT_AT_MS = 3_800;

const INTRO_TRACK_URL = '/audio/logo-reveal.mp3';
const INTRO_VOLUME = 0.6;
const INTRO_FADE_IN_MS = 700;
const INTRO_FADE_OUT_MS = 800;
const FADE_STEP_MS = 50;

/**
 * Cinematic first-visit intro: golden ball fades in over dark, breathes with
 * a golden glow, fades out. GPU-accelerated properties only (transform/opacity).
 * Honors prefers-reduced-motion with a plain crossfade.
 */
export function SplashScreen({ onComplete }: SplashScreenProps) {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<'in' | 'hold' | 'out' | 'done'>('in');
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase('hold'), PHASE_HOLD_AT_MS),
      setTimeout(() => setPhase('out'), PHASE_OUT_AT_MS),
      setTimeout(() => {
        setPhase('done');
        onComplete();
      }, UNMOUNT_AT_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  // Intro sting synced to the logo reveal: fade in on mount, fade out with the
  // visual exit. Honors the music setting; if the browser blocks autoplay on a
  // gesture-less first load, the first tap/keypress starts it (while visible).
  useEffect(() => {
    if (!isMusicEnabled()) return;
    const audio = new Audio(INTRO_TRACK_URL);
    audio.preload = 'auto';
    audio.volume = 0;

    let fadeTimer: ReturnType<typeof setInterval> | null = null;
    const fadeTo = (target: number, durationMs: number): void => {
      if (fadeTimer) clearInterval(fadeTimer);
      const start = audio.volume;
      const steps = Math.max(1, Math.round(durationMs / FADE_STEP_MS));
      let step = 0;
      fadeTimer = setInterval(() => {
        step++;
        audio.volume = Math.min(1, Math.max(0, start + ((target - start) * step) / steps));
        if (step >= steps && fadeTimer) {
          clearInterval(fadeTimer);
          fadeTimer = null;
        }
      }, FADE_STEP_MS);
    };

    const onGesture = (): void => {
      removeGestureListeners();
      audio
        .play()
        .then(() => fadeTo(INTRO_VOLUME, INTRO_FADE_IN_MS))
        .catch(() => undefined);
    };
    const removeGestureListeners = (): void => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };

    audio
      .play()
      .then(() => fadeTo(INTRO_VOLUME, INTRO_FADE_IN_MS))
      .catch(() => {
        window.addEventListener('pointerdown', onGesture);
        window.addEventListener('keydown', onGesture);
      });

    const fadeOutTimer = setTimeout(
      () => fadeTo(0, INTRO_FADE_OUT_MS),
      PHASE_OUT_AT_MS,
    );

    return () => {
      clearTimeout(fadeOutTimer);
      if (fadeTimer) clearInterval(fadeTimer);
      removeGestureListeners();
      audio.pause();
      audio.src = '';
    };
  }, []);

  if (phase === 'done') return null;

  const logoAnimation = reduceMotion
    ? { opacity: 1 }
    : phase === 'in'
      ? { opacity: 1, scale: 1, rotate: 0 }
      : phase === 'hold'
        ? { opacity: 1, scale: [1, 1.03, 1], rotate: 0 }
        : { opacity: 0, scale: 1.05, rotate: 0 };

  const logoTransition = reduceMotion
    ? { duration: 0.6 }
    : phase === 'in'
      ? { duration: 1.2, ease: 'easeOut' as const }
      : phase === 'hold'
        ? { scale: { duration: 1.4, repeat: Infinity, ease: 'easeInOut' as const } }
        : { duration: 0.8, ease: 'easeIn' as const };

  return (
    <AnimatePresence>
      <motion.div
        key="splash"
        aria-hidden="true"
        role="presentation"
        className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]"
        initial={{ opacity: 1 }}
        animate={{ opacity: phase === 'out' ? 0 : 1 }}
        transition={{ duration: 0.8, ease: 'easeIn' }}
      >
        {/* Golden glow — a radial halo pulsing behind the ball (opacity only) */}
        {!reduceMotion && (
          <motion.div
            className="absolute h-[26rem] w-[26rem] rounded-full"
            style={{
              background:
                'radial-gradient(circle, rgba(250,204,21,0.35) 0%, rgba(250,204,21,0.12) 45%, transparent 70%)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: phase === 'hold' ? [0.5, 1, 0.5] : phase === 'in' ? 0.5 : 0 }}
            transition={
              phase === 'hold'
                ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }
                : { duration: 0.8 }
            }
          />
        )}

        <motion.div
          className="relative h-64 w-64 md:h-80 md:w-80 lg:h-96 lg:w-96"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8, rotate: 5 }}
          animate={logoAnimation}
          transition={logoTransition}
        >
          {imageFailed ? (
            <span className="flex h-full w-full items-center justify-center text-5xl font-black text-amber-400 md:text-6xl">
              ⚽ PULSE
            </span>
          ) : (
            <Image
              src="/images/logo-golden-ball.webp"
              alt=""
              fill
              priority
              sizes="(min-width: 1024px) 24rem, (min-width: 768px) 20rem, 16rem"
              className="object-contain"
              onError={() => setImageFailed(true)}
            />
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
