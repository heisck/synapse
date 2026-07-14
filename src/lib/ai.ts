export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

/**
 * Why a response came from the keyless fallback instead of a full model — lets
 * the UI show the right nudge (add a key / wait for the limit to reset) without
 * ever naming a provider (identity firewall).
 */
export type DegradedReason = 'no_key' | 'rate_limited' | 'provider_down';

interface ChatResult {
  choices: Array<{ message: { content: string } }>;
  model?: string;
  // Set when the answer came from the keyless low-quality floor, so callers can
  // warn the learner. `degradedReason` says WHY, to tailor the message.
  degraded?: boolean;
  degradedReason?: DegradedReason;
}

/**
 * Per-request credentials. The learner supplies their own OpenRouter API key
 * (sent as the `x-openrouter-key` header from the browser, where it lives in
 * localStorage). The platform stores no keys: there is deliberately NO
 * server-side OPENROUTER_API_KEY fallback.
 */
export interface LLMAuth {
  apiKey?: string;
}

/** Thrown when a request needs the LLM but no user key (and no Hermes) is available. */
export class NoApiKeyError extends Error {
  code = 'NO_API_KEY' as const;
  constructor() {
    super('No OpenRouter API key. Add your free OpenRouter key in Settings to use AI features.');
  }
}

/** Thrown when the user's key is rate-limited on every model we tried. */
export class RateLimitedError extends Error {
  code = 'RATE_LIMITED' as const;
  constructor() {
    super('Your OpenRouter key has hit its rate limit. Wait for it to reset or use a different key in Settings.');
  }
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Free-tier models are frequently rate-limited upstream, so we keep a
// rotation: try each in order, skipping any that recently failed.
// Override with OPENROUTER_MODELS (comma-separated) or OPENROUTER_MODEL.
// Slugs verified live against openrouter.ai/api/v1/models (2026-07-14): the old
// `openai/gpt-oss-120b:free` was RETIRED from the free tier (it now 404s / is
// paid-only), so it's gone from every ladder here. A broad reliable set,
// strongest/most-disciplined first, with a fast MoE tail so a response always
// lands even when the big models are all cooling down.
const OPENROUTER_MODELS = (
  process.env.OPENROUTER_MODELS ||
  process.env.OPENROUTER_MODEL ||
  [
    'google/gemma-4-31b-it:free',
    'qwen/qwen3-next-80b-a3b-instruct:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'openai/gpt-oss-20b:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
    'google/gemma-4-26b-a4b-it:free',
  ].join(',')
)
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

/**
 * Role router (UNIFIED-PLAN task 32, C11; pinned model choices 2026-07-11).
 * Each role runs its own free-model rotation; every role falls back to the
 * general OPENROUTER_MODELS rotation when its specialists are all cooling
 * down. Override per role with OPENROUTER_<ROLE>_MODELS env (comma-separated).
 *
 * Model choices are benchmarked AND discipline-tested, not guessed (free
 * endpoints, 2026-07-13). DISCIPLINE beats raw speed for the teaching roles:
 * a model that leaks its reasoning into the reply ("bleeding thoughts"), drifts
 * off the current slide, or lets the learner's message override the system
 * prompt breaks the product. Tested each candidate over multiple runs on: no
 * reasoning-leak, stays on-slide, refuses learner override-attempts, holds the
 * identity firewall. Findings:
 *   gpt-oss-120b — was the cleanest + most disciplined leader, but OpenRouter
 *     RETIRED it from the free tier (2026-07-14, now 404s). Its 20b sibling
 *     (same family, same discipline, less depth) stays in the ladders as a
 *     clean fallback.
 *   gemma-4-*-it — no reasoning phase at all (structurally can't bleed),
 *     disciplined, multimodal, fast → now LEADS teach + reason (31b) and the
 *     latency-critical voice + fast roles (26b-a4b).
 *   qwen3-next-80b-a3b-instruct — strong instruct model (no reasoning phase to
 *     leak), 262k ctx → depth backup for teach/reason.
 *   llama-3.3-70b-instruct — solid, no reasoning leak → mid-ladder fallback.
 *   nemotron-3-super-120b-a12b — fast but BLEEDS reasoning into content →
 *     stays OUT of the user-facing role ladders (general rotation tail only).
 * Override per role with OPENROUTER_<ROLE>_MODELS env (comma-separated).
 *
 *  reason — orchestration decisions, verification, math/logic (trust > speed)
 *  teach  — the voice the learner hears in TEXT chat (discipline + depth)
 *  fast   — routing, classification, quick answers
 *  voice  — spoken voice-mode replies: fast, and clean by construction (gemma
 *           has no reasoning to leak). See the chat route's voiceMode branch.
 *  vision — images/diagrams (see OPENROUTER_VISION_MODELS below)
 */
export type ModelRole = 'reason' | 'teach' | 'fast' | 'voice';

const ROLE_MODELS: Record<ModelRole, string[]> = {
  // Discipline-first (see block comment): gemma-4-31b now leads the teaching
  // roles (disciplined, no reasoning-leak), backed by qwen3-next-80b and
  // llama-3.3-70b for depth and gpt-oss-20b as the clean tail. The latency
  // roles lead with the fast gemma-4-26b MoE. nemotron-super is deliberately
  // NOT here — it bleeds reasoning into replies. 404s park a model for 24h.
  reason: (process.env.OPENROUTER_REASON_MODELS || 'google/gemma-4-31b-it:free,qwen/qwen3-next-80b-a3b-instruct:free,meta-llama/llama-3.3-70b-instruct:free,openai/gpt-oss-20b:free')
    .split(',').map((m) => m.trim()).filter(Boolean),
  teach: (process.env.OPENROUTER_TEACH_MODELS || 'google/gemma-4-31b-it:free,qwen/qwen3-next-80b-a3b-instruct:free,meta-llama/llama-3.3-70b-instruct:free,openai/gpt-oss-20b:free')
    .split(',').map((m) => m.trim()).filter(Boolean),
  fast: (process.env.OPENROUTER_FAST_MODELS || 'google/gemma-4-26b-a4b-it:free,openai/gpt-oss-20b:free,meta-llama/llama-3.2-3b-instruct:free')
    .split(',').map((m) => m.trim()).filter(Boolean),
  voice: (process.env.OPENROUTER_VOICE_MODELS || 'google/gemma-4-26b-a4b-it:free,openai/gpt-oss-20b:free,meta-llama/llama-3.2-3b-instruct:free')
    .split(',').map((m) => m.trim()).filter(Boolean),
};

/**
 * JSON handoff schema between orchestrator and specialists (old-plan Phase 4):
 * carried alongside every routed task so retries/failover keep full context.
 */
export interface TaskEnvelope {
  task: string;
  role: ModelRole;
  hints?: string[];
  retryPolicy?: { maxAttempts: number };
  confidence?: number;
}

// Free vision models for image understanding / OCR / diagram + formula reading.
// 2026-07-13: the old pins (Qwen-VL, InternVL, LLaVA) ALL 404'd on OpenRouter —
// image upload was silently dead. Verified live now: gemma-4 is multimodal AND
// disciplined (leads text too), so it reads uploaded formulas/diagrams and
// explains them in the same LaTeX the chat renders; nemotron's dedicated VL
// model is the fallback. Availability drifts upstream — override with
// OPENROUTER_VISION_MODELS. 404s park a model for 24h (below).
const OPENROUTER_VISION_MODELS = (
  process.env.OPENROUTER_VISION_MODELS ||
  [
    'google/gemma-4-31b-it:free',
    'google/gemma-4-26b-a4b-it:free',
    'nvidia/nemotron-nano-12b-v2-vl:free',
  ].join(',')
)
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

const POLLINATIONS_URL = 'https://text.pollinations.ai/openai';
const POLLINATIONS_MODEL = process.env.POLLINATIONS_MODEL || 'openai';

/**
 * Hermes agent hook. When HERMES_AGENT_URL is configured, ALL chat traffic is
 * routed to that endpoint first (an OpenAI-compatible /chat/completions
 * server). This is the integration point for a future cloud-hosted Hermes
 * orchestrator agent — plug it in by setting the env vars; nothing else in the
 * codebase needs to change. Falls back to the learner's own OpenRouter key if
 * Hermes is unreachable.
 */
const HERMES_AGENT_URL = process.env.HERMES_AGENT_URL;
const HERMES_AGENT_API_KEY = process.env.HERMES_AGENT_API_KEY;
const HERMES_AGENT_MODEL = process.env.HERMES_AGENT_MODEL || 'hermes';

// Per-key, per-model circuit breaker: a model that just returned 429/5xx for a
// given key is skipped for a cooldown instead of paying a failed round-trip on
// every message. Keyed by key fingerprint so one learner's rate limit never
// cools a model down for everyone else.
const modelDownUntil = new Map<string, number>();
const MODEL_COOLDOWN_MS = 5 * 60 * 1000;
// A 404 means the slug is gone from the free tier entirely (OpenRouter
// periodically retires free models) — park it for a day, not five minutes,
// so dead slugs stop burning a failed round-trip every few messages.
const MODEL_GONE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function cooldownMsFor(err: unknown): number {
  return err instanceof Error && /\(404\)/.test(err.message) ? MODEL_GONE_COOLDOWN_MS : MODEL_COOLDOWN_MS;
}

/**
 * Compact error text for logs. Rate-limit/failover is an EXPECTED, handled path
 * (we rotate models, then drop to the keyless floor) — logging the full Error
 * dumps a stack trace + code frame per model and floods the console, which
 * reads like a crash when nothing is actually wrong. Log just the message.
 */
function emsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function keyFingerprint(apiKey: string): string {
  return apiKey.slice(-10);
}

function cooldownKey(apiKey: string, model: string): string {
  return `${keyFingerprint(apiKey)}:${model}`;
}

/** Parses an OpenAI-style SSE body into a stream of text deltas. */
function sseTextStream(body: ReadableStream<Uint8Array>): ReadableStream<string> {
  return new ReadableStream<string>({
    async start(controller) {
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          // SSE frames are newline-delimited "data: {...}" lines
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === '[DONE]') continue;
            try {
              const json = JSON.parse(payload);
              const delta = json?.choices?.[0]?.delta?.content;
              if (typeof delta === 'string' && delta) controller.enqueue(delta);
            } catch {
              // partial/keep-alive frame — ignore
            }
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
    cancel(reason) {
      body.cancel(reason).catch(() => {});
    },
  });
}

function openRouterHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'HTTP-Referer': APP_URL,
    'X-Title': 'SynapseLearn',
  };
}

