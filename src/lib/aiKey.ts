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

// The server sets `X-AI-Degraded: 1` (+ `X-AI-Degraded-Reason`) / a `degraded`
// body field when a reply came from the keyless fallback instead of a full
// model. We warn the learner, but throttle so it shows at most once every few
// minutes per reason rather than on every message.
const degradedShownAt: Record<string, number> = {};
const DEGRADED_THROTTLE_MS = 8 * 60 * 1000;

/**
 * Returns the learner-facing "you're on the free fallback" message for the
 * given reason, or null if one was shown too recently (so callers can just
 * `const m = degradedNoticeMessage(reason); if (m) toast(m)`). Reason comes
 * from the server and is a quality signal only — it never names a provider.
 */
export function degradedNoticeMessage(reason?: string | null): string | null {
  const key = reason || 'generic';
  const now = Date.now();
  if (now - (degradedShownAt[key] || 0) < DEGRADED_THROTTLE_MS) return null;
  degradedShownAt[key] = now;
  switch (reason) {
    case 'rate_limited':
      return 'Your OpenRouter key hit its rate limit — using a free fallback model for now, so answers may be lower quality. Wait for the limit to reset, or add another key in Settings.';
    case 'no_key':
      return 'Using a free fallback model — answers may be lower quality. Add your free OpenRouter key in Settings for full quality (it stays in your browser).';
    default:
      return 'The main AI models are busy right now — using a free fallback, so answers may be lower quality. Try again shortly for full quality.';
  }
}
