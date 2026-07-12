/**
 * Code-level validation layer for AI-generated learning content
 * (docs/ROADMAP.md, Phase 0.1). No AI reviewer — plain schema checks that sit
 * between every model response and the user, so malformed or leaked output
 * (empty questions, persona text like "the user is a fast learner", echoed
 * instructions) can never be saved or shown.
 */

export interface ValidatedQuestion {
  question: string;
  type: string;
  options?: string[];
  matchingPairs?: Array<{ left: string; right: string }>;
  answer: string;
  explanation: string;
  concept?: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export const GENERATABLE_TYPES = ['multiple_choice', 'true_false', 'fill_blank', 'matching', 'short_answer'] as const;

export interface ValidationResult {
  valid: ValidatedQuestion[];
  /** One line per rejected item — fed back to the model on retry. */
  errors: string[];
}

// Text that means the model is echoing its task or leaking learner-profile /
// persona context instead of writing an actual question.
const META_LEAK_PATTERNS: RegExp[] = [
  /\bas an ai\b/i,
  /\bthe (user|learner|student) is\b/i,
  /\bfast learner\b/i,
  /\blearning style\b/i,
  /\bgenerate\s+(the\s+)?(quiz\s+)?questions?\b/i,
  /\boutput\s+only\s+(valid\s+)?json\b/i,
  /\bjson\s+(array|object|format)\b/i,
  /\bhere (is|are) (the|your)\b/i,
  /\bplaceholder\b/i,
  /\bexample question\b/i,
  /\[insert[^\]]*\]/i,
  /\byour previous response\b/i,
  /\bsystem prompt\b/i,
];

function isMetaLeak(text: string): string | null {
  for (const pattern of META_LEAK_PATTERNS) {
    if (pattern.test(text)) return `contains task/persona leakage matching ${pattern}`;
  }
  return null;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const DIFFICULTIES = new Set(['easy', 'medium', 'hard']);

/**
 * Validates a batch of model-generated question objects. Only items that pass
 * every check survive; each rejection produces a specific error line the
 * caller can feed back to the model on retry.
 */
export function validateQuestions(items: unknown[]): ValidationResult {
  const valid: ValidatedQuestion[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  items.forEach((item, i) => {
    const label = `item ${i + 1}`;
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`${label}: not a JSON object`);
      return;
    }
    const q = item as Record<string, unknown>;

    const question = typeof q.question === 'string' ? q.question.trim() : '';
    const answer = typeof q.answer === 'string' ? q.answer.trim() : String(q.answer ?? '').trim();
    const explanation = typeof q.explanation === 'string' ? q.explanation.trim() : '';
    const type = typeof q.type === 'string' && q.type.trim() ? q.type.trim() : 'multiple_choice';

    if (question.length < 10) {
      errors.push(`${label}: "question" is empty or too short`);
      return;
    }
    if (!answer && type !== 'matching') {
      // matching's canonical answer is built from its pairs below
      errors.push(`${label}: "answer" is empty`);
      return;
    }
    if (!explanation) {
      errors.push(`${label}: "explanation" is empty`);
      return;
    }

    const leak = isMetaLeak(question) || isMetaLeak(explanation);
    if (leak) {
      errors.push(`${label}: ${leak}`);
      return;
    }

    const ALLOWED_TYPES = new Set([...GENERATABLE_TYPES, 'error_correction']);
    if (!ALLOWED_TYPES.has(type as (typeof GENERATABLE_TYPES)[number])) {
      errors.push(`${label}: unknown type "${type}" — use one of ${[...ALLOWED_TYPES].join(', ')}`);
      return;
    }

    let options: string[] | undefined;
    let matchingPairs: Array<{ left: string; right: string }> | undefined;
    let finalAnswer = answer;
    if (type === 'multiple_choice') {
      const raw = Array.isArray(q.options) ? q.options : null;
      if (!raw) {
        errors.push(`${label}: multiple_choice needs an "options" array`);
        return;
      }
      options = raw.map((o) => String(o ?? '').trim()).filter(Boolean);
      const unique = new Set(options.map(normalize));
      if (options.length !== 4 || unique.size !== 4) {
        errors.push(`${label}: needs exactly 4 distinct non-empty options (got ${options.length}, ${unique.size} unique)`);
        return;
      }
      const answerNorm = normalize(answer);
      if (!options.some((o) => normalize(o) === answerNorm)) {
        errors.push(`${label}: "answer" (${answer.slice(0, 40)}) is not one of the options`);
        return;
      }
    } else if (type === 'true_false') {
      if (!/^(true|false)$/i.test(answer)) {
        errors.push(`${label}: true_false answer must be "True" or "False"`);
        return;
      }
    } else if (type === 'fill_blank') {
      // EXACTLY ONE blank: the letter-box input answers a single term.
      // Multi-blank questions ("___ , ___ and ___") are a stale format.
      const blanks = question.match(/_{2,}/g)?.length ?? 0;
      if (blanks !== 1) {
        errors.push(`${label}: fill_blank question must contain exactly ONE "___" blank (got ${blanks}) — one missing term per question`);
        return;
      }
      if (answer.length > 24) {
        errors.push(`${label}: fill_blank answer must be a short single term, max 24 characters (got ${answer.length})`);
        return;
      }
    } else if (type === 'short_answer') {
      // Typed free answer, graded fuzzily client-side: keep the expected
      // answer short enough that typo-tolerant matching stays meaningful
      if (answer.length > 80) {
        errors.push(`${label}: short_answer answer must be a brief phrase, max 80 characters (got ${answer.length})`);
        return;
      }
      if (question.length < 20) {
        errors.push(`${label}: short_answer question too thin — ask something that needs a real (practical/scenario) answer`);
        return;
      }
    } else if (type === 'matching') {
      const rawPairs = Array.isArray(q.matchingPairs) ? q.matchingPairs : null;
      if (!rawPairs) {
        errors.push(`${label}: matching needs a "matchingPairs" array of {left, right} objects`);
        return;
      }
      matchingPairs = rawPairs
        .map((p) => ({
          left: String((p as Record<string, unknown>)?.left ?? '').trim(),
          right: String((p as Record<string, unknown>)?.right ?? '').trim(),
        }))
        .filter((p) => p.left && p.right);
      const uniqueLefts = new Set(matchingPairs.map((p) => normalize(p.left)));
      const uniqueRights = new Set(matchingPairs.map((p) => normalize(p.right)));
      if (matchingPairs.length < 3 || matchingPairs.length > 5 || uniqueLefts.size !== matchingPairs.length || uniqueRights.size !== matchingPairs.length) {
        errors.push(`${label}: matching needs 3-5 pairs with distinct left and right values`);
        return;
      }
      const pairLeak = matchingPairs.map((p) => isMetaLeak(p.left) || isMetaLeak(p.right)).find(Boolean);
      if (pairLeak) {
        errors.push(`${label}: ${pairLeak}`);
        return;
      }
      // Canonical answer: "left-right" pairs — graded order-insensitively
      finalAnswer = matchingPairs.map((p) => `${p.left}-${p.right}`).join(', ');
    }

    const key = normalize(question);
    if (seen.has(key)) {
      errors.push(`${label}: duplicate of an earlier question`);
      return;
    }
    seen.add(key);

    const difficulty = DIFFICULTIES.has(String(q.difficulty)) ? (q.difficulty as ValidatedQuestion['difficulty']) : 'medium';
    valid.push({
      question,
      type,
      options,
      matchingPairs,
      answer: finalAnswer,
      explanation,
      concept: typeof q.concept === 'string' && q.concept.trim() ? q.concept.trim() : undefined,
      difficulty,
    });
  });

  return { valid, errors };
}