async function chatViaOpenRouterModel(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
): Promise<ChatResult> {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: openRouterHeaders(apiKey),
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 2048,
      // Route to the fastest provider currently serving this model
      provider: { sort: 'throughput' },
    }),
  });

  if (res.status === 429) {
    await res.text().catch(() => '');
    throw new RateLimitedError();
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenRouter request failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  if (!data?.choices?.[0]?.message?.content) {
    throw new Error('OpenRouter returned no content');
  }
  return { choices: data.choices, model: data.model || model };
}

/**
 * Streaming variant: opens an SSE connection to OpenRouter and yields text
 * deltas as they arrive.
 */
async function chatStreamViaOpenRouterModel(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  reasoningEffort?: 'low' | 'medium' | 'high',
): Promise<{ stream: ReadableStream<string>; model: string }> {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: openRouterHeaders(apiKey),
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 2048,
      stream: true,
      provider: { sort: 'throughput' },
      // Reasoning is the dominant first-token latency on these models — a
      // gpt-oss reply spends seconds reasoning (emitted on the separate
      // `reasoning` field we drop) before any spoken `content` arrives.
      // Voice mode passes 'low' to slash that wait. (Fully disabling is
      // rejected by the free endpoints: "Reasoning is mandatory".)
      ...(reasoningEffort ? { reasoning: { effort: reasoningEffort } } : {}),
    }),
  });

  if (res.status === 429) {
    await res.text().catch(() => '');
    throw new RateLimitedError();
  }
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenRouter stream failed (${res.status}): ${text.slice(0, 300)}`);
  }

  return { stream: sseTextStream(res.body), model };
}

async function chatViaOpenRouter(apiKey: string, messages: ChatMessage[]): Promise<ChatResult> {
  const now = Date.now();
  const available = OPENROUTER_MODELS.filter(
    (m) => now >= (modelDownUntil.get(cooldownKey(apiKey, m)) || 0),
  );
  if (available.length === 0) {
    throw new RateLimitedError();
  }

  let lastError: unknown;
  for (const model of available) {
    try {
      return await chatViaOpenRouterModel(apiKey, model, messages);
    } catch (err) {
      modelDownUntil.set(cooldownKey(apiKey, model), Date.now() + cooldownMsFor(err));
      console.warn(`[LLM.chat] ${model} unavailable (${emsg(err)}) — trying next`);
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('All OpenRouter models failed');
}

async function chatViaHermes(messages: ChatMessage[]): Promise<ChatResult> {
  const res = await fetch(HERMES_AGENT_URL!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(HERMES_AGENT_API_KEY ? { Authorization: `Bearer ${HERMES_AGENT_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      model: HERMES_AGENT_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Hermes agent request failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  if (!data?.choices?.[0]?.message?.content) {
    throw new Error('Hermes agent returned no content');
  }
  return { choices: data.choices, model: data.model || HERMES_AGENT_MODEL };
}

