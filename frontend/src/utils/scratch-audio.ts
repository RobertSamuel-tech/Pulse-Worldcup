/**
 * Synthesized scratch-card sounds via WebAudio — zero assets, <1ms latency.
 * All calls are safe to spam: scratches self-throttle, and everything is a
 * no-op when the AudioContext is unavailable (SSR, autoplay-blocked).
 */

let ctx: AudioContext | null = null;
let lastScratchAt = 0;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Short metallic friction burst — call on pointer move while scratching. */
export function playScratch(): void {
  const now = performance.now();
  if (now - lastScratchAt < 70) return; // throttle so bursts never overlap
  lastScratchAt = now;

  const ac = getCtx();
  if (!ac) return;
  const duration = 0.06;
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * duration), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);

  const source = ac.createBufferSource();
  source.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 2400 + Math.random() * 1200; // vary the zzzip
  filter.Q.value = 1.2;
  const gain = ac.createGain();
  gain.gain.value = 0.12;
  source.connect(filter).connect(gain).connect(ac.destination);
  source.start();
}

/** Bright two-note chime — a panel finished revealing. */
export function playReveal(): void {
  const ac = getCtx();
  if (!ac) return;
  const t0 = ac.currentTime;
  for (const [freq, offset] of [
    [880, 0],
    [1318.5, 0.09],
  ] as const) {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, t0 + offset);
    gain.gain.exponentialRampToValueAtTime(0.18, t0 + offset + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + offset + 0.35);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0 + offset);
    osc.stop(t0 + offset + 0.4);
  }
}

/** Triumphant ascending arpeggio — winning card. */
export function playFanfare(): void {
  const ac = getCtx();
  if (!ac) return;
  const t0 = ac.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((freq, i) => {
    const osc = ac.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const gain = ac.createGain();
    const start = t0 + i * 0.12;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.2, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + (i === notes.length - 1 ? 0.7 : 0.3));
    osc.connect(gain).connect(ac.destination);
    osc.start(start);
    osc.stop(start + 0.8);
  });
}

/** Soft low thud — losing card / error. Gentle, not punishing. */
export function playThud(): void {
  const ac = getCtx();
  if (!ac) return;
  const t0 = ac.currentTime;
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(160, t0);
  osc.frequency.exponentialRampToValueAtTime(70, t0 + 0.25);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.16, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + 0.4);
}

/** Light haptic tick while scratching (mobile). Throttled by callers' moves. */
export function hapticTick(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(8);
  }
}
