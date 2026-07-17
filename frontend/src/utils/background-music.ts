/**
 * Background music engine (singleton <audio>): loops the stadium track at 50%
 * volume on music-enabled pages, with smooth fade-in/out on page enter/leave.
 *
 * Setting: localStorage `pulse_music_enabled` — absent counts as ON, so music
 * defaults on for every existing and new user until they switch it off.
 *
 * Autoplay policy: browsers reject play() before the first user gesture (e.g.
 * landing directly on /match/18143850). We arm a one-time pointer/key listener
 * and start the music on the first interaction instead of erroring.
 */

const MUSIC_KEY = 'pulse_music_enabled';
export const MUSIC_TOGGLE_EVENT = 'pulse-music-toggle';

const TRACK_URL = '/audio/sports-bg-music.mp3';
const TARGET_VOLUME = 0.5;
const FADE_IN_MS = 1_500;
const FADE_OUT_MS = 900;
const FADE_STEP_MS = 50;

let audio: HTMLAudioElement | null = null;
let fadeTimer: ReturnType<typeof setInterval> | null = null;
/** Whether the current page wants music (drives the gesture-retry path). */
let wanted = false;
let gestureArmed = false;

export function isMusicEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(MUSIC_KEY) !== '0';
}

export function setMusicEnabled(on: boolean): void {
  localStorage.setItem(MUSIC_KEY, on ? '1' : '0');
  if (!on) stopMusic();
  window.dispatchEvent(new Event(MUSIC_TOGGLE_EVENT));
}

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio(TRACK_URL);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0;
  }
  return audio;
}

function fadeTo(target: number, durationMs: number, onDone?: () => void): void {
  const element = getAudio();
  if (fadeTimer) clearInterval(fadeTimer);
  const start = element.volume;
  const delta = target - start;
  if (Math.abs(delta) < 0.01) {
    element.volume = target;
    onDone?.();
    return;
  }
  const steps = Math.max(1, Math.round(durationMs / FADE_STEP_MS));
  let step = 0;
  fadeTimer = setInterval(() => {
    step++;
    const progress = step / steps;
    element.volume = Math.min(1, Math.max(0, start + delta * progress));
    if (step >= steps) {
      if (fadeTimer) clearInterval(fadeTimer);
      fadeTimer = null;
      element.volume = target;
      onDone?.();
    }
  }, FADE_STEP_MS);
}

function armGestureRetry(): void {
  if (gestureArmed) return;
  gestureArmed = true;
  const onGesture = (): void => {
    gestureArmed = false;
    window.removeEventListener('pointerdown', onGesture);
    window.removeEventListener('keydown', onGesture);
    if (wanted && isMusicEnabled()) startMusic();
  };
  window.addEventListener('pointerdown', onGesture);
  window.addEventListener('keydown', onGesture);
}

/** Fade the loop in (page with music entered). No-op when the setting is off. */
export function startMusic(): void {
  wanted = true;
  if (!isMusicEnabled()) return;
  const element = getAudio();
  element
    .play()
    .then(() => fadeTo(TARGET_VOLUME, FADE_IN_MS))
    .catch(() => armGestureRetry()); // autoplay blocked until first gesture
}

/** Fade out and pause (music page left, or setting switched off). */
export function stopMusic(): void {
  wanted = false;
  if (!audio || audio.paused) return;
  fadeTo(0, FADE_OUT_MS, () => {
    if (!wanted) audio?.pause();
  });
}
