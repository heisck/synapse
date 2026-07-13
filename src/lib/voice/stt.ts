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

async function loadWhisper(): Promise<Transcriber | null> {
  if (whisperPromise) return whisperPromise;
  emitStatus('loading', 0);
  whisperPromise = (async () => {
    const { pipeline } = await import('@huggingface/transformers').catch(() => ({ pipeline: null as never }));
    if (!pipeline) {
      emitStatus('unavailable', 0);
      return null;
    }
    // Fallback ladder: transformers.js v4's ONNX runtime rejects the q8
    // whisper-base decoder ("Missing required scale ... MatMulNBits"), so a
    // failed config falls through to the next known-good one.
    // Phones/low-memory devices go straight to whisper-tiny — loading the
    // ~150 MB fp32 base model there crashes the tab (OOM → reload → the
    // "glitch back to the landing page" report).
    const configs: Array<{ model: string; dtype: 'q8' | 'fp32' }> = isLowMemoryDevice()
      ? [
          { model: 'onnx-community/whisper-tiny.en', dtype: 'q8' },
          { model: 'onnx-community/whisper-tiny.en', dtype: 'fp32' },
        ]
      : [
          { model: 'onnx-community/whisper-base', dtype: 'q8' },
          { model: 'onnx-community/whisper-base', dtype: 'fp32' },
          { model: 'onnx-community/whisper-tiny.en', dtype: 'fp32' },
        ];
    for (const cfg of configs) {
      try {
        const asr = await pipeline('automatic-speech-recognition', cfg.model, {
          dtype: cfg.dtype,
          device: 'wasm',
          progress_callback: (info: unknown) => {
            const p = (info as { progress?: number })?.progress;
            if (typeof p === 'number') emitStatus('loading', Math.round(p));
          },
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
