'use client';

/**
 * TTS seam (UNIFIED-PLAN task 49, req C17; pinned engine: Kokoro).
 *
 * Primary: Kokoro-82M running IN THE BROWSER via kokoro-js (ONNX / WebGPU or
 * WASM) — natural open-source voice, nothing leaves the device, no server
 * cost. The model (~80 MB, quantized) downloads once on first use and is
 * cached by the browser.
 *
 * Fallback: the Web Speech API (SpeechSynthesis) when kokoro-js can't load
 * (old browser, blocked download, low memory) — speech always works.
 */

export interface SpeakOptions {
  /** 0.5–2.0 playback speed. */
  speed?: number;
  /** Kokoro voice id (e.g. 'af_heart', 'af_bella', 'am_michael'). */
  voice?: string;
  onEnd?: () => void;
}

type KokoroTTSInstance = {
  generate: (text: string, opts: { voice: string; speed?: number }) => Promise<{ toBlob: () => Blob }>;
};

let kokoroPromise: Promise<KokoroTTSInstance | null> | null = null;
let currentAudio: HTMLAudioElement | null = null;
let currentUtteranceActive = false;

async function loadKokoro(): Promise<KokoroTTSInstance | null> {
  if (kokoroPromise) return kokoroPromise;
  kokoroPromise = (async () => {
    try {
      const { KokoroTTS } = await import('kokoro-js');
      const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
      const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
        dtype: hasWebGPU ? 'fp32' : 'q8',
        device: hasWebGPU ? 'webgpu' : 'wasm',
      });
      return tts as unknown as KokoroTTSInstance;
    } catch (err) {
      console.warn('[tts] Kokoro unavailable, falling back to SpeechSynthesis:', err);
      return null;
    }
  })();
  return kokoroPromise;
}

/** Preload the Kokoro model in the background (call once after app load). */
export function warmUpTTS(): void {
  void loadKokoro();
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
        voice: options.voice ?? 'af_heart',
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
