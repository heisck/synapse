'use client';

/**
 * TTS seam (UNIFIED-PLAN task 49, req C17; pinned engine: Kokoro).
 *
 * Primary: Kokoro-82M running IN THE BROWSER via kokoro-js (ONNX / WebGPU or
 * WASM) — natural open-source voice, nothing leaves the device, no server
 * cost. The model (~80 MB, quantized) downloads once and is cached by the
 * browser.
 *
 * Voice manager (task 71): downloads live in Settings — progress reporting,
 * ready state, voice selection persisted in localStorage. Once downloaded,
 * StoreInitializer warms the model on app entry so speech starts instantly.
 *
 * Fallback: the Web Speech API (SpeechSynthesis) when kokoro-js can't load
 * (old browser, blocked download, low memory) — speech always works.
 */

import { isIOS, isLowMemoryDevice } from '@/lib/voice/device';
import { piperSynthesize, isPiperDownloaded, piperSupported } from '@/lib/voice/piper';
import { cloudSynthesize, isCloudVoiceEnabled } from '@/lib/voice/cloudTts';

export interface SpeakOptions {
  /** 0.5–2.0 playback speed. */
  speed?: number;
  /** Kokoro voice id (e.g. 'af_heart', 'af_bella', 'am_michael'). */
  voice?: string;
  onEnd?: () => void;
}

type KokoroTTSInstance = {
  generate: (text: string, opts: { voice: string; speed?: number }) => Promise<{ toBlob: () => Blob }>;
  stream: (
    splitter: unknown,
    opts?: { voice?: string; speed?: number },
  ) => AsyncGenerator<{ text: string; audio: { toBlob: () => Blob } }>;
};

/** Voices bundled with Kokoro-82M — id → friendly label. */
export const KOKORO_VOICES: Array<{ id: string; label: string }> = [
  { id: 'af_heart', label: 'Heart (US female)' },
  { id: 'af_bella', label: 'Bella (US female)' },
  { id: 'af_nicole', label: 'Nicole (US female, soft)' },
  { id: 'af_sarah', label: 'Sarah (US female)' },
  { id: 'am_adam', label: 'Adam (US male)' },
  { id: 'am_michael', label: 'Michael (US male)' },
  { id: 'bf_emma', label: 'Emma (UK female)' },
  { id: 'bm_george', label: 'George (UK male)' },
];

const VOICE_KEY = 'synapse-tts-voice';
const DOWNLOADED_KEY = 'synapse-tts-downloaded';
const CUSTOM_VOICE_KEY = 'synapse-custom-voice';
// Opt-in escape hatch for iOS. Kokoro is disabled by default on iPhone/iPad
// because the fp32 model can crash Safari's wasm tab, but the q8 build (~40 MB)
// fits on modern devices — so let motivated users turn it on explicitly and
// accept the risk, rather than being locked to the system voice forever.
const IOS_KOKORO_KEY = 'synapse-ios-kokoro';

/** True when the user has opted into running Kokoro on iOS (default off). */
export function isIOSKokoroEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(IOS_KOKORO_KEY) === '1';
  } catch {
    return false;
  }
}

export function setIOSKokoroEnabled(on: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(IOS_KOKORO_KEY, on ? '1' : '0');
  } catch { /* storage unavailable */ }
}

// ─── Kokoro synthesis-crash breadcrumb (iOS → Piper fallback) ───────────────
// The iOS failure isn't a catchable error — the wasm heap growth during the
// first generate() CRASHES the whole tab ("a problem repeatedly occurred"),
// which reloads the page before any catch runs. So we leave a breadcrumb: set
// 'trying' right before a synth, 'ok' after it returns. If a fresh page load
// finds a stale 'trying', the previous synth must have crashed the tab → mark
// Kokoro 'bad' and route TTS to Piper from then on. A CATCHABLE failure clears
// the breadcrumb (inconclusive — retry Kokoro next time), so only a real crash
// trips the fallback. Armed on iOS only, where this crash is the known issue.
const KOKORO_SYNTH_KEY = 'synapse-kokoro-synth';
let synthHealthResolved = false;
function resolveKokoroSynthHealthOnce(): void {
  if (synthHealthResolved || typeof window === 'undefined') return;
  synthHealthResolved = true;
  try {
    if (localStorage.getItem(KOKORO_SYNTH_KEY) === 'trying') {
      localStorage.setItem(KOKORO_SYNTH_KEY, 'bad');
    }
  } catch { /* storage unavailable */ }
}

