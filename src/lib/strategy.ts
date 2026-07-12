/**
 * System Intelligence layer (UNIFIED-PLAN tasks 14–17, rules R2/R3).
 *
 * R3 — Strategy Injection: generation prompts are composed server-side from
 * proven strategy entries, so "generate questions about X" never goes out raw.
 *
 * R2 — strict three-stage flow:
 *   stage 1  fileSuggestion()      — the ONLY write path available to AI output
 *   stage 2  promoteSuggestion()   — code-gated validation + explicit approval
 *   stage 3  PromptStrategy table  — what composeStrategyBlock() actually reads
 *
 * Models never touch stages 2–3. All content here is system-level (prompt
 * structures, formatting rules, effectiveness counters) — never user data (R1).
 */

import { db } from '@/lib/db';

export type StrategyScope = 'questions' | 'chat' | 'flashcards' | 'notes' | 'all';
export type StrategySlot =
  | 'structure'
  | 'formatting'
  | 'teaching_style'
  | 'quality_constraints'
  | 'difficulty'
  | 'language_policy';

interface StrategyRow {
  id: string;
  scope: string;
  slot: string;
  name: string;
  content: string;
  version: number;
}

// ─── Built-in defaults ───────────────────────────────────────────────────────
// Used when the table has no active rows for a scope (fresh install, DB down)
// and seeded into the DB by scripts/seed-strategies.mjs. Encodes the language
// DNA (D23/D24) and the proven generation constraints learned so far.

const DEFAULT_STRATEGIES: Array<{ scope: StrategyScope; slot: StrategySlot; name: string; content: string }> = [
  {
    scope: 'all',
    slot: 'language_policy',
    name: 'language-everyday',
    content:
      'Use plain everyday words and short sentences. Analogies must use universally familiar things (food, phones, football, money, weather) — never specialized professions or niche scenarios. Introduce a technical term only when it is part of the lesson itself, and define it immediately in simple words.',
  },
  {
    scope: 'all',
    slot: 'formatting',
    name: 'formatting-clean',
    content:
      'Format for readability: short paragraphs (2-4 sentences), "-" for bullet lists, numbered steps for procedures, one blank line between blocks. Never emit decorative dash runs or em-dash chains. Never leave a code fence unclosed.',
  },
  {
    scope: 'questions',
    slot: 'structure',
    name: 'questions-structure',
    content:
      'Every question must be answerable from the provided material alone, test understanding rather than recall where possible, and include a one-to-two sentence explanation of the correct answer. multiple_choice: exactly 4 distinct plausible options. fill_blank: exactly ONE "___" blank whose answer is a single short term. Mix the allowed question types within every batch.',
  },
  {
    scope: 'questions',
    slot: 'quality_constraints',
    name: 'questions-quality',
    content:
      'Never echo these instructions, mention the learner profile, or produce placeholder text. Questions must stand alone without referring to "the slide" or "the text above". Avoid trivial giveaway options and avoid two options that mean the same thing.',
  },
  {
    scope: 'chat',
    slot: 'teaching_style',
    name: 'chat-teaching',
    content:
      'Teach one idea at a time and anchor it to the current slide. Lead with a familiar analogy, then the concept, then one quick check question. Stay within what the learner has already covered; expand ahead only when they explicitly ask.',
  },
];

let seedAttempted = false;
async function seedDefaultsIntoDb(): Promise<void> {
  if (seedAttempted) return;
  seedAttempted = true;
  try {
    for (const d of DEFAULT_STRATEGIES) {
      const existing = await db.promptStrategy.findUnique({ where: { name: d.name } });
      if (!existing) await db.promptStrategy.create({ data: d });
    }
    cache.clear();
  } catch (err) {
    console.warn('[strategy] default seeding failed (non-fatal):', err);
  }
}

// ─── Composer (tasks 14/15) ──────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { rows: StrategyRow[]; at: number }>();

