'use client';

/**
 * STT fallback seam (UNIFIED-PLAN task 50, req C17; pinned engine: Whisper).
 *
 * The tutor's live voice input keeps using the browser's SpeechRecognition
 * where it exists (realtime, zero download). This module adds a Whisper path
 * — onnx-community/whisper-base via transformers.js, fully in-browser — for
 * browsers WITHOUT SpeechRecognition (Firefox, some WebViews): record a clip
 * with MediaRecorder, transcribe locally, hand the text back. Same
 * interrupt-and-resume UX, no audio ever leaves the device (R1).
 */

import { isLowMemoryDevice } from '@/lib/voice/device';

type Transcriber = (audio: Float32Array) => Promise<{ text: string }>;

let whisperPromise: Promise<Transcriber | null> | null = null;

export type WhisperStatus = 'idle' | 'loading' | 'ready' | 'unavailable';
let whisperStatus: WhisperStatus = 'idle';
let whisperProgress = 0;
const statusListeners = new Set<(status: WhisperStatus, progress: number) => void>();

export function getWhisperStatus(): { status: WhisperStatus; progress: number } {
  return { status: whisperStatus, progress: whisperProgress };
}

/** Subscribe to Whisper load status/progress (voice mode UI). */
export function onWhisperStatus(cb: (status: WhisperStatus, progress: number) => void): () => void {
  statusListeners.add(cb);
  cb(whisperStatus, whisperProgress);
  return () => statusListeners.delete(cb);
}

function emitStatus(status: WhisperStatus, progress: number): void {
  whisperStatus = status;
  whisperProgress = progress;
  for (const cb of statusListeners) cb(status, progress);
}

/**
 * transformers.js reports download progress PER FILE (tokenizer 0→100, then
 * encoder 0→100, …), which reads as a bar jumping backwards. Aggregate
 * loaded/total across all files into one monotonic percentage.
 */
function makeProgressAggregator(emit: (pct: number) => void): (info: unknown) => void {
  const files = new Map<string, { loaded: number; total: number }>();
  let best = 0;
  return (info: unknown) => {
    const i = info as { file?: string; loaded?: number; total?: number; status?: string };
    if (!i?.file || typeof i.loaded !== 'number' || typeof i.total !== 'number' || i.total <= 0) return;
    files.set(i.file, { loaded: i.loaded, total: i.total });
    let loaded = 0;
    let total = 0;
    for (const f of files.values()) { loaded += f.loaded; total += f.total; }
    // Cap byte-download progress at 99 — the model isn't usable until ONNX
    // session creation finishes AFTER the last byte arrives. Reserving 100 for
    // the 'ready' emit means the bar can't sit frozen at 100 during (or after
    // a failure in) session init; a stall shows as 99 = "finalizing".
    const pct = Math.min(99, Math.round((loaded / total) * 100));
    if (pct > best) { best = pct; emit(pct); }
  };
}

async function loadWhisper(): Promise<Transcriber | null> {
  if (whisperPromise) return whisperPromise;
  emitStatus('loading', 0);
  whisperPromise = (async () => {
    const { pipeline } = await import('@huggingface/transformers').catch(() => ({ pipeline: null as never }));
    if (!pipeline) {
      emitStatus('unavailable', 0);
      return null;
    }
    // Fallback ladder.
    // Phones/low-memory devices go straight to whisper-tiny — loading the
    // ~150 MB fp32 base model there crashes the tab (OOM → reload → the
    // "glitch back to the landing page" report).
    const configs: Array<{ model: string; dtype: 'q8' | 'fp32' }> = isLowMemoryDevice()
      ? [
          { model: 'Xenova/whisper-tiny.en', dtype: 'q8' },
          { model: 'Xenova/whisper-tiny.en', dtype: 'fp32' },
        ]
      : [
          { model: 'Xenova/whisper-base', dtype: 'q8' },
          { model: 'Xenova/whisper-base', dtype: 'fp32' },
          { model: 'Xenova/whisper-tiny.en', dtype: 'q8' },
        ];
    for (const cfg of configs) {
      try {
        const asr = await pipeline('automatic-speech-recognition', cfg.model, {
          dtype: cfg.dtype,
          device: 'wasm',
          // onnxruntime-web (the 1.26.0-dev build bundled by @huggingface/
          // transformers v4) crashes creating the Whisper decoder session at
          // its default optimization level: its QDQ→MatMulNBits fusion
          // ("extended" level) chokes on the decoder's tied embed_tokens
          // weight — "qdq_actions.cc:137 TransposeDQWeightsForMatMulNBits
          // Missing required scale: model.decoder.embed_tokens.weight_merged_0
          // _scale". This hit EVERY rung of the ladder (the "STT download
          // failed / unavailable on phone" report) and every dtype (q8 AND
          // fp32), so it isn't a model-file issue — switching model repos does
          // nothing. Capping optimization at 'basic' skips the broken fusion
          // while keeping constant-folding etc.; the session then loads and
          // runs. Verified against onnxruntime-web 1.26.0-dev directly: 'all'
          // and 'extended' throw, 'basic' and 'disabled' succeed.
          session_options: { graphOptimizationLevel: 'basic' },
          progress_callback: makeProgressAggregator((pct) => emitStatus('loading', pct)),
        });
        emitStatus('ready', 100);
        try { localStorage.setItem('synapse-stt-downloaded', '1'); } catch { /* storage unavailable */ }
        return (async (audio: Float32Array) => {
          const out = (await asr(audio)) as { text?: string };
          return { text: out?.text ?? '' };
        }) as Transcriber;
      } catch (err) {
        console.warn(`[stt] ${cfg.model} (${cfg.dtype}) failed, trying next:`, err);
      }
    }
    emitStatus('unavailable', 0);
    whisperPromise = null; // allow a retry after transient failures
    return null;
  })();
  return whisperPromise;
}

