'use client';

/**
 * Haptic feedback via the Web Vibration API. Android/Chrome vibrates;
 * iOS Safari and desktops silently no-op (navigator.vibrate is absent).
 *
 * Wiring (see StoreInitializer):
 *  - a delegated pointerdown listener taps on every button press app-wide
 *  - chatRequestStatus transitions pulse when the AI starts responding,
 *    streams, completes, or fails
 *  - quiz sounds (sfx.ts) carry matching correct/incorrect buzzes
 *
 * Toggle: localStorage 'synapse-haptics' !== '0' (default on).
 */

const HAPTICS_KEY = 'synapse-haptics';

export function hapticsSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

export function hapticsEnabled(): boolean {
  if (!hapticsSupported()) return false;
  try {
    return localStorage.getItem(HAPTICS_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setHapticsEnabled(on: boolean): void {
  try {
    localStorage.setItem(HAPTICS_KEY, on ? '1' : '0');
  } catch { /* storage unavailable */ }
}

function vibrate(pattern: number | number[]): void {
  if (!hapticsEnabled()) return;
  try {
    navigator.vibrate(pattern);
  } catch { /* some webviews throw — never break the UI over a buzz */ }
}

/** Light tick — button presses, toggles, card taps. */
export function hapticTap(): void {
  vibrate(8);
}

/** Firmer press — send message, submit answer, start quiz. */
export function hapticPress(): void {
  vibrate(16);
}

/** The AI started responding (first token arrived). */
export function hapticResponseStart(): void {
  vibrate([10, 40, 10]);
}

/** The response finished streaming. */
export function hapticResponseDone(): void {
  vibrate(12);
}

/** Correct answer / success. */
export function hapticSuccess(): void {
  vibrate([12, 50, 20]);
}

/** Wrong answer / error / request failed. */
export function hapticError(): void {
  vibrate([40, 60, 40]);
}

/** Streak milestone / achievement — celebratory triple. */
export function hapticCelebrate(): void {
  vibrate([15, 40, 15, 40, 30]);
}

let wired = false;

/**
 * App-wide wiring, called once from StoreInitializer:
 * 1. Delegated pointerdown: every <button> / [role="button"] press ticks.
 * 2. Chat request lifecycle: sending → press, streaming → response-start,
 *    streaming/sending → idle → done, → failed → error.
 */
export function initHaptics(
  subscribeChatStatus: (cb: (status: string, prev: string) => void) => void,
): void {
  if (wired || !hapticsSupported()) return;
  wired = true;

  document.addEventListener(
    'pointerdown',
    (e) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest('button, [role="button"], a[href], input[type="range"], [role="tab"]')) hapticTap();
    },
    { passive: true, capture: true },
  );

  subscribeChatStatus((status, prev) => {
    if (status === 'sending') hapticPress();
    else if (status === 'streaming') hapticResponseStart();
    else if (status === 'idle' && (prev === 'streaming' || prev === 'sending')) hapticResponseDone();
    else if (status === 'failed') hapticError();
  });
}
