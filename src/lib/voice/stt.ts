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

type Transcriber = (audio: Float32Array) => Promise<{ text: string }>;

let whisperPromise: Promise<Transcriber | null> | null = null;

async function loadWhisper(): Promise<Transcriber | null> {
  if (whisperPromise) return whisperPromise;
  whisperPromise = (async () => {
    try {
      const { pipeline } = await import('@huggingface/transformers');
      const asr = await pipeline('automatic-speech-recognition', 'onnx-community/whisper-base', {
        dtype: 'q8',
        device: 'wasm',
      });
      return (async (audio: Float32Array) => {
        const out = (await asr(audio)) as { text?: string };
        return { text: out?.text ?? '' };
      }) as Transcriber;
    } catch (err) {
      console.warn('[stt] Whisper unavailable:', err);
      return null;
    }
  })();
  return whisperPromise;
}

/** Preload Whisper (voice mode calls this on open so turn 1 is fast). */
export function warmUpWhisper(): void {
  void loadWhisper();
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
