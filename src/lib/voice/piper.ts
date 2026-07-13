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

import { isIOS } from '@/lib/voice/device';

// Minimal shape of the parts of the library we use (it ships its own types,
// but we import it dynamically to keep it out of the SSR/build graph).
type PiperProgress = { url: string; total: number; loaded: number };
type PiperWasmPaths = { onnxWasm: string; piperData: string; piperWasm: string };
interface PiperTtsSession {
  predict: (text: string) => Promise<Blob>;
}
interface PiperModule {
  TtsSession: {
    create: (opts: { voiceId: string; progress?: (p: PiperProgress) => void; wasmPaths?: PiperWasmPaths }) => Promise<PiperTtsSession>;
  };
  download: (voiceId: string, cb?: (p: PiperProgress) => void) => Promise<void>;
  stored: () => Promise<string[]>;
  remove: (voiceId: string) => Promise<void>;
}

// The fork's DEFAULT ORT wasm path is broken on iOS twice over: (1) it hardcodes
// the cdnjs `.../onnxruntime-web/1.18.0/` folder, but the ORT it actually runs is
// 1.27.0 — whose per-variant `.mjs` loaders don't exist under the 1.18.0 path
// (404 → "Failed to fetch dynamically imported module"); and (2) cdnjs serves
// `.mjs` with a MIME Safari refuses to import cross-origin anyway. Point ORT at
// the MATCHING version (1.27.0) on jsdelivr, which serves it as
// `application/javascript` with CORS — verified 200. The phonemizer wasm already
// defaults to jsdelivr; pinned here explicitly too.
const PIPER_WASM_PATHS: PiperWasmPaths = {
  onnxWasm: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/',
  piperWasm: 'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize.wasm',
  piperData: 'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize.data',
};

// --- Model delivery via our own proxy -------------------------------------
// HuggingFace moved the large Piper `.onnx` files to Xet storage; the browser
// download the library does (a plain fetch of the HF `resolve/...` URL) now
// redirects to a CAS host that hands back an error body, which the library
// blindly caches — ORT then fails with "protobuf parsing failed". We fetch the
// files through /api/voice/piper (server-side, validated) and pre-seed them
// into the exact OPFS slots the library reads from, so it loads clean bytes
// from cache and never touches HF. Keep these names in sync with the library:
// dir "piper", files "<voiceId>.onnx" and "<voiceId>.onnx.json".
function opfsNames(voiceId: string): { onnx: string; json: string } {
  return { onnx: `${voiceId}.onnx`, json: `${voiceId}.onnx.json` };
}

/** A cached OPFS entry is only trustworthy if it's non-trivial and not an
 *  error page (XML/HTML error bodies start with '<'; a real model is binary,
 *  a real config is JSON starting with '{'). */
async function isValidOpfsFile(
  dir: FileSystemDirectoryHandle,
  name: string,
  minBytes: number,
): Promise<boolean> {
  try {
    const file = await (await dir.getFileHandle(name)).getFile();
    if (file.size < minBytes) return false;
    const head = new Uint8Array(await file.slice(0, 1).arrayBuffer());
    return head[0] !== 0x3c; // reject a leading '<'
  } catch {
    return false;
  }
}

/** Download one file from our proxy, validate it, and write it into OPFS. */
async function seedOpfsFile(
  dir: FileSystemDirectoryHandle,
  name: string,
  url: string,
  isModel: boolean,
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`voice proxy ${res.status} for ${name}`);
  const ct = (res.headers.get('content-type') ?? '').toLowerCase();
  if (isModel && (ct.includes('xml') || ct.includes('html'))) {
    throw new Error(`voice proxy returned non-model content-type "${ct}"`);
  }
  const total = Number(res.headers.get('content-length') ?? 0);
  const reader = res.body.getReader();
  const chunks: BlobPart[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value as BlobPart);
    loaded += value.length;
    onProgress?.(loaded, total);
  }
  const blob = new Blob(chunks);
  // Final guard: a truncated or error body must never reach ORT.
  if (isModel && blob.size < 1_000_000) throw new Error(`voice model too small (${blob.size} bytes)`);
  const head = new Uint8Array(await blob.slice(0, 1).arrayBuffer());
  if (head[0] === 0x3c) throw new Error('voice response looks like an error page, not a model');
  const writable = await (await dir.getFileHandle(name, { create: true })).createWritable();
  await writable.write(blob);
  await writable.close();
}

/**
 * Ensure the selected voice's model + config are cached in OPFS as valid files,
 * fetching them through our proxy if missing or poisoned. After this resolves,
 * the library's TtsSession.create reads straight from cache. No-op (falls back
 * to the library's own HF fetch) if OPFS is unavailable.
 */