/** Preload Whisper (voice mode calls this on open so turn 1 is fast). */
export function warmUpWhisper(): void {
  void loadWhisper();
}

const STT_DOWNLOADED_KEY = 'synapse-stt-downloaded';

/** True once Whisper finished downloading at least once (browser-cached). */
export function isWhisperDownloaded(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(STT_DOWNLOADED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Explicit download from Settings — progress arrives via onWhisperStatus.
 * Resolves true when the model is ready; weights are cached by the browser,
 * so this is one-time.
 */
export async function downloadWhisper(): Promise<boolean> {
  const t = await loadWhisper();
  if (t) {
    try { localStorage.setItem(STT_DOWNLOADED_KEY, '1'); } catch { /* storage unavailable */ }
  }
  return t !== null;
}

/**
 * Delete the cached Whisper model so it re-downloads fresh — the fix when a
 * download is corrupted or half-written (e.g. an interrupted mobile download).
 * Forgets the in-memory instance, resets the "downloaded" flag, and evicts the
 * model files from the browser cache. Call downloadWhisper() afterwards to refetch.
 */
export async function deleteWhisperDownload(): Promise<void> {
  whisperPromise = null;
  emitStatus('idle', 0);
  try { localStorage.removeItem(STT_DOWNLOADED_KEY); } catch { /* storage unavailable */ }
  if (typeof caches !== 'undefined') {
    try {
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        for (const req of await cache.keys()) {
          if (/whisper/i.test(req.url)) await cache.delete(req);
        }
      }
    } catch { /* Cache API unavailable — the in-memory reset above still lets it re-load */ }
  }
}

/**
 * Transcribe a raw 16 kHz mono Float32 clip (what the VAD hands us in voice
 * mode). Returns '' when Whisper is unavailable or the clip is silent.
 */
export async function transcribeAudio(audio: Float32Array): Promise<string> {
  if (audio.length < 1600) return ''; // < 0.1s — noise
  const transcriber = await loadWhisper();
  if (!transcriber) return '';
  try {
    const { text } = await transcriber(audio);
    // Whisper hallucinates fillers on near-silence — drop known artifacts
    const cleaned = text.trim();
    if (/^[\s.!?,-]*$/.test(cleaned)) return '';
    if (/^\[\s*(silence|music|noise|blank_audio)\s*\]$/i.test(cleaned)) return '';
    return cleaned;
  } catch {
    return '';
  }
}

/**
 * Native SpeechRecognition (Chrome/Edge/Android): instant, zero-download,
 * live interim transcripts. Voice mode prefers this; Whisper is the fallback
 * for browsers without it (Firefox) — where the current transformers.js v4
 * runtime may not load whisper ONNX at all.
 */
export function nativeSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

export function whisperSupported(): boolean {
  return typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

export interface WhisperRecording {
  /** Stops recording and resolves with the transcription. */
  stop: () => Promise<string>;
  cancel: () => void;
}

/**
 * Starts recording the microphone; call `.stop()` to end and transcribe.
 * Loads the Whisper model in parallel with the recording, so short clips
 * transcribe almost immediately after stopping.
 */
export async function startWhisperRecording(): Promise<WhisperRecording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  recorder.start();
  const modelLoading = loadWhisper(); // warm up while the learner speaks

  const teardown = () => {
    stream.getTracks().forEach((t) => t.stop());
  };

  return {
    cancel: () => {
      try { recorder.stop(); } catch { /* already stopped */ }
      teardown();
    },
    stop: () =>
      new Promise<string>((resolve) => {
        recorder.onstop = async () => {
          teardown();
          try {
            const transcriber = await modelLoading;
            if (!transcriber) return resolve('');
            const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
            // Decode to 16 kHz mono Float32 — what Whisper expects
            const ctx = new AudioContext({ sampleRate: 16_000 });
            const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
            const mono = decoded.getChannelData(0);
            await ctx.close();
            const { text } = await transcriber(mono);
            resolve(text.trim());
          } catch (err) {
            console.warn('[stt] transcription failed:', err);
            resolve('');
          }
        };
        recorder.stop();
      }),
  };
}