async function chatStreamViaHermes(
  messages: ChatMessage[],
): Promise<{ stream: ReadableStream<string>; model: string }> {
  const res = await fetch(HERMES_AGENT_URL!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(HERMES_AGENT_API_KEY ? { Authorization: `Bearer ${HERMES_AGENT_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      model: HERMES_AGENT_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 2048,
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(`Hermes agent stream failed (${res.status}): ${text.slice(0, 300)}`);
  }

  return { stream: sseTextStream(res.body), model: HERMES_AGENT_MODEL };
}

// The keyless floor. Pollinations is OpenAI-compatible and needs no API key, so
// it's what keeps the app answering when the learner has no OpenRouter key at
// all, or when their key AND every free OpenRouter model are rate-limited/down.
// Quality is lower (anonymous tier ≈ gpt-oss-20b), so every result routed here
// is flagged `degraded` for the UI.
//
// CONCURRENCY: the anonymous tier allows only ~1 in-flight request per IP and
// 429s the rest ("Queue full for IP ... max: 1"). The app fires bursts (batch
// question generation + chat at once), so we SERIALIZE keyless calls through a
// one-at-a-time gate and RETRY 429s with backoff (the slot frees when the prior
// request finishes). Without this, everything past the first burst-request fails
// the moment OpenRouter is also rate-limited.
const POLLINATIONS_ATTEMPTS = 4;

// A promise chain that lets only one keyless request run at a time.
let keylessGate: Promise<void> = Promise.resolve();
async function acquireKeyless(): Promise<() => void> {
  const prev = keylessGate;
  let release!: () => void;
  keylessGate = new Promise<void>((r) => { release = r; });
  await prev; // wait for the previous keyless call to release
  return release;
}

function isQueueFull(err: unknown): boolean {
  return err instanceof Error && /\(429\)|Queue full/i.test(err.message);
}

async function chatViaPollinations(messages: ChatMessage[]): Promise<ChatResult> {
  const release = await acquireKeyless();
  try {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= POLLINATIONS_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(POLLINATIONS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: POLLINATIONS_MODEL, messages, temperature: 0.7 }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`Pollinations request failed (${res.status}): ${text.slice(0, 300)}`);
        }
        const data = await res.json();
        if (!data?.choices?.[0]?.message?.content) throw new Error('Pollinations returned no content');
        return { choices: data.choices, model: data.model || POLLINATIONS_MODEL, degraded: true };
      } catch (err) {
        lastErr = err;
        // Longer backoff for a full queue (wait for the slot to clear) than for
        // a transient network blip.
        if (attempt < POLLINATIONS_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, isQueueFull(err) ? 900 * attempt : 400));
        }
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('Pollinations failed');
  } finally {
    release();
  }
}

/**
 * Streaming keyless floor: Pollinations speaks OpenAI SSE, so reuse the parser.
 * Serialized + 429-retried like the non-stream path. The gate releases once the
 * response headers arrive (the slot is about the request, not the open stream),
 * so a slow read doesn't block the next keyless call indefinitely.
 */
async function chatStreamViaPollinations(
  messages: ChatMessage[],
): Promise<{ stream: ReadableStream<string>; model: string }> {
  const release = await acquireKeyless();
  try {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= POLLINATIONS_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(POLLINATIONS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: POLLINATIONS_MODEL, messages, temperature: 0.7, stream: true }),
        });
        if (!res.ok || !res.body) {
          const text = await res.text().catch(() => '');
          throw new Error(`Pollinations stream failed (${res.status}): ${text.slice(0, 300)}`);
        }
        return { stream: sseTextStream(res.body), model: POLLINATIONS_MODEL };
      } catch (err) {
        lastErr = err;
        if (attempt < POLLINATIONS_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, isQueueFull(err) ? 900 * attempt : 400));
        }
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('Pollinations stream failed');
  } finally {
    release();
  }
}

/**
 * Lightweight second-opinion pass: asks whether the assistant's response
 * actually addresses the user's message (and context, if given) — not
 * whether it's well-written. Kept to a one-line verdict to minimize added
 * latency/cost on top of the primary response.
 */
async function critique(
  auth: LLMAuth,
  userMessage: string,
  assistantResponse: string,
  contextSummary?: string,
): Promise<{ ok: boolean; feedback?: string }> {
  const prompt = `You are a quality-control reviewer for an AI tutor. Judge ONLY whether the ASSISTANT RESPONSE below actually addresses the USER MESSAGE${contextSummary ? ' given the CONTEXT' : ''} in a relevant, on-topic way — not whether the writing is polished.

USER MESSAGE:
"""${userMessage.slice(0, 1500)}"""
${contextSummary ? `\nCONTEXT:\n"""${contextSummary.slice(0, 1000)}"""\n` : ''}
ASSISTANT RESPONSE:
"""${assistantResponse.slice(0, 1500)}"""

Reply with EXACTLY one line, no other text:
OK
or
ISSUE: <one short sentence on what's wrong and what should be addressed instead>`;

  try {
    const result = await LLM.chat({
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: 'Judge the response now.' },
      ],
      auth,
    });
    const raw = result?.choices?.[0]?.message?.content?.trim() || '';
    if (!raw || raw.toUpperCase().startsWith('OK')) return { ok: true };
    const match = raw.match(/ISSUE:\s*(.+)/i);
    return { ok: false, feedback: match ? match[1].trim() : "The response didn't adequately address the user's message." };
  } catch {
    // If the reviewer pass itself fails, don't block the primary response on it.
    return { ok: true };
  }
}

/** One image for a vision request, as a data: URL (base64). */
export interface VisionImage {
  dataUrl: string;
}

async function visionViaOpenRouterModel(
  apiKey: string,
  model: string,
  prompt: string,
  images: VisionImage[],
): Promise<string> {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: openRouterHeaders(apiKey),
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            ...images.map((img) => ({ type: 'image_url', image_url: { url: img.dataUrl } })),
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 2048,
    }),
  });
  if (res.status === 429) {
    await res.text().catch(() => {});
    throw new RateLimitedError();
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenRouter vision request failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('Vision model returned no content');
  return content;
}

