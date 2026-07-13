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

import { isIOS } from '@/lib/voice/device';

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

async function loadKokoro(onProgress?: (pct: number) => void): Promise<KokoroTTSInstance | null> {
  // iOS Safari's wasm memory ceiling can't hold the fp32 Kokoro model (tab
  // crashes with "a problem repeatedly occurred"), so iPhones default to the
  // built-in system voices. Users who opt in (Settings) get the q8 build,
  // which is small enough to fit on modern devices — force q8/wasm below.
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
      // On iOS force the small q8/wasm build even if WebGPU is exposed — the
      // fp32 path is what blows Safari's memory ceiling.
      const hasWebGPU = !iosOptIn && typeof navigator !== 'undefined' && 'gpu' in navigator;
      const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
        dtype: hasWebGPU ? 'fp32' : 'q8',
        device: hasWebGPU ? 'webgpu' : 'wasm',
        // transformers.js reports progress PER FILE — aggregate loaded/total
        // across files so the bar never jumps backwards
        progress_callback: onProgress
          ? (() => {
              const files = new Map<string, { loaded: number; total: number }>();
              let best = 0;
              return (info: { file?: string; loaded?: number; total?: number }) => {
                if (!info?.file || typeof info.loaded !== 'number' || typeof info.total !== 'number' || info.total <= 0) return;
                files.set(info.file, { loaded: info.loaded, total: info.total });
                let loaded = 0; let total = 0;
                for (const f of files.values()) { loaded += f.loaded; total += f.total; }
                // Cap at 99 until the model is actually ready (session init runs
                // after the last byte) — keeps the bar from freezing at 100.
                const pct = Math.min(99, Math.round((loaded / total) * 100));
                if (pct > best) { best = pct; onProgress(pct); }
              };
            })()
          : undefined,
      } as Parameters<typeof KokoroTTS.from_pretrained>[1]);
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
      try {
        await (tts as unknown as KokoroTTSInstance).generate('Hello.', { voice: 'af_heart', speed: 1 });
      } catch { /* warm-up is best-effort — a failure here never blocks real use */ }
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
 * Speaks `text`. Resolves once playback STARTS (UI can flip its icon);
 * `onEnd` fires when playback finishes or is stopped. Returns the engine used.
 */
export async function speak(text: string, options: SpeakOptions = {}): Promise<'kokoro' | 'browser' | 'none'> {
  const clean = text.replace(/```[\s\S]*?```/g, ' (code block) ').replace(/[*_#>`]/g, '').trim();
  if (!clean) return 'none';
  stopSpeaking();

  const kokoro = await loadKokoro();
  if (kokoro) {
    try {
      const audio = await kokoro.generate(clean.slice(0, 2000), {
        voice: resolveVoiceId(options.voice ?? getSelectedVoice()),
        speed: options.speed ?? 1,
      });
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
      console.warn('[tts] Kokoro generation failed, falling back:', err);
    }
  }

  // Fallback: browser-native speech
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    const utterance = new SpeechSynthesisUtterance(clean.slice(0, 3000));
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
