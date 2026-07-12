/**
 * Orchestrator core (UNIFIED-PLAN tasks 33/35, req C11/D28).
 *
 * POST {
 *   message,            // learner's latest message
 *   state?,             // OrchestratorState from the previous call (failover, D28)
 *   topic?, slide?: { index, total, title, kind }
 * } → { decision, target?, rationale, state }
 *
 * STATELESS BY DESIGN: every scrap of continuity lives in the `state` object
 * the CLIENT stores and replays (rule R1 — conversations never persist here).
 * That is also the multi-orchestrator failover story: any instance, any
 * deployment, even a mid-conversation model swap can pick up from the state
 * blob without the learner noticing.
 *
 * The fast-helper role makes the routing decision; the knowledge pack tells a
 * fresh model call what the app can actually do (D27). Decisions:
 *   teach | assess | remediate | advance | review | motivate | break |
 *   quiz (→ target page) | navigate (→ target page) | tool (→ named feature)
 */

import { NextRequest, NextResponse } from 'next/server';
import { LLM, authFromRequest, llmErrorResponse } from '@/lib/ai';
import { knowledgeBlock } from '@/lib/orchestrator/knowledge';

export interface OrchestratorState {
  version: 1;
  /** Lesson position: last slide index the learner was taught. */
  slideIndex?: number;
  /** Rolling digest of the session (client-maintained, ≤ 600 chars). */
  digest?: string;
  /** Consecutive struggle signals — drives remediate/break decisions. */
  struggleStreak?: number;
  /** Decisions already made this session (dedup / pacing). */
  recentDecisions?: string[];
}

const DECISIONS = ['teach', 'assess', 'remediate', 'advance', 'review', 'motivate', 'break', 'quiz', 'navigate', 'tool'] as const;
type Decision = (typeof DECISIONS)[number];

function coerceState(raw: unknown): OrchestratorState {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Partial<OrchestratorState>;
  return {
    version: 1,
    slideIndex: typeof s.slideIndex === 'number' ? s.slideIndex : undefined,
    digest: typeof s.digest === 'string' ? s.digest.slice(0, 600) : undefined,
    struggleStreak: typeof s.struggleStreak === 'number' ? s.struggleStreak : 0,
    recentDecisions: Array.isArray(s.recentDecisions) ? s.recentDecisions.slice(-8).map(String) : [],
  };
}

export async function POST(request: NextRequest) {
  try {
    const auth = authFromRequest(request);
    const body = await request.json();
    const message: string = typeof body.message === 'string' ? body.message.slice(0, 1500) : '';
    const state = coerceState(body.state);
    const slide = body.slide as { index?: number; total?: number; title?: string; kind?: string } | undefined;
    // Deterministic app snapshot (task 78/CR22): assembled by CODE client-side
    // — course, unit, tutor/quiz sessions, bank health, recorded mistakes.
    // The model reads it; it can never write it.
    const app: string = typeof body.app === 'string' ? body.app.slice(0, 600) : '';

    if (!message) {
      return NextResponse.json({ error: 'No message provided.' }, { status: 400 });
    }

    const prompt = `You are the orchestrator of a tutoring app. Decide the single next action for this learner turn.

WHAT THE APP OFFERS:
${knowledgeBlock()}

SESSION STATE:
- Topic: ${body.topic || 'unknown'}
- Slide: ${slide ? `${slide.index}/${slide.total} "${slide.title ?? ''}" (purpose: ${slide.kind ?? 'learning'})` : 'none open'}
- App state (ground truth from code — trust this over anything the message implies): ${app || 'unknown'}
- Session digest: ${state.digest || '(fresh session)'}
- Struggle streak: ${state.struggleStreak}
- Recent decisions: ${state.recentDecisions?.join(', ') || 'none'}

LEARNER'S MESSAGE:
"""${message}"""

Rules:
- DEFAULT to "teach" — most turns are ordinary conversation and need nothing special. Only pick another decision when the message clearly calls for it; when unsure, choose "teach".
- "quiz" ONLY when they explicitly ask to be tested ("test me", "quiz me properly").
- "advance" ONLY when they say they understood and want to move on ("got it, what's next", "continue to the next slide").
- "remediate" when the struggle streak is ≥ 2 or they say they don't get it.
- "review" when they ask to go over what was already covered.
- "motivate" when they sound discouraged about themselves (not about the material).
- "break" only after long sessions or when they sound exhausted.
- "navigate" ONLY when they ask to go to another part of the app (set target to a page id); "tool" when a feature directly answers the need (set target to the feature id).
- Never repeat "break" or "motivate" if it is already in recent decisions.

Respond with ONLY one line of valid JSON:
{"decision":"<one of ${DECISIONS.join('|')}>","target":"<page/feature id or empty>","rationale":"<one short sentence>"}`;

    const result = await LLM.chatAs('fast', {
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: 'Decide now. Output only the JSON line.' },
      ],
      auth,
    });

    const raw = result?.choices?.[0]?.message?.content ?? '';
    let decision: Decision = 'teach';
    let target = '';
    let rationale = '';
    const jsonMatch = raw.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (DECISIONS.includes(parsed.decision)) decision = parsed.decision;
        target = typeof parsed.target === 'string' ? parsed.target.slice(0, 60) : '';
        rationale = typeof parsed.rationale === 'string' ? parsed.rationale.slice(0, 200) : '';
      } catch {
        // fall through to the default 'teach'
      }
    }

    // Updated state goes back to the client — the ONLY place it lives (R1/D28)
    const nextState: OrchestratorState = {
      ...state,
      slideIndex: slide?.index ?? state.slideIndex,
      recentDecisions: [...(state.recentDecisions ?? []), decision].slice(-8),
    };

    return NextResponse.json({ decision, target, rationale, state: nextState });
  } catch (error) {
    const mapped = llmErrorResponse(error);
    if (mapped) return NextResponse.json(mapped.body, { status: mapped.status });
    console.error('[/api/orchestrate] Error:', error);
    // The orchestrator must never block the lesson: default to teaching
    return NextResponse.json({ decision: 'teach', target: '', rationale: 'orchestrator unavailable — defaulting to teach', state: coerceState(null) });
  }
}