export const LLM = {
  /**
   * Role-routed chat (task 32): tries the role's specialist rotation first,
   * then falls back to the general chat() path (Hermes → general rotation →
   * Pollinations). Same cooldown discipline as everything else.
   */
  async chatAs(role: ModelRole, { messages, auth }: { messages: ChatMessage[]; auth?: LLMAuth }): Promise<ChatResult | null> {
    const apiKey = auth?.apiKey?.trim();
    if (apiKey && !HERMES_AGENT_URL) {
      const now = Date.now();
      const available = ROLE_MODELS[role].filter(
        (m) => now >= (modelDownUntil.get(cooldownKey(apiKey, m)) || 0),
      );
      for (const model of available) {
        try {
          return await chatViaOpenRouterModel(apiKey, model, messages);
        } catch (err) {
          modelDownUntil.set(cooldownKey(apiKey, model), Date.now() + cooldownMsFor(err));
          console.warn(`[LLM.chatAs:${role}] ${model} unavailable (${emsg(err)}) — trying next`);
        }
      }
    }
    return this.chat({ messages, auth });
  },

  /**
   * Vision: image understanding via the free vision-model rotation (C7).
   * Used for image/scan uploads (OCR), diagram description, and formula →
   * LaTeX extraction. Returns null when no model could answer — callers must
   * degrade gracefully (B5), never block on this.
   */
  async vision({ prompt, images, auth }: { prompt: string; images: VisionImage[]; auth?: LLMAuth }): Promise<string | null> {
    const apiKey = auth?.apiKey?.trim();
    if (!apiKey || images.length === 0) return null;
    const now = Date.now();
    const available = OPENROUTER_VISION_MODELS.filter(
      (m) => now >= (modelDownUntil.get(cooldownKey(apiKey, m)) || 0),
    );
    for (const model of available) {
      try {
        return await visionViaOpenRouterModel(apiKey, model, prompt, images);
      } catch (err) {
        modelDownUntil.set(cooldownKey(apiKey, model), Date.now() + cooldownMsFor(err));
        console.warn(`[LLM.vision] ${model} unavailable (${emsg(err)}) — trying next`);
      }
    }
    return null;
  },

  /**
   * Provider order (the learner's own key ALWAYS takes priority — we only go
   * keyless once their full OpenRouter path is exhausted):
   *   1. Hermes agent, when this deployment configures one.
   *   2. The learner's OpenRouter key, rotating the free models with cooldowns.
   *   3. The keyless Pollinations floor — used when there's NO key, or the key
   *      is rate-limited / every free model is down. Flagged `degraded` so the
   *      UI can nudge the learner to add a key or wait for the limit to reset.
   * Only if the keyless floor ALSO fails do we surface an error (RateLimited if
   * that's why we fell through, else null for the route to render generically).
   */
  async chat({ messages, auth }: { messages: ChatMessage[]; auth?: LLMAuth }): Promise<ChatResult | null> {
    if (HERMES_AGENT_URL) {
      try {
        return await chatViaHermes(messages);
      } catch (hermesError) {
        console.error('[LLM.chat] Hermes agent unavailable, falling back:', hermesError);
      }
    }

    const apiKey = auth?.apiKey?.trim();
    // Why we're about to use the keyless floor — drives the learner-facing nudge.
    let reason: DegradedReason = apiKey ? 'provider_down' : 'no_key';
    if (apiKey) {
      try {
        return await chatViaOpenRouter(apiKey, messages);
      } catch (openRouterError) {
        if (openRouterError instanceof RateLimitedError) reason = 'rate_limited';
        console.info(`[LLM.chat] OpenRouter exhausted (${reason}) — using keyless fallback`);
      }
    }

    // Keyless floor — always attempted so the app keeps answering.
    try {
      const result = await chatViaPollinations(messages);
      return { ...result, degraded: true, degradedReason: reason };
    } catch (pollinationsError) {
      console.error('[LLM.chat] Keyless floor also failed:', pollinationsError);
      if (reason === 'rate_limited') throw new RateLimitedError();
      if (reason === 'no_key' && !HERMES_AGENT_URL) throw new NoApiKeyError();
      return null;
    }
  },

  /**
   * Streaming chat: resolves to a stream of text deltas. Same provider order /
   * priority as chat() — the learner's key first (role specialists, then the
   * general rotation), then the keyless Pollinations SSE floor (flagged
   * `degraded`), then the non-streaming path emitted as a single chunk.
   */
  async chatStream({ messages, auth, role, reasoningEffort }: { messages: ChatMessage[]; auth?: LLMAuth; role?: ModelRole; reasoningEffort?: 'low' | 'medium' | 'high' }): Promise<{ stream: ReadableStream<string>; model: string; degraded?: boolean; degradedReason?: DegradedReason } | null> {
    if (HERMES_AGENT_URL) {
      try {
        return await chatStreamViaHermes(messages);
      } catch (hermesError) {
        console.error('[LLM.chatStream] Hermes agent stream unavailable, falling back:', hermesError);
      }
    }

    const apiKey = auth?.apiKey?.trim();
    let reason: DegradedReason = apiKey ? 'provider_down' : 'no_key';
    if (apiKey) {
      const now = Date.now();
      // Role specialists first (e.g. the teach role's gemma-4-31b for tutor
      // responses — stronger, disciplined), then the general rotation.
      const pool = role ? [...ROLE_MODELS[role], ...OPENROUTER_MODELS] : OPENROUTER_MODELS;
      const available = [...new Set(pool)].filter(
        (m) => now >= (modelDownUntil.get(cooldownKey(apiKey, m)) || 0),
      );
      if (available.length === 0) reason = 'rate_limited';
      for (const model of available) {
        try {
          return await chatStreamViaOpenRouterModel(apiKey, model, messages, reasoningEffort);
        } catch (err) {
          if (err instanceof RateLimitedError) reason = 'rate_limited';
          modelDownUntil.set(cooldownKey(apiKey, model), Date.now() + cooldownMsFor(err));
          console.warn(`[LLM.chatStream] ${model} unavailable (${emsg(err)}) — trying next`);
        }
      }
    }

    // Keyless streaming floor.
    try {
      const ps = await chatStreamViaPollinations(messages);
      return { ...ps, degraded: true, degradedReason: reason };
    } catch (pollErr) {
      console.warn('[LLM.chatStream] Keyless stream floor failed, trying non-stream:', pollErr);
    }

    const result = await this.chat({ messages, auth });
    const text = result?.choices?.[0]?.message?.content;
    if (!text) return null;
    return {
      stream: new ReadableStream<string>({
        start(controller) {
          controller.enqueue(text);
          controller.close();
        },
      }),
      model: result?.model || 'fallback',
      degraded: result?.degraded,
      degradedReason: result?.degradedReason,
    };
  },

  /**
   * Orchestrated chat: generate a response, have a second reviewer pass judge
   * whether it actually addresses the user's message/context, and regenerate
   * once with corrective feedback if the reviewer flags it. Falls back to the
   * first response if the reviewer or the retry fails for any reason.
   */
  async chatWithReview({
    messages,
    contextSummary,
    auth,
  }: {
    messages: ChatMessage[];
    contextSummary?: string;
    auth?: LLMAuth;
  }): Promise<(ChatResult & { corrected?: boolean }) | null> {
    const result = await this.chat({ messages, auth });
    if (!result) return null;

    // Speed: the reviewer pass adds 1–2 extra LLM round-trips per message,
    // which is most of the perceived latency. Off unless explicitly enabled.
    if (process.env.AI_REVIEW !== '1') return result;

    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
    const assistantText = result.choices[0]?.message?.content || '';
    if (!lastUserMessage || !assistantText) return result;

    // Even when enabled, only review early in a conversation (where going
    // off-track matters most) — never mid-session.
    const exchangeCount = messages.filter((m) => m.role === 'user').length;
    if (exchangeCount > 2) return result;

    const review = await critique(auth ?? {}, lastUserMessage, assistantText, contextSummary);
    if (review.ok) return result;

    console.warn('[LLM.chatWithReview] Reviewer flagged response, regenerating:', review.feedback);

    const correctedMessages: ChatMessage[] = [
      ...messages,
      {
        role: 'system',
        content: `Your previous response was reviewed and flagged as off-target: ${review.feedback}. Write a new response that directly fixes this.`,
      },
    ];

    const retried = await this.chat({ messages: correctedMessages, auth });
    return retried ? { ...retried, corrected: true } : result;
  },
};

/**
 * Pulls the learner's OpenRouter key out of a request and maps LLM errors to
 * HTTP responses. Shared by every AI route.
 */
export function authFromRequest(request: Request): LLMAuth {
  return { apiKey: request.headers.get('x-openrouter-key') || undefined };
}

export function llmErrorResponse(error: unknown): { status: number; body: { error: string; code: string } } | null {
  if (error instanceof NoApiKeyError) {
    return { status: 401, body: { error: error.message, code: error.code } };
  }
  if (error instanceof RateLimitedError) {
    return { status: 429, body: { error: error.message, code: error.code } };
  }
  return null;
}
