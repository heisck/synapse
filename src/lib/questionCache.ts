/**
 * Browser-side question cache (docs/ROADMAP.md — background generation).
 * Questions generated section-by-section are stored per course in
 * localStorage, so re-opening quiz/exam mode is instant and background
 * generation can resume exactly where it stopped.
 */
import type { Question } from '@/types';
import { isRenderableQuestion } from './validate';

export interface CourseQuestionCache {
  courseId: string;
  questions: Question[];
  sectionsDone: number;
  sectionsTotal: number | null;
  updatedAt: number;
}

const KEY_PREFIX = 'synapse-qcache-';
const TOGGLE_KEY = 'synapse-bg-generation';

export function loadQuestionCache(courseId: string): CourseQuestionCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY_PREFIX + courseId);
    const cache = raw ? (JSON.parse(raw) as CourseQuestionCache) : null;
    if (!cache) return null;
    // Stale-format sweep: whenever validation rules tighten (e.g. fill_blank
    // now requires exactly one blank), old cached questions that no longer
    // pass are DELETED here — the generator refills the pool in the new style.
    const kept = cache.questions.filter((q) => isRenderableQuestion(q));
    if (kept.length !== cache.questions.length) {
      const swept: CourseQuestionCache = { ...cache, questions: kept, updatedAt: Date.now() };
      saveQuestionCache(swept);
      return swept;
    }
    return cache;
  } catch {
    return null;
  }
}

export function saveQuestionCache(cache: CourseQuestionCache): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY_PREFIX + cache.courseId, JSON.stringify(cache));
  } catch {
    // Quota exceeded — drop the oldest course cache and retry once
    try {
      const entries = Object.keys(localStorage)
        .filter((k) => k.startsWith(KEY_PREFIX))
        .map((k) => ({ k, at: (JSON.parse(localStorage.getItem(k) || '{}') as CourseQuestionCache).updatedAt || 0 }))
        .sort((a, b) => a.at - b.at);
      if (entries[0]) {
        localStorage.removeItem(entries[0].k);
        localStorage.setItem(KEY_PREFIX + cache.courseId, JSON.stringify(cache));
      }
    } catch {
      // storage unavailable — cache just won't persist
    }
  }
}

/** Merge new questions into a course's cache, deduping by question text. */
export function appendToQuestionCache(
  courseId: string,
  newQuestions: Question[],
  sectionsDone: number,
  sectionsTotal: number | null,
): CourseQuestionCache {
  const existing = loadQuestionCache(courseId);
  const seen = new Set((existing?.questions ?? []).map((q) => q.question.toLowerCase()));
  const merged = [...(existing?.questions ?? [])];
  for (const q of newQuestions) {
    if (!seen.has(q.question.toLowerCase())) {
      seen.add(q.question.toLowerCase());
      merged.push(q);
    }
  }
  const cache: CourseQuestionCache = {
    courseId,
    questions: merged,
    sectionsDone: Math.max(sectionsDone, existing?.sectionsDone ?? 0),
    sectionsTotal: sectionsTotal ?? existing?.sectionsTotal ?? null,
    updatedAt: Date.now(),
  };
  saveQuestionCache(cache);
  return cache;
}

/** Learner-configured question-type mix, used for generation and pool filter. */
const TYPES_KEY = 'synapse-question-types';
export const ALL_QUESTION_TYPES = ['multiple_choice', 'true_false', 'fill_blank', 'matching'] as const;

export function getPreferredTypes(): string[] {
  if (typeof window === 'undefined') return [...ALL_QUESTION_TYPES];
  try {
    const raw = localStorage.getItem(TYPES_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : null;
    const valid = parsed?.filter((t) => (ALL_QUESTION_TYPES as readonly string[]).includes(t)) ?? [];
    return valid.length > 0 ? valid : [...ALL_QUESTION_TYPES];
  } catch {
    return [...ALL_QUESTION_TYPES];
  }
}

export function setPreferredTypes(types: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TYPES_KEY, JSON.stringify(types));
  } catch {
    // ignore
  }
}

/** The user-facing toggle: generate questions in the background or not. */
export function isBackgroundGenerationEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(TOGGLE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setBackgroundGenerationEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TOGGLE_KEY, enabled ? '1' : '0');
  } catch {
    // ignore
  }
}