/** True once a Kokoro synth has crashed this device's tab — use Piper instead. */
export function isKokoroSynthKnownBad(): boolean {
  resolveKokoroSynthHealthOnce();
  try { return localStorage.getItem(KOKORO_SYNTH_KEY) === 'bad'; } catch { return false; }
}
export function markKokoroSynthStart(): void {
  if (!isIOS()) return;
  try { if (localStorage.getItem(KOKORO_SYNTH_KEY) !== 'ok') localStorage.setItem(KOKORO_SYNTH_KEY, 'trying'); } catch { /* ignore */ }
}
export function markKokoroSynthOk(): void {
  if (!isIOS()) return;
  try { localStorage.setItem(KOKORO_SYNTH_KEY, 'ok'); } catch { /* ignore */ }
}
function clearKokoroSynthBreadcrumb(): void {
  if (!isIOS()) return;
  try { if (localStorage.getItem(KOKORO_SYNTH_KEY) === 'trying') localStorage.removeItem(KOKORO_SYNTH_KEY); } catch { /* ignore */ }
}
/** Reset the health flag (Settings "delete & re-download" gives Kokoro another go). */
export function resetKokoroSynthHealth(): void {
  synthHealthResolved = false;
  try { localStorage.removeItem(KOKORO_SYNTH_KEY); } catch { /* ignore */ }
}

// ─── Custom voice via style-vector blending (Voice Lab) ─────────────────────
// Kokoro voices are 510×256 float32 style vectors served as .bin files and
// looked up through the browser Cache API ('kokoro-voices'). A custom voice
// is a weighted blend of two built-in vectors, written into the cache under
// a donor slot id (am_santa — the lowest-graded voice, not in our picker),
// so kokoro-js loads OUR vector when asked for that id. No fork needed.
const CUSTOM_VOICE_SLOT = 'am_santa';
const VOICE_BIN_URL = (id: string) =>
  `https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/voices/${id}.bin`;

export interface CustomVoiceMeta {
  name: string;
  voiceA: string;
  voiceB: string;
  /** 0..1 — weight of voiceA (voiceB gets 1-ratio). */
  ratio: number;
}

export function getCustomVoice(): CustomVoiceMeta | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CUSTOM_VOICE_KEY);
    return raw ? (JSON.parse(raw) as CustomVoiceMeta) : null;
  } catch {
    return null;
  }
}

/**
 * Fetches two style vectors, mixes them element-wise, and plants the result in
 * the Cache API entry kokoro-js reads for `slot`. kokoro memoizes a slot's
 * vector for the page's lifetime (see the module-level voice cache in
 * kokoro-js) — so writing a slot only takes audible effect if that slot hasn't
 * been spoken yet this session (a reload always picks the new blend up).
 */
async function writeBlendToSlot(slot: string, voiceA: string, voiceB: string, ratio: number): Promise<void> {
  const [binA, binB] = await Promise.all(
    [voiceA, voiceB].map(async (id) => {
      const res = await fetch(VOICE_BIN_URL(id));
      if (!res.ok) throw new Error(`voice ${id} fetch failed`);
      return new Float32Array(await res.arrayBuffer());
    }),
  );
  const blended = new Float32Array(binA.length);
  for (let i = 0; i < blended.length; i++) {
    blended[i] = binA[i] * ratio + (binB[i] ?? 0) * (1 - ratio);
  }
  const cache = await caches.open('kokoro-voices');
  await cache.put(
    VOICE_BIN_URL(slot),
    new Response(blended.buffer as ArrayBuffer, { headers: { 'Content-Type': 'application/octet-stream' } }),
  );
}

/**
 * Blends two built-in voices into the custom slot and persists the recipe.
 * The new blend applies fully after a reload (kokoro memoization, above).
 */
export async function saveCustomVoiceBlend(meta: CustomVoiceMeta): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window)) return false;
  try {
    const ratio = Math.max(0, Math.min(1, meta.ratio));
    await writeBlendToSlot(CUSTOM_VOICE_SLOT, meta.voiceA, meta.voiceB, ratio);
    localStorage.setItem(CUSTOM_VOICE_KEY, JSON.stringify({ ...meta, ratio }));
    return true;
  } catch (err) {
    console.warn('[tts] custom voice blend failed:', err);
    return false;
  }
}

