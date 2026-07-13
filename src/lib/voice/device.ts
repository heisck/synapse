'use client';

/**
 * Device capability gates for the in-browser voice stack. iOS Safari kills
 * tabs that allocate too much wasm memory ("A problem repeatedly occurred"),
 * and low-RAM Androids OOM on the ~150 MB Whisper base model — so model
 * choices scale down per device instead of crashing.
 */

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
    // iPadOS 13+ reports as Mac — detect via touch support
    || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

export function isLowMemoryDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const mem = (navigator as { deviceMemory?: number }).deviceMemory;
  return (mem !== undefined && mem <= 4) || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
}