async function ensureVoiceCached(voiceId: string, onProgress?: (pct: number) => void): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) return;
  const { onnx, json } = opfsNames(voiceId);
  const root = await navigator.storage.getDirectory();
  const dir = await root.getDirectoryHandle('piper', { create: true });

  const haveModel = await isValidOpfsFile(dir, onnx, 1_000_000);
  const haveConfig = await isValidOpfsFile(dir, json, 10);
  if (haveModel && haveConfig) return;

  const q = encodeURIComponent(voiceId);
  if (!haveConfig) {
    await seedOpfsFile(dir, json, `/api/voice/piper?voice=${q}&file=json`, false);
  }
  if (!haveModel) {
    await seedOpfsFile(dir, onnx, `/api/voice/piper?voice=${q}&file=onnx`, true, (loaded, total) => {
      onProgress?.(total > 0 ? Math.min(99, Math.round((loaded * 100) / total)) : 0);
    });
  }
}

/** Temporarily shadow navigator.hardwareConcurrency; returns a restore fn. */
function patchHardwareConcurrency(value: number): () => void {
  try {
    const prev = Object.getOwnPropertyDescriptor(navigator, 'hardwareConcurrency');
    Object.defineProperty(navigator, 'hardwareConcurrency', { value, configurable: true });
    return () => {
      try {
        if (prev) Object.defineProperty(navigator, 'hardwareConcurrency', prev);
        else delete (navigator as unknown as Record<string, unknown>).hardwareConcurrency;
      } catch { /* ignore */ }
    };
  } catch {
    return () => {};
  }
}

// Curated English Piper voices. LOW-quality voices (~20-25 MB) are listed first
// and are the default: on a flaky connection a 60 MB "medium" model truncates
// mid-download (→ "protobuf parsing failed"), whereas a ~20 MB one completes
// like Whisper does. Medium/high are offered for fast connections that want
// richer audio.
export const PIPER_VOICES: Array<{ id: string; label: string }> = [
  { id: 'en_US-amy-low', label: 'Amy — US female (small, reliable)' },
  { id: 'en_US-danny-low', label: 'Danny — US male (small)' },
  { id: 'en_US-lessac-low', label: 'Lessac — US neutral (small)' },
  { id: 'en_GB-alan-low', label: 'Alan — UK male (small)' },
  { id: 'en_US-hfc_female-medium', label: 'Aria — US female (HQ, ~60 MB)' },
  { id: 'en_US-ryan-high', label: 'Ryan — US male (best, largest)' },
];
const DEFAULT_VOICE = 'en_US-amy-low';
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
    // The fork sets ORT's numThreads = navigator.hardwareConcurrency, which
    // forces the THREADED wasm build — and that needs cross-origin isolation
    // (SharedArrayBuffer) that iOS Safari doesn't grant. Temporarily pin
    // hardwareConcurrency to 1 so ORT loads the single-threaded build instead,
    // which runs anywhere. Scoped to iOS and restored right after init.
    const forceSingleThread = isIOS();
    const restoreHC = forceSingleThread ? patchHardwareConcurrency(1) : null;
    try {
      const reportPct = (pct: number) => { onProgress?.(pct); emit('downloading', pct); };
      // Fetch the model + config through our proxy and pre-seed OPFS, so the
      // library loads validated bytes from cache instead of HF's broken Xet
      // redirect. isValidOpfsFile also purges any pre-fix poisoned entry.
      await ensureVoiceCached(voiceId, reportPct);

      const piper = (await import('@mintplex-labs/piper-tts-web')) as unknown as PiperModule;
      const mkProgress = () => (p: PiperProgress) => {
        const pct = p.total > 0 ? Math.min(99, Math.round((p.loaded * 100) / p.total)) : 0;
        reportPct(pct);
      };
      let session: PiperTtsSession;
      try {
        session = await piper.TtsSession.create({ voiceId, wasmPaths: PIPER_WASM_PATHS, progress: mkProgress() });
      } catch (firstErr) {
        // Should be rare now that OPFS is pre-seeded, but a stale/corrupt entry
        // still fails ORT with "protobuf parsing failed". Purge, re-seed cleanly
        // from the proxy, and try once more before giving up.
        console.warn('[piper] load failed, purging cache + re-seeding once:', firstErr);
        emit('downloading', 0);
        try { await piper.remove(voiceId); } catch { /* nothing cached to remove */ }
        await ensureVoiceCached(voiceId, reportPct);
        session = await piper.TtsSession.create({ voiceId, wasmPaths: PIPER_WASM_PATHS, progress: mkProgress() });
      }
      emit('ready', 100);
      try { localStorage.setItem(DOWNLOADED_KEY, '1'); } catch { /* storage unavailable */ }
      return session;
    } catch (err) {
      console.warn('[piper] failed to load, falling back to system voice:', err);
      emit('unavailable', 0);
      sessionPromise = null; // allow a retry after transient failures
      return null;
    } finally {
      restoreHC?.();
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