// ─── Live blend preview (hear a mix before saving) ──────────────────────────
// kokoro memoizes a voice's style vector by id for the page's lifetime, so one
// slot can only ever voice its FIRST blend this session. To preview arbitrary
// blends we hand each DISTINCT blend its own donor slot from this pool — all
// low-grade voices we don't offer in KOKORO_VOICES, and NOT am_santa (reserved
// for the saved custom voice). A page refresh resets the pool.
const PREVIEW_SLOTS = [
  'af_alloy', 'af_aoede', 'af_jessica', 'af_kore', 'af_nova', 'af_river', 'af_sky',
  'am_echo', 'am_eric', 'am_fenrir', 'am_liam', 'am_onyx', 'am_puck',
  'bf_isabella', 'bm_lewis', 'bf_alice', 'bf_lily', 'bm_daniel', 'bm_fable',
];
const blendPreviewSlots = new Map<string, string>(); // blend key → slot already written this session
let nextPreviewSlot = 0;

function blendKey(voiceA: string, voiceB: string, ratio: number): string {
  return `${voiceA}|${voiceB}|${Math.round(ratio * 100)}`;
}

export type BlendPreviewResult = 'ok' | 'unavailable' | 'exhausted';

/**
 * Speaks a short sample of a blend WITHOUT saving it, so the learner can hear
 * a mix before committing. Re-previewing the same blend reuses its slot (and
 * kokoro's cached audio path); each new blend consumes one pool slot.
 * - 'unavailable': no natural-voice engine (e.g. iOS without opt-in) — nothing
 *    meaningful to preview.
 * - 'exhausted': more distinct blends previewed this session than pool slots;
 *    a refresh frees them.
 */
export async function previewVoiceBlend(
  meta: CustomVoiceMeta,
  opts: { speed?: number; onEnd?: () => void } = {},
): Promise<BlendPreviewResult> {
  if (typeof window === 'undefined' || !('caches' in window)) return 'unavailable';
  const kokoro = await loadKokoro();
  if (!kokoro) return 'unavailable';
  const ratio = Math.max(0, Math.min(1, meta.ratio));
  const key = blendKey(meta.voiceA, meta.voiceB, ratio);
  try {
    let slot = blendPreviewSlots.get(key);
    if (!slot) {
      if (nextPreviewSlot >= PREVIEW_SLOTS.length) return 'exhausted';
      slot = PREVIEW_SLOTS[nextPreviewSlot++];
      await writeBlendToSlot(slot, meta.voiceA, meta.voiceB, ratio);
      blendPreviewSlots.set(key, slot);
    }
    await speak('Hi! This is how your blended voice sounds when I read to you.', {
      voice: slot,
      speed: opts.speed,
      onEnd: opts.onEnd,
    });
    return 'ok';
  } catch (err) {
    console.warn('[tts] blend preview failed:', err);
    return 'unavailable';
  }
}

export async function deleteCustomVoice(): Promise<void> {
  try {
    localStorage.removeItem(CUSTOM_VOICE_KEY);
    if ('caches' in window) {
      const cache = await caches.open('kokoro-voices');
      await cache.delete(VOICE_BIN_URL(CUSTOM_VOICE_SLOT));
    }
  } catch { /* best-effort */ }
}

/** Maps the persisted selection ('custom' included) to a kokoro voice id. */
export function resolveVoiceId(selected: string): string {
  return selected === 'custom' && getCustomVoice() ? CUSTOM_VOICE_SLOT : selected;
}

export function getSelectedVoice(): string {
  if (typeof window === 'undefined') return 'af_heart';
  try {
    const v = localStorage.getItem(VOICE_KEY);
    if (v === 'custom' && getCustomVoice()) return 'custom';
    return v && KOKORO_VOICES.some((k) => k.id === v) ? v : 'af_heart';
  } catch {
    return 'af_heart';
  }
}

export function setSelectedVoice(voiceId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(VOICE_KEY, voiceId);
  } catch { /* storage unavailable */ }
}

/** True once the Kokoro model finished downloading at least once. */
export function isVoiceDownloaded(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(DOWNLOADED_KEY) === '1';
  } catch {
    return false;
  }
}

