'use client';

/**
 * Piper TTS — the on-device FALLBACK voice for when Kokoro can't run.
 *
 * Kokoro is the primary engine (richer voice) but its ONNX inference crashes
 * Safari's tab on some iPhones. Piper (VITS) is a much lighter model on the
 * STABLE onnxruntime-web 1.18 (not the 1.26-dev build that also broke Whisper),
 * so it fits where Kokoro doesn't. It runs fully in the browser via
 * @mintplex-labs/piper-tts-web: main-thread inference (no worker assets to
 * serve), model cached in OPFS, ORT/phonemizer wasm from CDN.
 *
 * We keep this deliberately small — one persistent TtsSession, synthesize a WAV
 * blob per call, and let tts.ts own playback so stop/interrupt stays uniform.
 */

// Minimal shape of the parts of the library we use (it ships its own types,
// but we import it dynamically to keep it out of the SSR/build graph).
type PiperProgress = { url: string; total: number; loaded: number };
interface PiperTtsSession {
  predict: (text: string) => Promise<Blob>;
}
interface PiperModule {
  TtsSession: {
    create: (opts: { voiceId: string; progress?: (p: PiperProgress) => void }) => Promise<PiperTtsSession>;
  };
  download: (voiceId: string, cb?: (p: PiperProgress) => void) => Promise<void>;
  stored: () => Promise<string[]>;
  remove: (voiceId: string) => Promise<void>;
}

/** Curated English Piper voices (there are 100+; these read cleanly for study). */
export const PIPER_VOICES: Array<{ id: string; label: string }> = [
  { id: 'en_US-hfc_female-medium', label: 'Aria — US female (clear)' },
  { id: 'en_US-amy-medium', label: 'Amy — US female (warm)' },
  { id: 'en_US-hfc_male-medium', label: 'Marcus — US male' },
  { id: 'en_US-ryan-high', label: 'Ryan — US male (hi-fi)' },
  { id: 'en_GB-alba-medium', label: 'Alba — UK female' },
  { id: 'en_US-lessac-medium', label: 'Lessac — US neutral' },
];
const DEFAULT_VOICE = 'en_US-hfc_female-medium';
const VOICE_KEY = 'synapse-piper-voice';
const DOWNLOADED_KEY = 'synapse-piper-downloaded';

export function getSelectedPiperVoice(): string {
  if (typeof window === 'undefined') return DEFAULT_VOICE;
  try { return localStorage.getItem(VOICE_KEY) || DEFAULT_VOICE; } catch { return DEFAULT_VOICE; }
}
export function setSelectedPiperVoice(voiceId: string): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(VOICE_KEY, voiceId); } catch { /* storage unavailable */ }
  // Voice changed — drop the session so the next synth loads the new voice.
  sessionPromise = null;
  sessionVoiceId = null;
}

export type PiperStatus = 'idle' | 'downloading' | 'ready' | 'unavailable';
let status: PiperStatus = 'idle';
let progress = 0;
const listeners = new Set<(status: PiperStatus, progress: number) => void>();

export function getPiperStatus(): { status: PiperStatus; progress: number } {
  return { status, progress };
}
export function onPiperStatus(cb: (status: PiperStatus, progress: number) => void): () => void {
  listeners.add(cb);
  cb(status, progress);
  return () => listeners.delete(cb);
}
function emit(s: PiperStatus, p: number): void {
  status = s; progress = p;
  for (const cb of listeners) cb(s, p);
}

let sessionPromise: Promise<PiperTtsSession | null> | null = null;
let sessionVoiceId: string | null = null;

/** True when the browser can run Piper at all (needs WASM + fetch). */
export function piperSupported(): boolean {
  return typeof window !== 'undefined' && typeof WebAssembly !== 'undefined';
}

/** Load (and cache to OPFS) the selected Piper voice as a reusable session. */
async function loadPiper(onProgress?: (pct: number) => void): Promise<PiperTtsSession | null> {
  const voiceId = getSelectedPiperVoice();
  // Reuse only if the same voice is already loading/loaded.
  if (sessionPromise && sessionVoiceId === voiceId) return sessionPromise;
  sessionVoiceId = voiceId;
  emit('downloading', 0);
  sessionPromise = (async () => {
    try {
      const piper = (await import('@mintplex-labs/piper-tts-web')) as unknown as PiperModule;
      const session = await piper.TtsSession.create({
        voiceId,
        progress: (p) => {
          const pct = p.total > 0 ? Math.min(99, Math.round((p.loaded * 100) / p.total)) : 0;
          onProgress?.(pct);
          emit('downloading', pct);
        },
      });
      emit('ready', 100);
      try { localStorage.setItem(DOWNLOADED_KEY, '1'); } catch { /* storage unavailable */ }
      return session;
    } catch (err) {
      console.warn('[piper] failed to load, falling back to system voice:', err);
      emit('unavailable', 0);
      sessionPromise = null; // allow a retry after transient failures
      return null;
    }
  })();
  return sessionPromise;
}

/** Preload Piper in the background (Settings download / warm before first use). */
export function warmUpPiper(): void {
  void loadPiper();
}

/** Explicit Settings download — resolves true when the voice is ready. */
export async function downloadPiper(onProgress?: (pct: number) => void): Promise<boolean> {
  const s = await loadPiper(onProgress);
  return s !== null;
}

export function isPiperDownloaded(): boolean {
  if (typeof window === 'undefined') return false;
  try { return localStorage.getItem(DOWNLOADED_KEY) === '1'; } catch { return false; }
}

/**
 * Synthesize `text` to a WAV Blob (or null if Piper can't run). tts.ts plays
 * the blob through its shared audio element so stop/interrupt works uniformly.
 */
export async function piperSynthesize(text: string): Promise<Blob | null> {
  const clean = text.trim();
  if (!clean) return null;
  const session = await loadPiper();
  if (!session) return null;
  try {
    return await session.predict(clean);
  } catch (err) {
    console.warn('[piper] synthesis failed:', err);
    return null;
  }
}

/**
 * Delete the cached Piper voice(s) from OPFS so they re-download fresh — the fix
 * for a corrupted/half-written download.
 */
export async function deletePiperDownload(): Promise<void> {
  sessionPromise = null;
  sessionVoiceId = null;
  emit('idle', 0);
  try { localStorage.removeItem(DOWNLOADED_KEY); } catch { /* storage unavailable */ }
  try {
    const piper = (await import('@mintplex-labs/piper-tts-web')) as unknown as PiperModule;
    const stored = await piper.stored().catch(() => [] as string[]);
    for (const v of stored) await piper.remove(v).catch(() => {});
  } catch { /* OPFS unavailable — the in-memory reset above still forces a reload */ }
}
