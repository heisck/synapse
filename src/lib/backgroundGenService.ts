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
import { appendToQuestionCache, loadQuestionCache, getPreferredTypes, isBackgroundGenerationEnabled, getSlideBank } from '@/lib/questionCache';
import { isLocalCourse, getLocalCourseContent, getLocalSlides, getLocalDoc } from '@/lib/localLibrary';
import type { Question } from '@/types';

const REQUEST_TIMEOUT_MS = 90_000;
// Per-ALU banks (task 69): ~20-30 questions per teaching unit, ~200-250 per
// course. The unit target scales down for very large decks so the course
// total stays near the cap.
const COURSE_CAP = 250;
const UNIT_TARGET_MAX = 30;
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
// Waker: a priority request cuts the loop's idle sleep short instantly —
// the tutor is watching that promise, it must never wait out a 30s tick.
let wakeLoop: (() => void) | null = null;

function aiAnswering(): boolean {
  const s = useAppStore.getState().chatRequestStatus;
  return s === 'sending' || s === 'streaming';
}

/**
 * Quiz non-interference (task 69): background walking never competes with a
 * live quiz for the model/key — only the priority lane (which serves the quiz
 * itself) runs while the learner is on the quiz page.
 */
function learnerInQuiz(): boolean {
  return useAppStore.getState().currentView === 'quiz';
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Idle sleep that a priority request can interrupt. */
async function idleSleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => { wakeLoop = null; resolve(); }, ms);
    wakeLoop = () => { clearTimeout(timer); wakeLoop = null; resolve(); };
  });
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
 * yields to this between its own requests. NEVER hangs: wakes the loop
 * immediately and self-resolves [] after a hard deadline so the tutor can
 * always tell the learner what happened.
 */
export function requestSlideQuestions(courseId: string, slideId: string, slideContent: string, count: number): Promise<Question[]> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (qs: Question[]) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      resolve(qs);
    };
    // Generous deadline: one request timeout + queue/pause headroom
    const deadline = setTimeout(() => settle([]), REQUEST_TIMEOUT_MS + 30_000);
    priorityQueue.push({ courseId, slideId, slideContent, count, resolve: settle });
    void ensureRunning();
    wakeLoop?.();
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

  await waitWhileAnswering();
  // Yield to any tutor priority request first
  while (priorityQueue.length > 0) await servePriority(priorityQueue.shift()!);

  // Per-ALU walk (task 69): local courses bank questions unit by unit — the
  // first teaching slide below its target gets topped up, tagged with its
  // slideId so the bank stays slide-grounded. Admin/title/lecturer pages are
  // skipped via the normalizer's classification (task 63).
  if (isLocalCourse(courseId)) {
    const [slides, doc] = await Promise.all([getLocalSlides(courseId), getLocalDoc(courseId)]);
    if (slides.length > 0) {
      const kinds = (doc?.structuredDoc as { pages?: Array<{ kind: string }> } | undefined)?.pages;
      const teaching = kinds?.length === slides.length
        ? slides.filter((_, i) => ['learning', 'objectives', 'summary'].includes(kinds[i]?.kind ?? 'learning'))
        : slides;
      const units = teaching.length > 0 ? teaching : slides;
      // 20-30 per unit for typical decks; very large decks spread the course
      // cap across all units (coverage beats depth) — never below 5.
      const unitTarget = Math.max(5, Math.min(UNIT_TARGET_MAX, Math.floor(COURSE_CAP / units.length)));
      const nextUnit = units.find((s) => {
        const bank = getSlideBank(courseId, s.id);
        return bank.unused.length + bank.used.length < unitTarget;
      });
      if (!nextUnit) return true; // every unit at target — course banked
      const bank = getSlideBank(courseId, nextUnit.id);
      const need = Math.min(unitTarget - (bank.unused.length + bank.used.length), 10);
      const data = await fetchQuestions({
        courseId,
        slideId: nextUnit.id,
        content: `## ${nextUnit.title}\n${nextUnit.content}`,
        types: getPreferredTypes(),
        count: Math.max(need, 1),
      });
      if (!data) {
        courseCooldown.set(courseId, Date.now() + 5 * 60_000);
        return false;
      }
      const tagged = (data.questions ?? []).map((q) => ({
        ...q,
        slideId: q.slideId ?? nextUnit.id,
        provenance: q.provenance ?? ('background' as const),
      }));
      const updated = appendToQuestionCache(courseId, tagged, cache?.sectionsDone ?? 0, cache?.sectionsTotal ?? null);
      return updated.questions.length >= COURSE_CAP;
    }
  }

  // Non-local (shared-DB) courses keep the section walk
  if (cache?.sectionsTotal != null && (cache.sectionsDone ?? 0) >= cache.sectionsTotal) return true;
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
    // Priority lane ALWAYS wins — served even when background walking is
    // disabled: the toggle governs unattended generation, not the questions
    // the learner just asked the tutor for.
    while (priorityQueue.length > 0) await servePriority(priorityQueue.shift()!);

    if (!getOpenRouterKey() || !isBackgroundGenerationEnabled()) {
      await idleSleep(IDLE_RECHECK_MS);
      continue;
    }

    // Never interfere with a live quiz (task 69): background walking waits
    // until the learner leaves the quiz page; priority requests still run.
    if (learnerInQuiz()) {
      await idleSleep(PAUSE_POLL_MS);
      continue;
    }

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
    if (!didWork && priorityQueue.length === 0) await idleSleep(IDLE_RECHECK_MS);
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
