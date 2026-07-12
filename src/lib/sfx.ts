/**
 * WebAudio-only sound effects for quiz feedback — no audio assets.
 * Muted when localStorage 'synapse-sfx' === '0'.
 */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      audioCtx = new Ctor();
    }
    // Browsers suspend fresh contexts until a user gesture — sounds here are
    // always gesture-triggered, so resuming is safe
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

function sfxEnabled(): boolean {
  try {
    return localStorage.getItem('synapse-sfx') !== '0';
  } catch {
    return true;
  }
}

function playTone(
  ctx: AudioContext,
  freq: number,
  startAt: number,
  duration: number,
  type: OscillatorType = 'sine',
  peak = 0.12,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startAt);
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(peak, startAt + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.05);
}

/** Short pleasant two-note chime for a correct answer. */
export function playCorrect() {
  if (!sfxEnabled()) return;
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  playTone(ctx, 523.25, now, 0.18, 'sine', 0.1); // C5
  playTone(ctx, 783.99, now + 0.11, 0.28, 'sine', 0.12); // G5
}

/** Soft low thud for an incorrect answer. */
export function playIncorrect() {
  if (!sfxEnabled()) return;
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, now);
  osc.frequency.exponentialRampToValueAtTime(70, now + 0.22);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.14, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.35);
}

/**
 * Rising arpeggio for streak milestones. Higher `level` (1-4) plays a longer,
 * fuller run.
 */
export function playMilestone(level: number) {
  if (!sfxEnabled()) return;
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  // C major pentatonic run — extend upward for bigger milestones
  const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];
  const noteCount = Math.min(3 + Math.max(1, level) * 2, scale.length);
  const spacing = 0.09;
  for (let i = 0; i < noteCount; i++) {
    const isLast = i === noteCount - 1;
    playTone(ctx, scale[i], now + i * spacing, isLast ? 0.5 : 0.2, 'triangle', isLast ? 0.14 : 0.1);
  }
}