/**
 * Client-safe re-check for ALREADY-STORED questions. When the validation
 * rules evolve (e.g. fill_blank went from "at least one blank" to "exactly
 * one"), previously cached questions can silently violate the current
 * contract. Callers sweep their caches through this and DELETE stale items —
 * the background generator then regenerates them in the new style.
 */
export function isRenderableQuestion(q: {
  type?: string;
  question?: string;
  answer?: string;
  options?: unknown;
  matchingPairs?: unknown;
}): boolean {
  const question = typeof q.question === 'string' ? q.question.trim() : '';
  const answer = typeof q.answer === 'string' ? q.answer.trim() : '';
  const type = q.type || 'multiple_choice';
  if (question.length < 10) return false;
  if (isMetaLeak(question)) return false;

  if (type === 'multiple_choice') {
    const options = Array.isArray(q.options) ? q.options.map((o) => String(o ?? '').trim()).filter(Boolean) : [];
    if (options.length !== 4 || new Set(options.map(normalize)).size !== 4) return false;
    if (!options.some((o) => normalize(o) === normalize(answer))) return false;
  } else if (type === 'true_false') {
    if (!/^(true|false)$/i.test(answer)) return false;
  } else if (type === 'fill_blank') {
    const blanks = question.match(/_{2,}/g)?.length ?? 0;
    if (blanks !== 1) return false;
    if (!answer || answer.length > 24) return false;
  } else if (type === 'matching') {
    const pairs = Array.isArray(q.matchingPairs) ? q.matchingPairs : [];
    if (pairs.length < 3 || pairs.length > 5) return false;
  } else if (type === 'short_answer') {
    if (!answer || answer.length > 80) return false;
  }
  return true;
}

/** Validates a single regenerated question object. */
export function validateOneQuestion(item: unknown): { valid: ValidatedQuestion | null; errors: string[] } {
  const result = validateQuestions([item]);
  return { valid: result.valid[0] ?? null, errors: result.errors };
}
