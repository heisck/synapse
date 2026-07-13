'use client';

/**
 * Quiz-generation progress driver.
 *
 * Generating a fresh question batch is ONE opaque request (no server-side
 * per-question stream), so a true 0→100 isn't available. Instead we run a
 * smooth, monotonic, time-based ramp that eases toward a cap (92%) and SNAPS to
 * 100 the instant generation resolves — "consistent but fairly accurate", which
 * is exactly what the learner needs to see instead of a dead spinner.
 *
 * The value lives in the app store (quizGenProgress) so every "Preparing…"
 * surface — course card, quiz page, tutor "preparing your cards" — reads the
 * same number. null = not generating.
 */

import { useAppStore } from '@/stores/appStore';

const CAP = 92; // ramp stops here; the completion snap owns 92→100
let timer: ReturnType<typeof setInterval> | null = null;
let doneTimer: ReturnType<typeof setTimeout> | null = null;
let startedAt = 0;
let expectedMs = 11_000; // typical generation; tunes the ramp's pace

function clearTimers(): void {
  if (timer) { clearInterval(timer); timer = null; }
  if (doneTimer) { clearTimeout(doneTimer); doneTimer = null; }
}

/**
 * Ease-out ramp: pct(t) = CAP · (1 − e^(−t/τ)). Fast at first, slowing as it
 * nears the cap so it never sits frozen at 100 but also never stalls at 0. τ is
 * derived so it reaches ~80% of CAP around the expected duration.
 */
function rampValue(elapsedMs: number): number {
  const tau = expectedMs * 0.62;
  return CAP * (1 - Math.exp(-elapsedMs / tau));
}

/** Begin the ramp (call right before the generation request). Idempotent. */
export function beginQuizProgress(expectedDurationMs = 11_000): void {
  clearTimers();
  expectedMs = Math.max(2_000, expectedDurationMs);
  startedAt = Date.now();
  const set = useAppStore.getState().setQuizGenProgress;
  set(1); // show immediately — never a beat of blank 0
  let last = 1;
  timer = setInterval(() => {
    const next = Math.max(last, Math.round(rampValue(Date.now() - startedAt)));
    if (next !== last) { last = next; set(next); }
  }, 180);
}

/** Snap to 100, then clear after a short beat so the fill is seen completing. */
export function finishQuizProgress(): void {
  clearTimers();
  const set = useAppStore.getState().setQuizGenProgress;
  set(100);
  doneTimer = setTimeout(() => set(null), 450);
}

/** Abort the ramp with no completion flourish (generation failed/empty). */
export function failQuizProgress(): void {
  clearTimers();
  useAppStore.getState().setQuizGenProgress(null);
}