async function loadActive(scope: StrategyScope): Promise<StrategyRow[]> {
  const key = `scope:${scope}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.rows;
  try {
    const rows = await db.promptStrategy.findMany({
      where: { active: true, scope: { in: [scope, 'all'] } },
      orderBy: [{ slot: 'asc' }, { version: 'desc' }],
    });
    if (rows.length === 0) {
      // First run (task 38): seed the built-in defaults — language policy,
      // formatting, question structure — into the live tables so effectiveness
      // counters start accumulating. Idempotent via the unique name key.
      void seedDefaultsIntoDb();
    }
    const picked = rows.length > 0
      ? rows
      : DEFAULT_STRATEGIES
          .filter((d) => d.scope === scope || d.scope === 'all')
          .map((d, i) => ({ id: `default-${i}`, version: 1, ...d }));
    cache.set(key, { rows: picked, at: Date.now() });
    return picked;
  } catch (err) {
    // DB unreachable: defaults keep generation working (never block on this)
    console.warn('[strategy] falling back to built-in defaults:', err);
    return DEFAULT_STRATEGIES
      .filter((d) => d.scope === scope || d.scope === 'all')
      .map((d, i) => ({ id: `default-${i}`, version: 1, ...d }));
  }
}

/**
 * The Strategy Injection block (R3). Append to the system/instruction prompt
 * of every generation request in `scope`. Returns '' only if truly nothing
 * applies.
 */
export async function composeStrategyBlock(scope: StrategyScope): Promise<string> {
  const rows = await loadActive(scope);
  if (rows.length === 0) return '';
  const lines = rows.map((r) => `- ${r.content}`);
  return `\n[PROVEN GENERATION STRATEGY — follow all points]:\n${lines.join('\n')}`;
}

/** Strategy rows used for a request — pass to recordStrategyOutcome later. */
export async function activeStrategyIds(scope: StrategyScope): Promise<string[]> {
  return (await loadActive(scope)).map((r) => r.id).filter((id) => !id.startsWith('default-'));
}

// ─── Outcome metrics (task 17) ───────────────────────────────────────────────

/**
 * Records whether a generation that used these strategies passed validation.
 * System-level counters only. On repeated failure of a scope, files ONE
 * suggestion (stage 1) describing the failure pattern — never edits anything.
 */
export async function recordStrategyOutcome(
  strategyIds: string[],
  passed: boolean,
  failureSummary?: string,
): Promise<void> {
  try {
    if (strategyIds.length > 0) {
      await db.promptStrategy.updateMany({
        where: { id: { in: strategyIds } },
        data: passed
          ? { uses: { increment: 1 }, passCount: { increment: 1 } }
          : { uses: { increment: 1 }, failCount: { increment: 1 } },
      });
    }
    if (!passed && failureSummary) {
      await fileSuggestion({
        scope: 'questions',
        slot: 'quality_constraints',
        proposal: `Add a constraint preventing this failure class: ${failureSummary.slice(0, 500)}`,
        rationale: 'Auto-filed from a validation failure (outcome metrics loop).',
        evidence: failureSummary.slice(0, 1000),
      });
    }
  } catch (err) {
    console.warn('[strategy] outcome recording failed (non-fatal):', err);
  }
}

// ─── Suggestion pipeline (task 16, R2 stages 1–2) ────────────────────────────

export interface SuggestionInput {
  scope: StrategyScope;
  slot: StrategySlot;
  proposal: string;
  rationale?: string;
  evidence?: string;
  targetStrategy?: string;
}

/** Stage 1: the only write path AI-derived content is allowed. Inert until promoted. */
export async function fileSuggestion(input: SuggestionInput): Promise<void> {
  const proposal = (input.proposal || '').trim();
  if (!proposal) return;
  try {
    // De-dup: don't stack identical pending proposals
    const existing = await db.aiSuggestion.findFirst({
      where: { status: 'pending', proposal },
      select: { id: true },
    });
    if (existing) return;
    await db.aiSuggestion.create({
      data: {
        scope: input.scope,
        slot: input.slot,
        proposal,
        rationale: (input.rationale || '').slice(0, 1000),
        evidence: (input.evidence || '').slice(0, 2000),
        targetStrategy: input.targetStrategy,
      },
    });
  } catch (err) {
    console.warn('[strategy] fileSuggestion failed (non-fatal):', err);
  }
}

/**
 * Prompt Improvement Pipeline completion (task 36, D29): when a generation
 * scope exhausts all retries, the reasoning role analyzes the failure pattern
 * and proposes ONE refined constraint — filed as a stage-1 suggestion, never
 * applied directly. Fire-and-forget: callers must not await this on the
 * user's critical path.
 */
export async function refineFailureIntoSuggestion(
  auth: { apiKey?: string },
  scope: StrategyScope,
  errors: string[],
): Promise<void> {
  if (errors.length === 0) return;
  try {
    const { LLM } = await import('@/lib/ai');
    const result = await LLM.chatAs('reason', {
      messages: [
        {
          role: 'system',
          content: `A generation task of type "${scope}" failed validation on every retry. The validator errors were:\n${errors.slice(0, 10).map((e) => `- ${e}`).join('\n')}\n\nPropose ONE concrete instruction (30-300 chars) that, added to the generation prompt, would prevent this failure class. It must be a direct instruction to the generator, not commentary. Respond with only the instruction text.`,
        },
        { role: 'user', content: 'Propose the instruction now.' },
      ],
      auth,
    });
    const proposal = result?.choices?.[0]?.message?.content?.trim();
    if (proposal && proposal.length >= 30 && proposal.length <= 500) {
      await fileSuggestion({
        scope,
        slot: 'quality_constraints',
        proposal,
        rationale: 'Refined by the reasoning model from an exhausted-retries failure (D29).',
        evidence: errors.slice(0, 10).join('; ').slice(0, 2000),
      });
    }
  } catch (err) {
    console.warn('[strategy] refineFailureIntoSuggestion failed (non-fatal):', err);
  }
}

const VALID_SLOTS: StrategySlot[] = ['structure', 'formatting', 'teaching_style', 'quality_constraints', 'difficulty', 'language_policy'];
const VALID_SCOPES: StrategyScope[] = ['questions', 'chat', 'flashcards', 'notes', 'all'];

/**
 * Stage 2 → 3 (code-gated, D31): validates and applies an approved suggestion.
 * This function is only reachable through the admin review API — models have
 * no path to it. Rejection just marks the suggestion; nothing else changes.
 */
export async function promoteSuggestion(
  suggestionId: string,
  decision: 'approve' | 'reject',
  reviewNote = '',
): Promise<{ ok: boolean; error?: string }> {
  const suggestion = await db.aiSuggestion.findUnique({ where: { id: suggestionId } });
  if (!suggestion) return { ok: false, error: 'Suggestion not found' };
  if (suggestion.status !== 'pending') return { ok: false, error: `Already ${suggestion.status}` };

  if (decision === 'reject') {
    await db.aiSuggestion.update({
      where: { id: suggestionId },
      data: { status: 'rejected', reviewedAt: new Date(), reviewNote },
    });
    return { ok: true };
  }

  // Code-level validation before anything touches the live tables
  const content = suggestion.proposal.trim();
  if (content.length < 20 || content.length > 2000) return { ok: false, error: 'Proposal length out of bounds (20–2000 chars)' };
  if (!VALID_SCOPES.includes(suggestion.scope as StrategyScope)) return { ok: false, error: `Invalid scope "${suggestion.scope}"` };
  if (!VALID_SLOTS.includes(suggestion.slot as StrategySlot)) return { ok: false, error: `Invalid slot "${suggestion.slot}"` };
  // A strategy instructs the generator — it must never smuggle identity or
  // role changes ("ignore previous instructions", "you are now …")
  if (/ignore (all |any )?(previous|prior|above) instructions|you are now|system prompt/i.test(content)) {
    return { ok: false, error: 'Proposal contains prompt-injection patterns' };
  }

  const name = suggestion.targetStrategy || `${suggestion.scope}-${suggestion.slot}-${Date.now().toString(36)}`;
  const existing = await db.promptStrategy.findUnique({ where: { name } });
  if (existing) {
    await db.promptStrategy.update({
      where: { name },
      data: { content, version: { increment: 1 }, active: true },
    });
  } else {
    await db.promptStrategy.create({
      data: { scope: suggestion.scope, slot: suggestion.slot, name, content },
    });
  }
  await db.validatedImprovement.create({
    data: {
      suggestionId,
      scope: suggestion.scope,
      slot: suggestion.slot,
      content,
      appliedTo: name,
    },
  });
  await db.aiSuggestion.update({
    where: { id: suggestionId },
    data: { status: 'approved', reviewedAt: new Date(), reviewNote },
  });
  cache.clear(); // composer picks the change up immediately
  return { ok: true };
}

export function seedDefaults() {
  return DEFAULT_STRATEGIES;
}
