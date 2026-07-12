'use client';

/**
 * Global background question generation (UNIFIED-PLAN tasks 41/42/52, req A6/B4).
 *
 * A module-level singleton that starts the moment the app loads (mounted by
 * StoreInitializer) and keeps running across page navigation — leaving the
 * quiz or tutor page never stops generation. It walks every local course
 * section by section, active course first, and banks validated questions in
 * questionCache.
 *
 * Discipline:
 *  - pauses while the AI is answering the learner (chatRequestStatus, B4)
 *  - one request in flight, each with a hard timeout — no zombie requests
 *  - per-course cap (500) and dedupe are enforced by appendToQuestionCache
 *  - a priority lane lets the tutor demand slide-grounded questions NOW
 *    (bank top-up for "give me 20 questions on slide 8")
 *  - skips silently when no OpenRouter key is set; retries courses later
 */

import { useAppStore } from '@/stores/appStore';
import { aiFetch, getOpenRouterKey } from '@/lib/aiKey';
import { appendToQuestionCache, loadQuestionCache, getPreferredTypes, isBackgroundGenerationEnabled } from '@/lib/questionCache';
import { isLocalCourse, getLocalCourseContent, getLocalSlides } from '@/lib/localLibrary';
import type { Question } from '@/types';

const REQUEST_TIMEOUT_MS = 90_000;
const COURSE_CAP = 500;
const IDLE_RECHECK_MS = 30_000;
const PAUSE_POLL_MS = 1_500;

interface PriorityRequest {
  courseId: string;
  slideId: string;
  slideContent: string;
  count: number;
  resolve: (added: Question[]) => void;
}

let running = false;
let stopped = false;
const priorityQueue: PriorityRequest[] = [];
// Courses that failed recently — retried after a cooldown, never hot-looped
const courseCooldown = new Map<string, number>();

function aiAnswering(): boolean {
  const s = useAppStore.getState().chatRequestStatus;
  return s === 'sending' || s === 'streaming';
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitWhileAnswering(): Promise<void> {
  while (aiAnswering()) await sleep(PAUSE_POLL_MS);
}

async function fetchQuestions(body: Record<string, unknown>): Promise<{ questions: Question[]; sectionsDone?: number; sectionsTotal?: number; hasMore?: boolean } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await aiFetch('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tutor priority lane (task 43): generate questions for ONE slide right now.
 * Resolves with whatever was added to the bank (possibly []). The main loop
 * yields to this between its own requests.
 */
export function requestSlideQuestions(courseId: string, slideId: string, slideContent: string, count: number): Promise<Question[]> {
  return new Promise((resolve) => {
    priorityQueue.push({ courseId, slideId, slideContent, count, resolve });
    void ensureRunning();
  });
}

async function servePriority(req: PriorityRequest): Promise<void> {
  await waitWhileAnswering();
  const data = await fetchQuestions({
    courseId: req.courseId,
    slideId: req.slideId,
    content: req.slideContent,
    types: getPreferredTypes(),
    count: req.count,
  });
  const tagged = (data?.questions ?? []).map((q) => ({
    ...q,
    slideId: q.slideId ?? req.slideId,
    provenance: q.provenance ?? ('tutor' as const),
  }));
  if (tagged.length > 0) {
    const cache = loadQuestionCache(req.courseId);
    appendToQuestionCache(req.courseId, tagged, cache?.sectionsDone ?? 0, cache?.sectionsTotal ?? null);
  }
  req.resolve(tagged);
}

/** One background pass over one course. Returns true when the course is done/capped. */
async function generateForCourse(courseId: string): Promise<boolean> {
  const cache = loadQuestionCache(courseId);
  if ((cache?.questions.length ?? 0) >= COURSE_CAP) return true;
  if (cache?.sectionsTotal != null && (cache.sectionsDone ?? 0) >= cache.sectionsTotal) return true;

  await waitWhileAnswering();
  // Yield to any tutor priority request first
  while (priorityQueue.length > 0) await servePriority(priorityQueue.shift()!);

  const data = await fetchQuestions({
    courseId,
    sectionOffset: cache?.sectionsDone ?? 0,
    maxSections: 1,
    types: getPreferredTypes(),
    content: isLocalCourse(courseId) ? await getLocalCourseContent(courseId) : undefined,
  });
  if (!data) {
    courseCooldown.set(courseId, Date.now() + 5 * 60_000);
    return false;
  }
  const tagged = (data.questions ?? []).map((q) => ({ ...q, provenance: q.provenance ?? ('background' as const) }));
  const updated = appendToQuestionCache(courseId, tagged, data.sectionsDone ?? 0, data.sectionsTotal ?? null);
  return updated.questions.length >= COURSE_CAP || data.hasMore === false;
}

async function mainLoop(): Promise<void> {
  while (!stopped) {
    if (!getOpenRouterKey() || !isBackgroundGenerationEnabled()) {
      await sleep(IDLE_RECHECK_MS);
      continue;
    }
    // Priority lane always wins
    while (priorityQueue.length > 0) await servePriority(priorityQueue.shift()!);

    const state = useAppStore.getState();
    const now = Date.now();
    // Active course first, then the rest — most recently created first
    const ordered = [
      ...(state.activeCourse ? [state.activeCourse] : []),
      ...state.courses.filter((c) => c.id !== state.activeCourse?.id),
    ].filter((c) => now >= (courseCooldown.get(c.id) ?? 0));

    let didWork = false;
    for (const course of ordered) {
      if (stopped || priorityQueue.length > 0) break;
      const done = await generateForCourse(course.id);
      if (!done) {
        didWork = true;
        break; // one section per cycle keeps the app responsive
      }
    }
    if (!didWork && priorityQueue.length === 0) await sleep(IDLE_RECHECK_MS);
    else await sleep(400);
  }
  running = false;
}

/** Idempotent start — called by StoreInitializer on app entry (task 42). */
export function ensureRunning(): void {
  if (typeof window === 'undefined' || running) return;
  running = true;
  stopped = false;
  void mainLoop();
}

export function stopBackgroundGeneration(): void {
  stopped = true;
}
