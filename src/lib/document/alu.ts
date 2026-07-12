/**
 * Atomic Learning Units (UNIFIED-PLAN task 30, req C10).
 *
 * An ALU is the teaching foundation: one self-contained concept with its
 * definition, explanation, example, optional formula, practice question and
 * backlinks to the original pages. ALUs are generated per learning page by
 * /api/alu and stored ONLY user-side (localLibrary 'docs' store, rule R1).
 *
 * This module is the shared shape + code-level validator (R4: nothing an LLM
 * produces is stored unvalidated).
 */

export interface AtomicLearningUnit {
  id: string; // alu-<uuid>
  topic: string;
  definition: string;
  explanation: string;
  example: string;
  formula?: string;
  /** Stable block/page ids this ALU teaches (C9 backlinks). */
  pageRefs: string[];
  /** Topics of related ALUs — resolved by topic match, tolerant of gaps. */
  related: string[];
  /** One practice question stub (full questions live in the question bank). */
  practice?: string;
}

export interface AluValidationResult {
  valid: AtomicLearningUnit[];
  errors: string[];
}

const META_LEAK = /\bas an ai\b|\bthe (user|learner|student) is\b|\bjson (array|object)\b|\[insert[^\]]*\]|\bplaceholder\b/i;

/**
 * Validates model-generated ALU objects. Same philosophy as validateQuestions:
 * only items passing every check survive; each rejection yields a concrete
 * error line for the retry prompt.
 */
export function validateAlus(items: unknown[], validPageIds: Set<string>): AluValidationResult {
  const valid: AtomicLearningUnit[] = [];
  const errors: string[] = [];
  const seenTopics = new Set<string>();

  items.forEach((item, i) => {
    const label = `ALU ${i + 1}`;
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`${label}: not a JSON object`);
      return;
    }
    const a = item as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

    const topic = str(a.topic);
    const definition = str(a.definition);
    const explanation = str(a.explanation);
    const example = str(a.example);

    if (topic.length < 3) { errors.push(`${label}: "topic" missing or too short`); return; }
    if (definition.length < 15) { errors.push(`${label}: "definition" missing or too short`); return; }
    if (explanation.length < 40) { errors.push(`${label}: "explanation" too thin to teach from`); return; }
    if (!example) { errors.push(`${label}: "example" is required — everyday example preferred`); return; }
    const leakSource = [topic, definition, explanation, example].find((t) => META_LEAK.test(t));
    if (leakSource) { errors.push(`${label}: contains meta/persona leakage`); return; }

    const topicKey = topic.toLowerCase();
    if (seenTopics.has(topicKey)) { errors.push(`${label}: duplicate topic "${topic}"`); return; }
    seenTopics.add(topicKey);

    // pageRefs must point at real pages/blocks of this document
    const rawRefs = Array.isArray(a.pageRefs) ? a.pageRefs.map((r) => String(r)) : [];
    const pageRefs = rawRefs.filter((r) => validPageIds.has(r.split('/')[0]));
    if (pageRefs.length === 0) { errors.push(`${label}: no valid "pageRefs" — every ALU must cite its source page id`); return; }

    valid.push({
      id: `alu-${crypto.randomUUID()}`,
      topic,
      definition,
      explanation,
      example,
      formula: str(a.formula) || undefined,
      pageRefs,
      related: Array.isArray(a.related) ? a.related.map((r) => String(r).trim()).filter(Boolean).slice(0, 6) : [],
      practice: str(a.practice) || undefined,
    });
  });

  return { valid, errors };
}
