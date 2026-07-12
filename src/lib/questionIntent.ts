/**
 * Pure chat-intent detection (UNIFIED-PLAN tasks 40/43) — no React, fully
 * unit-testable. Used by TutorView before any LLM call.
 */

/**
 * Question-request intent (task 43): detects "quiz me", "give me 20 questions
 * on slide 8", "I want to go to the quiz section...", extracts the requested
 * count and slide. These requests are served from the question BANK by code —
 * the LLM is never asked to write quiz JSON for them, which is what caused
 * the endless "preparing cards" spinners and reasoning slop.
 *
 * Deliberately does NOT match "I have a question about X" — that's the
 * learner asking to ask, not asking to be tested.
 */
export interface QuestionIntent {
  count: number;
  /** True when the learner named a number ("20 questions") — otherwise the
      tutor asks how many before launching (task 57/12). */
  explicitCount: boolean;
  /** 1-based slide number if the message names one. */
  slideNumber: number | null;
  flashcards: boolean;
  /** Learner asked to REVIEW — previously answered questions may be reused. */
  review: boolean;
}

export function parseQuestionIntent(message: string): QuestionIntent | null {
  const m = message.toLowerCase();
  const explicitCount = m.match(/(\d{1,3})\s*(?:questions?|qs\b|flashcards?|cards)/);
  const practiceIntent =
    /\b(?:quiz|test|examine)\s+me\b/.test(m) ||
    /\b(?:start|take|open|go to|do)\b.{0,24}\b(?:quiz|exam|test)\b/.test(m) ||
    /\b(?:give|make|create|generate|get|want|need)\b.{0,32}\b(?:questions|flashcards?|quiz)\b/.test(m) ||
    /\bpractice questions?\b/.test(m) ||
    /\bquiz (?:section|page|mode)\b/.test(m) ||
    explicitCount !== null;
  if (!practiceIntent) return null;
  // "a question about photosynthesis" — asking, not practicing
  if (/\b(?:a|one) question\b/.test(m) && !explicitCount) return null;

  const slideMatch = m.match(/slide\s*#?\s*(\d{1,3})/);
  const count = explicitCount ? Math.min(Math.max(parseInt(explicitCount[1], 10), 1), 50) : 10;
  return {
    count,
    explicitCount: explicitCount !== null,
    slideNumber: slideMatch ? parseInt(slideMatch[1], 10) : null,
    flashcards: /flashcards?|cards\b/.test(m) && !/questions?/.test(m),
    review: /\breview\b|\bagain\b|\bretry\b/.test(m),
  };
}

/**
 * Context awareness (task 40, B10): pure-code check for whether the learner
 * is re-asking something they already asked this session — high word overlap
 * with a recent user message. The chat route turns the signal into "try a
 * different angle, smaller steps" guidance.
 */
export function detectRepeatedQuestion(
  content: string,
  messages: Array<{ role: string; content: string }>,
): boolean {
  const norm = (s: string) =>
    new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((w) => w.length > 3));
  const current = norm(content);
  if (current.size < 3) return false;
  const priorUser = messages.filter((m) => m.role === 'user').slice(-8);
  for (const m of priorUser) {
    const prev = norm(m.content);
    if (prev.size < 3) continue;
    let overlap = 0;
    for (const w of current) if (prev.has(w)) overlap++;
    const jaccard = overlap / (current.size + prev.size - overlap);
    if (jaccard >= 0.6) return true;
  }
  return false;
}