export type TTSStatus = 'idle' | 'downloading' | 'ready' | 'unavailable';

let status: TTSStatus = 'idle';
export function getTTSStatus(): TTSStatus {
  return status;
}

let kokoroPromise: Promise<KokoroTTSInstance | null> | null = null;
let currentAudio: HTMLAudioElement | null = null;
let currentUtteranceActive = false;

// ORT's wasm runtime logs two benign session-creation warnings ("nodes not
// assigned to the preferred execution provider" — shape ops intentionally run
// on CPU) straight to the console, where Next's dev overlay dresses them up
// as errors. kokoro-js bundles its own nested onnxruntime, so no env/session
// option of ours reaches that instance — filter exactly these messages.
const ORT_NOISE = /onnxruntime[\s\S]*(VerifyEachNodeIsAssignedToAnEp|Rerunning with verbose output)/;
let consoleFiltered = false;
function filterOrtNoise(): void {
  if (consoleFiltered || typeof window === 'undefined') return;
  consoleFiltered = true;
  for (const level of ['warn', 'error', 'log'] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      if (typeof args[0] === 'string' && ORT_NOISE.test(args[0])) return;
      original(...args);
    };
  }
}

// Which backend/dtype Kokoro actually loaded on (e.g. "webgpu/q4f16",
// "wasm/q8") — surfaced in Settings so an iOS tester can report whether the
// WebGPU path took, vs a silent fall back to wasm.
let kokoroBackend: string | null = null;
export function getKokoroBackend(): string | null {
  return kokoroBackend;
}

type KokoroCfg = { device: 'webgpu' | 'wasm'; dtype: string };

/**
 * Does this device have a usable WebGPU adapter, and does it support the
 * `shader-f16` feature? We probe the adapter directly (not just `'gpu' in
 * navigator`) so we never pick a WebGPU config the device can't actually run —
 * important on iOS, where a wrong guess means a wasted multi-MB download before
 * it fails.
 */
async function probeWebGPU(): Promise<{ available: boolean; f16: boolean }> {
  try {
    const gpu = (navigator as unknown as { gpu?: { requestAdapter: () => Promise<{ features?: { has?: (f: string) => boolean } } | null> } }).gpu;
    if (!gpu) return { available: false, f16: false };
    const adapter = await gpu.requestAdapter();
    if (!adapter) return { available: false, f16: false };
    return { available: true, f16: adapter.features?.has?.('shader-f16') ?? false };
  } catch {
    return { available: false, f16: false };
  }
}

/**
 * Ordered list of load configs to try, best-first, each falling back to the
 * next on failure.
 *
 * iOS EXPERIMENT: the wasm heap crashes the tab during inference ("a problem
 * repeatedly occurred"), so on iOS we try to run the math on the GPU instead —
 * q4f16 keeps the GPU footprint tiny (~40 MB) and needs the shader-f16 feature,
 * which modern A-series iPhones expose. If WebGPU/f16 isn't available we don't
 * gamble on a huge fp32 GPU download; we fall straight to the proven wasm/q8
 * (which may still crash old iPhones — that's the signal to move to Piper).
 * Desktop keeps its working webgpu/fp32 path, now with a wasm/q8 safety net.
 */
async function kokoroLadder(ios: boolean): Promise<KokoroCfg[]> {
  const gpu = await probeWebGPU();
  if (ios) {
    if (gpu.available && gpu.f16) {
      return [{ device: 'webgpu', dtype: 'q4f16' }, { device: 'wasm', dtype: 'q8' }];
    }
    return [{ device: 'wasm', dtype: 'q8' }];
  }
  if (gpu.available) return [{ device: 'webgpu', dtype: 'fp32' }, { device: 'wasm', dtype: 'q8' }];
  return [{ device: 'wasm', dtype: 'q8' }];
}

/**
 * A fresh progress aggregator. transformers.js reports progress PER FILE —
 * aggregate loaded/total across files so the bar never jumps backwards. Cap at
 * 99 until the model is actually ready (session init runs after the last byte).
 */
