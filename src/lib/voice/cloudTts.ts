'use client';

/**
 * Cloud voice client — the network TTS used when on-device engines can't run
 * (iOS, where Kokoro crashes the tab and Piper crashes memory). Posts text to
 * /api/voice/tts and gets back an MP3 blob (Edge Neural, or Google fallback).
 * Playback is owned by the caller (tts.ts / VoiceMode) so stop/interrupt stays
 * uniform with the other engines.
 */

const ENABLED_KEY = 'synapse-cloud-voice';
const VOICE_KEY = 'synapse-cloud-voice-id';

// A short list of Edge Neural voices (used when the request reaches Edge; the
// Google fallback ignores the name and uses its single voice).
export const CLOUD_VOICES: Array<{ id: string; label: string }> = [
  { id: 'en-US-AriaNeural', label: 'Aria — US female (warm)' },
  { id: 'en-US-JennyNeural', label: 'Jenny — US female (friendly)' },
  { id: 'en-US-GuyNeural', label: 'Guy — US male' },
  { id: 'en-US-AndrewNeural', label: 'Andrew — US male (natural)' },
  { id: 'en-GB-SoniaNeural', label: 'Sonia — UK female' },
  { id: 'en-GB-RyanNeural', label: 'Ryan — UK male' },
];
const DEFAULT_VOICE = 'en-US-AriaNeural';

/** Cloud voice is ON by default — it's the only good voice on iOS. */
export function isCloudVoiceEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(ENABLED_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setCloudVoiceEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ENABLED_KEY, enabled ? '1' : '0');
  } catch {
    /* storage unavailable */
  }
}

export function getSelectedCloudVoice(): string {
  if (typeof window === 'undefined') return DEFAULT_VOICE;
  try {
    return localStorage.getItem(VOICE_KEY) || DEFAULT_VOICE;
  } catch {
    return DEFAULT_VOICE;
  }
}

export function setSelectedCloudVoice(voiceId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(VOICE_KEY, voiceId);
  } catch {
    /* storage unavailable */
  }
}

/**
 * Synthesize `text` to an MP3 Blob via the cloud route, or null if it failed.
 * `signal` lets the caller abort in-flight synthesis on barge-in/stop.
 */
export async function cloudSynthesize(text: string, signal?: AbortSignal): Promise<Blob | null> {
  const clean = text.trim();
  if (!clean) return null;
  try {
    const res = await fetch('/api/voice/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: clean.slice(0, 1200), voice: getSelectedCloudVoice() }),
      signal,
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return blob.size > 0 ? blob : null;
  } catch {
    return null; // aborted or network error — caller falls back
  }
}
