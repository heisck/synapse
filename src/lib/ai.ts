type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

interface ChatResult {
  choices: Array<{ message: { content: string } }>;
  model?: string;
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Free-tier models are frequently rate-limited upstream, so we keep a
// rotation: try each in order, skipping any that recently failed.
// Override with OPENROUTER_MODELS (comma-separated) or OPENROUTER_MODEL.
// Ordering below is by measured latency (2026-07): nemotron-super answered in
// ~0.4s while the popular llama/gpt-oss free slots were 429ing upstream.
const OPENROUTER_MODELS = (
  process.env.OPENROUTER_MODELS ||
  process.env.OPENROUTER_MODEL ||
  [
    'nvidia/nemotron-3-super-120b-a12b:free',
    'google/gemma-4-26b-a4b-it:free',
    'tencent/hy3:free',
    'openai/gpt-oss-120b:free',
    'meta-llama/llama-3.3-70b-instruct:free',
  ].join(',')
)
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

const POLLINATIONS_URL = 'https://text.pollinations.ai/openai';
const POLLINATIONS_MODEL = process.env.POLLINATIONS_MODEL || 'openai';

// Per-model circuit breaker: a model that just returned 429/5xx is skipped
// for a cooldown instead of paying a failed round-trip on every message.
const modelDownUntil = new Map<string, number>();
const MODEL_COOLDOWN_MS = 5 * 60 * 1000;

async function chatViaOpenRouterModel(model: string, messages: ChatMessage[]): Promise<ChatResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': APP_URL,
      'X-Title': 'SynapseLearn',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 2048,
      // Route to the fastest provider currently serving this model
      provider: { sort: 'throughput' },
    }),
  });

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

async function chatViaOpenRouter(messages: ChatMessage[]): Promise<ChatResult> {
  const now = Date.now();
  const available = OPENROUTER_MODELS.filter((m) => now >= (modelDownUntil.get(m) || 0));
  if (available.length === 0) {
    throw new Error('All OpenRouter models are cooling down after recent failures');
  }

  let lastError: unknown;
  for (const model of available) {
    try {
      return await chatViaOpenRouterModel(model, messages);
    } catch (err) {
      modelDownUntil.set(model, Date.now() + MODEL_COOLDOWN_MS);
      console.warn(`[LLM.chat] OpenRouter model ${model} failed (cooling down 5 min):`, err);
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('All OpenRouter models failed');
}

async function chatViaPollinations(messages: ChatMessage[]): Promise<ChatResult> {
  const res = await fetch(POLLINATIONS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: POLLINATIONS_MODEL,
      messages,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Pollinations request failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  if (!data?.choices?.[0]?.message?.content) {
    throw new Error('Pollinations returned no content');
  }
  return { choices: data.choices, model: data.model || POLLINATIONS_MODEL };
}

/**
 * Lightweight second-opinion pass: asks whether the assistant's response
 * actually addresses the user's message (and context, if given) — not
 * whether it's well-written. Kept to a one-line verdict to minimize added
 * latency/cost on top of the primary response.
 */
async function critique(
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

export const LLM = {
  // Free, key-optional providers: OpenRouter (needs OPENROUTER_API_KEY) first,
  // rotating through several free models, falling back to Pollinations
  // (no key required) if all of them are unavailable.
  async chat({ messages }: { messages: ChatMessage[]; model?: string }): Promise<ChatResult | null> {
    try {
      return await chatViaOpenRouter(messages);
    } catch (openRouterError) {
      console.error('[LLM.chat] OpenRouter unavailable, falling back to Pollinations:', openRouterError);
    }
    try {
      return await chatViaPollinations(messages);
    } catch (pollinationsError) {
      console.error('[LLM.chat] Pollinations fallback also failed:', pollinationsError);
      return null;
    }
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
  }: {
    messages: ChatMessage[];
    contextSummary?: string;
  }): Promise<(ChatResult & { corrected?: boolean }) | null> {
    const result = await this.chat({ messages });
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

    const review = await critique(lastUserMessage, assistantText, contextSummary);
    if (review.ok) return result;

    console.warn('[LLM.chatWithReview] Reviewer flagged response, regenerating:', review.feedback);

    const correctedMessages: ChatMessage[] = [
      ...messages,
      {
        role: 'system',
        content: `Your previous response was reviewed and flagged as off-target: ${review.feedback}. Write a new response that directly fixes this.`,
      },
    ];

    const retried = await this.chat({ messages: correctedMessages });
    return retried ? { ...retried, corrected: true } : result;
  },
};