function makeKokoroProgress(onProgress: (pct: number) => void): (info: { file?: string; loaded?: number; total?: number }) => void {
  const files = new Map<string, { loaded: number; total: number }>();
  let best = 0;
  return (info) => {
    if (!info?.file || typeof info.loaded !== 'number' || typeof info.total !== 'number' || info.total <= 0) return;
    files.set(info.file, { loaded: info.loaded, total: info.total });
    let loaded = 0; let total = 0;
    for (const f of files.values()) { loaded += f.loaded; total += f.total; }
    const pct = Math.min(99, Math.round((loaded / total) * 100));
    if (pct > best) { best = pct; onProgress(pct); }
  };
}

async function loadKokoro(onProgress?: (pct: number) => void): Promise<KokoroTTSInstance | null> {
  // iOS Safari's wasm memory ceiling crashes the tab during inference ("a
  // problem repeatedly occurred"), so iPhones default to the built-in system
  // voices. Users who opt in (Settings) get the Kokoro ladder from
  // kokoroLadder(): WebGPU/q4f16 first where supported (runs the math on the GPU,
  // off the crashing wasm heap), else the proven wasm/q8. Warm-up stays OFF on
  // iOS below so the first real turn — not the download — is where any remaining
  // memory crash surfaces.
  const iosOptIn = isIOS();
  if (iosOptIn && !isIOSKokoroEnabled()) {
    status = 'unavailable';
    return null;
  }
  if (kokoroPromise) return kokoroPromise;
  status = 'downloading';
  filterOrtNoise();
  kokoroPromise = (async () => {
    try {
      const { KokoroTTS } = await import('kokoro-js');
      const progress_callback = onProgress ? makeKokoroProgress(onProgress) : undefined;
      const ladder = await kokoroLadder(iosOptIn);
      let tts: KokoroTTSInstance | null = null;
      for (const cfg of ladder) {
        try {
          tts = (await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
            dtype: cfg.dtype,
            device: cfg.device,
            progress_callback,
          } as Parameters<typeof KokoroTTS.from_pretrained>[1])) as unknown as KokoroTTSInstance;
          kokoroBackend = `${cfg.device}/${cfg.dtype}`;
          console.info('[tts] Kokoro loaded on', kokoroBackend);
          break;
        } catch (err) {
          console.warn(`[tts] Kokoro ${cfg.device}/${cfg.dtype} failed to load, trying next:`, err);
        }
      }
      if (!tts) {
        status = 'unavailable';
        return null;
      }
      status = 'ready';
      try { localStorage.setItem(DOWNLOADED_KEY, '1'); } catch { /* storage unavailable */ }
      // Synthesis warm-up: loading the weights isn't enough — the FIRST
      // generate() still pays a one-off cost (ONNX kernel compile, voice
      // embedding load, wasm heap growth) that stalls the first spoken
      // sentence. Run one throwaway synthesis now, while the app is idle after
      // load (StoreInitializer calls warmUpTTS on entry), so the learner's
      // first real turn speaks immediately. Warm a stable built-in voice —
      // the compile is voice-independent, and af_heart always exists even if a
      // custom blend slot isn't populated yet. Discard the audio; never play.
      // SKIP on iOS/low-memory: there, that first generate() is the very step
      // whose wasm heap-growth can blow Safari's per-tab ceiling ("a problem
      // repeatedly occurred") — forcing it at load would crash the download
      // flow instead of just risking the first real turn. Let those devices
      // pay the cost lazily (or fall back to the native voice) rather than crash.
      if (!iosOptIn && !isLowMemoryDevice()) {
        try {
          await (tts as unknown as KokoroTTSInstance).generate('Hello.', { voice: 'af_heart', speed: 1 });
        } catch { /* warm-up is best-effort — a failure here never blocks real use */ }
      }
      return tts as unknown as KokoroTTSInstance;
    } catch (err) {
      console.warn('[tts] Kokoro unavailable, falling back to SpeechSynthesis:', err);
      status = 'unavailable';
      return null;
    }
  })();
  return kokoroPromise;
}

/** Preload the Kokoro model in the background (call once after app load). */
export function warmUpTTS(): void {
  void loadKokoro();
}

/**
 * Direct engine access for voice mode: sentence-streamed synthesis via
 * kokoro's TextSplitterStream. Null when the model can't load.
 */
export async function getKokoro(): Promise<KokoroTTSInstance | null> {
  return loadKokoro();
}

/**
 * Voice download from Settings (task 71): progress in whole percent, resolves
 * true when the model is ready. Safe to call repeatedly — the download is
 * shared with any in-flight warm-up.
 */
