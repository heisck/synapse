/**
 * The learner's own OpenRouter API key. Lives ONLY in this browser's
 * localStorage — never in our database, never logged server-side. The server
 * reads it per-request from the `x-openrouter-key` header and forgets it.
 * This is what lets the project run without the platform holding anyone's
 * credentials (see docs/ROADMAP.md, Phase 1).
 */

const STORAGE_KEY = 'synapse-openrouter-key';

export function getOpenRouterKey(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setOpenRouterKey(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = key.trim();
    if (trimmed) localStorage.setItem(STORAGE_KEY, trimmed);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable (private mode) — the key just won't persist
  }
}

/**
 * fetch() wrapper for AI-backed endpoints: attaches the learner's key header.
 * Use for /api/chat, /api/questions, /api/error-analysis, /api/study-plan.
 */
export function aiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const key = getOpenRouterKey();
  const headers = new Headers(init.headers);
  if (key) headers.set('x-openrouter-key', key);
  return fetch(input, { ...init, headers });
}

/** Human message for a 401 NO_API_KEY response, shown as a toast. */
export const NO_KEY_MESSAGE =
  'Add your free OpenRouter API key in Settings to use AI features. Create one at openrouter.ai — it stays in your browser only.';
