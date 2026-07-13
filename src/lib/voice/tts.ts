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
 * Blends two built-in voices into the custom slot. Fetches both style
 * vectors, mixes element-wise, and plants the result in the Cache API entry
 * kokoro-js reads for the slot id. Takes effect for sessions where the slot
 * hasn't been spoken yet (kokoro memoizes per session — a reload always picks
 * the new blend up).
 */
export async function saveCustomVoiceBlend(meta: CustomVoiceMeta): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window)) return false;
  try {
    const ratio = Math.max(0, Math.min(1, meta.ratio));
    const [binA, binB] = await Promise.all(
      [meta.voiceA, meta.voiceB].map(async (id) => {
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
      VOICE_BIN_URL(CUSTOM_VOICE_SLOT),
      new Response(blended.buffer as ArrayBuffer, { headers: { 'Content-Type': 'application/octet-stream' } }),
    );
    localStorage.setItem(CUSTOM_VOICE_KEY, JSON.stringify({ ...meta, ratio }));
    return true;
  } catch (err) {
    console.warn('[tts] custom voice blend failed:', err);
    return false;
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
  // iOS Safari's wasm memory ceiling can't hold Kokoro alongside the rest of
  // the app (tab crashes with "a problem repeatedly occurred") — iPhones use
  // their excellent built-in system voices via SpeechSynthesis instead.
  if (isIOS()) {
    status = 'unavailable';
    return null;
  }
  if (kokoroPromise) return kokoroPromise;
  status = 'downloading';
  filterOrtNoise();
  kokoroPromise = (async () => {
    try {
      const { KokoroTTS } = await import('kokoro-js');
      const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
      const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
        dtype: hasWebGPU ? 'fp32' : 'q8',
        device: hasWebGPU ? 'webgpu' : 'wasm',
        // transformers.js progress events: {status, progress?} per file
        progress_callback: onProgress
          ? (info: { status?: string; progress?: number }) => {
              if (typeof info?.progress === 'number') onProgress(Math.round(info.progress));
            }
          : undefined,
      } as Parameters<typeof KokoroTTS.from_pretrained>[1]);
      status = 'ready';
      try { localStorage.setItem(DOWNLOADED_KEY, '1'); } catch { /* storage unavailable */ }
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