export async function downloadVoices(onProgress?: (pct: number) => void): Promise<boolean> {
  const tts = await loadKokoro(onProgress);
  return tts !== null;
}

/**
 * Delete the downloaded Kokoro voice model + cached voice blends so it can be
 * re-fetched fresh — the fix when a download is corrupted or half-written (the
 * likely cause of an iOS voice that downloads but won't play). Forgets the
 * in-memory instance and resets the "downloaded" flag; call downloadVoices()
 * afterwards to refetch.
 */
export async function deleteVoiceDownload(): Promise<void> {
  stopSpeaking();
  kokoroPromise = null;
  status = 'idle';
  try { localStorage.removeItem(DOWNLOADED_KEY); } catch { /* storage unavailable */ }
  if (typeof caches !== 'undefined') {
    try { await caches.delete('kokoro-voices'); } catch { /* ignore */ }
    try {
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        for (const req of await cache.keys()) {
          if (/kokoro/i.test(req.url)) await cache.delete(req);
        }
      }
    } catch { /* Cache API unavailable — the in-memory reset above still lets it re-load */ }
  }
}

export function stopSpeaking(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis && currentUtteranceActive) {
    window.speechSynthesis.cancel();
    currentUtteranceActive = false;
  }
}

export function isSpeaking(): boolean {
  return currentAudio !== null || currentUtteranceActive;
}

/**
 * Best available native SpeechSynthesis voice — the reliable TTS path on iOS,
 * where Kokoro's wasm can exceed Safari's per-tab memory ceiling and crash the
 * page ("a problem repeatedly occurred"). The system default is often the
 * robotic one; iOS/macOS ship far better "enhanced/premium" and named voices
 * (Samantha, Siri), so prefer those. Cached; safe to call every utterance.
 */
// IMPORTANT platform limitation: iOS Safari does NOT expose the neural "Siri"
// voices to the web SpeechSynthesis API — Apple keeps those for native apps.
// getVoices() on iOS only returns the Vocalizer voices (Samantha, Karen, …), so
// the app CANNOT sound like the "Siri Voice 1" a user set in iOS Accessibility.
// The best we can do is let the user pick among the voices iOS actually exposes.
const NATIVE_VOICE_KEY = 'synapse-native-voice';
let nativeVoiceCache: SpeechSynthesisVoice | null = null;

/** English-first list of the native voices this device actually exposes (for the picker). */
export function listNativeVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  const voices = window.speechSynthesis.getVoices();
  const en = voices.filter((v) => /^en[-_]?/i.test(v.lang));
  return en.length ? en : voices;
}

export function getSelectedNativeVoiceURI(): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(NATIVE_VOICE_KEY); } catch { return null; }
}

export function setSelectedNativeVoice(voiceURI: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (voiceURI) localStorage.setItem(NATIVE_VOICE_KEY, voiceURI);
    else localStorage.removeItem(NATIVE_VOICE_KEY);
  } catch { /* storage unavailable */ }
  nativeVoiceCache = null; // force re-resolve on next use
}

/**
 * The native SpeechSynthesis voice to speak with. Honors the user's explicit
 * pick first (Settings → System voice); otherwise auto-selects the best
 * exposed voice — enhanced/premium named voices over the robotic default.
 * Cached; safe to call every utterance.
 */
export function pickBestNativeVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null; // not loaded yet — caller uses the default
  const chosen = getSelectedNativeVoiceURI();
  if (chosen) {
    const match = voices.find((v) => v.voiceURI === chosen || v.name === chosen);
    if (match) return match;
  }
  if (nativeVoiceCache && voices.includes(nativeVoiceCache)) return nativeVoiceCache;
  const en = voices.filter((v) => /^en[-_]?/i.test(v.lang));
  const pool = en.length ? en : voices;
  const score = (v: SpeechSynthesisVoice): number => {
    let s = 0;
    if (/enhanced|premium|neural|siri/i.test(v.name)) s += 10;   // hi-fi variants
    if (/samantha|daniel|karen|moira|serena|aaron|nicky|allison|ava/i.test(v.name)) s += 4; // good iOS/macOS voices
    if (v.localService) s += 2;                                  // on-device = no network hitch
    if (/^en-US/i.test(v.lang)) s += 1;
    return s;
  };
  nativeVoiceCache = pool.slice().sort((a, b) => score(b) - score(a))[0] ?? null;
  return nativeVoiceCache;
}
// SpeechSynthesis loads voices asynchronously; refresh the cache when they arrive.
if (typeof window !== 'undefined' && window.speechSynthesis) {
  try { window.speechSynthesis.addEventListener('voiceschanged', () => { nativeVoiceCache = null; pickBestNativeVoice(); }); } catch { /* older browsers */ }
}

