/**
 * Device transfer: the entire user profile lives in this browser's
 * localStorage. These helpers pack every app key into a portable code the
 * user can paste on a new device, and unpack it there.
 */

const APP_KEY_PREFIXES = ['synapse-', 'synapselearn_'] as const;
const EXTRA_KEYS = ['theme'] as const; // next-themes
// Each device keeps its own presence identity — never transfer it.
const EXCLUDED_KEYS = new Set(['synapse-instance-id']);

const TRANSFER_VERSION = 1;

interface TransferPayload {
  version: number;
  exportedAt: string;
  data: Record<string, string>;
}

function isAppKey(key: string): boolean {
  if (EXCLUDED_KEYS.has(key)) return false;
  return (
    APP_KEY_PREFIXES.some((p) => key.startsWith(p)) ||
    (EXTRA_KEYS as readonly string[]).includes(key)
  );
}

/** Collects all app data from localStorage into a transfer payload. */
export function gatherProfileData(): TransferPayload {
  const data: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !isAppKey(key)) continue;
    const value = localStorage.getItem(key);
    if (value !== null) data[key] = value;
  }
  return { version: TRANSFER_VERSION, exportedAt: new Date().toISOString(), data };
}

/** Encodes the profile as a single base64 text code (unicode-safe). */
export function exportProfileCode(): string {
  const json = JSON.stringify(gatherProfileData());
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

/**
 * Decodes and validates a transfer code. Returns the payload or throws with
 * a human-readable message.
 */
export function decodeProfileCode(code: string): TransferPayload {
  let json: string;
  try {
    const binary = atob(code.trim());
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    json = new TextDecoder().decode(bytes);
  } catch {
    throw new Error('That code is not valid — check that you copied the whole thing.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('That code could not be read as profile data.');
  }

  if (
    !parsed || typeof parsed !== 'object' ||
    typeof (parsed as TransferPayload).version !== 'number' ||
    typeof (parsed as TransferPayload).data !== 'object' ||
    (parsed as TransferPayload).data === null
  ) {
    throw new Error('That code does not contain a SynapseLearn profile.');
  }

  const payload = parsed as TransferPayload;
  const keys = Object.keys(payload.data);
  if (keys.length === 0) {
    throw new Error('That profile code is empty.');
  }
  if (!keys.every((k) => isAppKey(k) || EXCLUDED_KEYS.has(k))) {
    throw new Error('That code contains data that does not belong to this app.');
  }
  return payload;
}

/**
 * Writes an imported profile into localStorage. Returns the number of keys
 * restored. Caller should reload the page afterwards.
 */
export function importProfileCode(code: string): number {
  const payload = decodeProfileCode(code);
  let count = 0;
  for (const [key, value] of Object.entries(payload.data)) {
    if (EXCLUDED_KEYS.has(key)) continue;
    localStorage.setItem(key, value);
    count++;
  }
  return count;
}

/** Enumerates every app-owned localStorage key (for full reset). */
export function listAppKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (APP_KEY_PREFIXES.some((p) => key.startsWith(p))) keys.push(key);
  }
  return keys;
}

/** Removes all app data from this browser (including presence identity). */
export function resetAllData(): void {
  listAppKeys().forEach((key) => localStorage.removeItem(key));
}
