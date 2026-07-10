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
  answer: string;
  explanation: string;
  concept?: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

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
    if (!answer) {
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

    let options: string[] | undefined;
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
      answer,
      explanation,
      concept: typeof q.concept === 'string' && q.concept.trim() ? q.concept.trim() : undefined,
      difficulty,
    });
  });

  return { valid, errors };
}

/** Validates a single regenerated question object. */
export function validateOneQuestion(item: unknown): { valid: ValidatedQuestion | null; errors: string[] } {
  const result = validateQuestions([item]);
  return { valid: result.valid[0] ?? null, errors: result.errors };
}