/**
 * Speaks `text`. Resolves once playback STARTS (UI can flip its icon);
 * `onEnd` fires when playback finishes or is stopped. Returns the engine used.
 */
export async function speak(text: string, options: SpeakOptions = {}): Promise<'kokoro' | 'piper' | 'cloud' | 'browser' | 'none'> {
  const clean = text.replace(/```[\s\S]*?```/g, ' (code block) ').replace(/[*_#>`]/g, '').trim();
  if (!clean) return 'none';
  stopSpeaking();

  // On iOS, once Kokoro's synth has crashed the tab we never try it again —
  // route to the cloud voice (Piper also crashes iOS memory, so it's not used
  // there). Elsewhere Kokoro/Piper handle it on-device.
  const skipKokoro = isIOS() && isKokoroSynthKnownBad();

  if (!skipKokoro) {
    const kokoro = await loadKokoro();
    if (kokoro) {
      markKokoroSynthStart();
      try {
        const audio = await kokoro.generate(clean.slice(0, 2000), {
          voice: resolveVoiceId(options.voice ?? getSelectedVoice()),
          speed: options.speed ?? 1,
        });
        markKokoroSynthOk();
        const url = URL.createObjectURL(audio.toBlob());
        const el = new Audio(url);
        currentAudio = el;
        const finish = () => {
          URL.revokeObjectURL(url);
          if (currentAudio === el) currentAudio = null;
          options.onEnd?.();
        };
        el.onended = finish;
        el.onerror = finish;
        await el.play();
        return 'kokoro';
      } catch (err) {
        clearKokoroSynthBreadcrumb(); // catchable error ≠ crash — let Kokoro retry later
        console.warn('[tts] Kokoro generation failed, falling back:', err);
      }
    }
  }

  // Play an MP3/WAV blob through the shared audio element.
  const playBlob = async (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const el = new Audio(url);
    currentAudio = el;
    const finish = () => {
      URL.revokeObjectURL(url);
      if (currentAudio === el) currentAudio = null;
      options.onEnd?.();
    };
    el.onended = finish;
    el.onerror = finish;
    await el.play();
  };

  // Cloud voice: on iOS it REPLACES Piper (both on-device engines crash there),
  // so it's the primary fallback once Kokoro is out. Toggle-controlled.
  if (isIOS() && isCloudVoiceEnabled()) {
    const blob = await cloudSynthesize(clean.slice(0, 1200));
    if (blob) { await playBlob(blob); return 'cloud'; }
  }

  // Piper fallback (on-device, stable ORT) — NON-iOS only now (it crashes iOS
  // memory). Only when already downloaded, so a read-aloud never triggers a
  // surprise ~60 MB fetch.
  if (!isIOS() && piperSupported() && isPiperDownloaded()) {
    const blob = await piperSynthesize(clean.slice(0, 2000));
    if (blob) { await playBlob(blob); return 'piper'; }
  }

  // Cloud voice as a further fallback on non-iOS (e.g. Kokoro failed and Piper
  // isn't downloaded) — still better than the robotic native voice.
  if (!isIOS() && isCloudVoiceEnabled()) {
    const blob = await cloudSynthesize(clean.slice(0, 1200));
    if (blob) { await playBlob(blob); return 'cloud'; }
  }

  // Fallback: browser-native speech (the always-works path)
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    const utterance = new SpeechSynthesisUtterance(clean.slice(0, 3000));
    const nv = pickBestNativeVoice();
    if (nv) utterance.voice = nv;
    utterance.rate = options.speed ?? 1;
    utterance.onend = () => {
      currentUtteranceActive = false;
      options.onEnd?.();
    };
    utterance.onerror = utterance.onend;
    currentUtteranceActive = true;
    window.speechSynthesis.speak(utterance);
    return 'browser';
  }
  options.onEnd?.();
  return 'none';
}
